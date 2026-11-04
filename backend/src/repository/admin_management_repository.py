from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class AdminManagementRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def application_by_auth_user(self, user_id: UUID):
        result = await self.session.execute(text('''
            SELECT id, full_name, email, role, approval_status
            FROM public.admin_users WHERE auth_user_id = :uid
        '''), {'uid': user_id})
        return result.mappings().one_or_none()

    async def create_application(self, user_id: UUID, email: str, full_name: str):
        result = await self.session.execute(text('''
            INSERT INTO public.admin_users (auth_user_id, email, full_name, role, approval_status)
            VALUES (:uid, :email, :name, 'ADMIN', 'PENDING')
            ON CONFLICT (auth_user_id) DO NOTHING
            RETURNING id, full_name, email, role, approval_status
        '''), {'uid': user_id, 'email': email, 'name': full_name})
        row = result.mappings().one_or_none()
        await self.session.commit()
        return row

    async def pending_applications(self):
        result = await self.session.execute(text('''
            SELECT id, full_name, email, role, approval_status, requested_at
            FROM public.admin_users
            WHERE role='ADMIN' AND approval_status='PENDING'
            ORDER BY requested_at ASC
        '''))
        return [dict(row) for row in result.mappings().all()]

    async def decide(self, actor_id: UUID, target_id: UUID, decision: str, reason: str | None):
        result = await self.session.execute(text('''
            SELECT id, role, approval_status FROM public.admin_users
            WHERE id=:target FOR UPDATE
        '''), {'target': target_id})
        target = result.mappings().one_or_none()
        if target is None:
            return 'NOT_FOUND'
        if target['role'] != 'ADMIN' or target_id == actor_id:
            return 'PROTECTED'
        before = target['approval_status']
        if before == decision:
            return 'NO_CHANGE'
        # Only pending accounts can receive their initial approval/rejection;
        # already approved accounts may be suspended, and suspended/rejected
        # accounts may be re-approved by a super admin after review.
        permitted = (
            (before == 'PENDING' and decision in ('APPROVED','REJECTED'))
            or (before == 'APPROVED' and decision == 'SUSPENDED')
            or (before in ('SUSPENDED','REJECTED') and decision == 'APPROVED')
        )
        if not permitted:
            return 'INVALID_TRANSITION'
        await self.session.execute(text('''
            UPDATE public.admin_users
            SET approval_status=CAST(:status AS text),
                approved_by=CASE WHEN CAST(:status AS text)='APPROVED' THEN :actor ELSE NULL END,
                approved_at=CASE WHEN CAST(:status AS text)='APPROVED' THEN now() ELSE NULL END,
                modified_by=:actor
            WHERE id=:target
        '''), {'status': decision, 'actor': actor_id, 'target': target_id})
        await self.session.execute(text('''
            INSERT INTO public.admin_approval_history
              (admin_id,old_status,new_status,reviewed_by,reason,created_by)
            VALUES (:target,:old,:status,:actor,:reason,:actor)
        '''), {'target': target_id, 'old': before, 'status': decision,
               'actor': actor_id, 'reason': reason})
        await self.session.execute(text('''
            INSERT INTO public.admin_audit_logs
              (admin_id,action,entity_table,entity_id,before_value,after_value,created_by)
            VALUES (:actor,'ADMIN_STATUS_CHANGED','admin_users',:target,
                    jsonb_build_object('status',CAST(:old AS text)),
                    jsonb_build_object('status',CAST(:status AS text)),:actor)
        '''), {'actor': actor_id, 'target': target_id, 'old': before, 'status': decision})
        await self.session.commit()
        return 'OK'

    async def set_permission(self, actor_id: UUID, target_id: UUID, key: str, is_granted: bool):
        target_res = await self.session.execute(text('''
            SELECT id, role, approval_status FROM public.admin_users
            WHERE id=:target FOR UPDATE
        '''), {'target': target_id})
        target = target_res.mappings().one_or_none()
        if not target:
            return 'NOT_FOUND'
        if target['role'] != 'ADMIN' or target['approval_status'] != 'APPROVED':
            return 'TARGET_NOT_APPROVED_ADMIN'
        catalog_res = await self.session.execute(text('''
            SELECT permission_key FROM public.admin_permission_catalog
            WHERE permission_key=:key AND is_active=TRUE AND assignable_to_admin=TRUE
        '''), {'key': key})
        if catalog_res.scalar_one_or_none() is None:
            return 'NOT_ASSIGNABLE'
        old_res = await self.session.execute(text('''
            SELECT is_granted FROM public.admin_permission_assignments
            WHERE admin_id=:target AND permission_key=:key FOR UPDATE
        '''), {'target': target_id, 'key': key})
        old = old_res.scalar_one_or_none()
        if old is not None and old == is_granted:
            return 'NO_CHANGE'
        await self.session.execute(text('''
            INSERT INTO public.admin_permission_assignments
              (admin_id, permission_key, is_granted, granted_by_super_admin_id)
            VALUES (:target,:key,:grant,:actor)
            ON CONFLICT (admin_id,permission_key) DO UPDATE
            SET is_granted=EXCLUDED.is_granted,
                granted_by_super_admin_id=EXCLUDED.granted_by_super_admin_id,
                modified_at=now()
        '''), {'target': target_id, 'key': key, 'grant': is_granted, 'actor': actor_id})
        await self.session.execute(text('''
            INSERT INTO public.admin_audit_logs
              (admin_id,action,entity_table,entity_id,before_value,after_value,created_by)
            VALUES (:actor,'ADMIN_PERMISSION_CHANGED','admin_permission_assignments',:target,
                    jsonb_build_object('permission',CAST(:key AS text),'granted',CAST(:before AS boolean)),
                    jsonb_build_object('permission',CAST(:key AS text),'granted',CAST(:grant AS boolean)),:actor)
        '''), {'actor': actor_id, 'target': target_id, 'key': key,
               'before': old, 'grant': is_granted})
        await self.session.commit()
        return 'OK'

    async def save_access(self, actor_id: UUID, target_id: UUID,
                          keys: list[str], role: str):
        # Apply all grants and elevation in one transaction.
        import json
        target_res = await self.session.execute(text('''
            SELECT id,role,approval_status FROM public.admin_users
            WHERE id=:id FOR UPDATE'''), {'id':target_id})
        target = target_res.mappings().one_or_none()
        if not target:return 'NOT_FOUND'
        if target_id==actor_id or target['role']!='ADMIN' or target['approval_status']!='APPROVED':
            return 'PROTECTED'
        catalog_res = await self.session.execute(text('''
            SELECT permission_key FROM public.admin_permission_catalog
            WHERE assignable_to_admin=TRUE AND is_active=TRUE'''))
        allowed = {str(v) for v in catalog_res.scalars().all()}
        chosen = {str(k) for k in keys}
        if len(chosen)!=len(keys) or not chosen.issubset(allowed) or not allowed:
            return 'INVALID_PERMISSIONS'
        if role=='SUPER_ADMIN' and chosen!=allowed:
            return 'REQUIRES_ALL'
        old_res = await self.session.execute(text('''
            SELECT permission_key FROM public.admin_permission_assignments
            WHERE admin_id=:target AND is_granted=TRUE'''),{'target':target_id})
        before=sorted(old_res.scalars().all())
        for key in sorted(allowed):
            await self.session.execute(text('''
                INSERT INTO public.admin_permission_assignments
                    (admin_id,permission_key,is_granted,granted_by_super_admin_id)
                VALUES (:target,:key,:granted,:actor)
                ON CONFLICT (admin_id,permission_key) DO UPDATE
                SET is_granted=EXCLUDED.is_granted,
                    granted_by_super_admin_id=EXCLUDED.granted_by_super_admin_id,
                    modified_at=now()'''),
                {'target':target_id,'key':key,'granted':key in chosen,'actor':actor_id})
        if role=='SUPER_ADMIN':
            await self.session.execute(text('''
                UPDATE public.admin_users SET role='SUPER_ADMIN',modified_by=:actor
                WHERE id=:id'''),{'id':target_id,'actor':actor_id})
        await self.session.execute(text('''
            INSERT INTO public.admin_audit_logs
                (admin_id,action,entity_table,entity_id,before_value,after_value,created_by)
            VALUES (:actor,'ADMIN_ACCESS_CONFIGURED','admin_users',:target,
                    CAST(:before AS jsonb),CAST(:after AS jsonb),:actor)'''),
            {'actor':actor_id,'target':target_id,
             'before':json.dumps({'role':target['role'],'permissions':before}),
             'after':json.dumps({'role':role,'permissions':sorted(chosen)})})
        await self.session.commit()
        return 'OK'

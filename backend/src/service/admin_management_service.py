from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from src.repository.admin_management_repository import AdminManagementRepository
from src.service.admin_service import AdminService
from src.repository.admin_repository import AdminRepository
from src.utils.supabase_auth import VerifiedIdentity


class AdminManagementService:
    def __init__(self, repository: AdminManagementRepository, session):
        self.repository = repository
        self.auth_service = AdminService(AdminRepository(session))

    async def application(self, identity: VerifiedIdentity, full_name: str):
        if not identity.email or not identity.email_verified:
            raise HTTPException(403, 'A verified email address is required')
        previous = await self.repository.application_by_auth_user(identity.user_id)
        if previous:
            raise HTTPException(409, 'An admin application already exists')
        try:
            created = await self.repository.create_application(
                identity.user_id, identity.email, full_name.strip(),
            )
        except IntegrityError as exc:
            raise HTTPException(409, 'An admin application already exists') from exc
        if created is None:
            raise HTTPException(409, 'An admin application already exists')
        return dict(created)

    async def application_status(self, identity: VerifiedIdentity):
        row = await self.repository.application_by_auth_user(identity.user_id)
        return dict(row) if row else {'approval_status': 'NOT_APPLIED'}

    async def super_admin(self, identity: VerifiedIdentity):
        admin = await self.auth_service.approved_admin(identity.user_id)
        if admin.role != 'SUPER_ADMIN':
            raise HTTPException(403, 'Super Admin required')
        return admin

    async def pending(self, identity: VerifiedIdentity):
        await self.super_admin(identity)
        return await self.repository.pending_applications()

    async def decision(self, identity: VerifiedIdentity, target_id: UUID,
                       decision: str, reason: str | None):
        actor = await self.super_admin(identity)
        result = await self.repository.decide(actor.id, target_id, decision, reason)
        errors = {
            'NOT_FOUND': (404, 'Admin application not found'),
            'PROTECTED': (403, 'Super Admin account is protected'),
            'NO_CHANGE': (409, 'No status change'),
            'INVALID_TRANSITION': (409, 'Unsupported approval transition'),
        }
        if result in errors:
            status, message = errors[result]
            raise HTTPException(status, message)
        return {'id': str(target_id), 'approval_status': decision}

    async def permission(self, identity: VerifiedIdentity, target_id: UUID,
                         key: str, is_granted: bool):
        actor = await self.super_admin(identity)
        result = await self.repository.set_permission(actor.id, target_id, key, is_granted)
        errors = {
            'NOT_FOUND': (404, 'Admin not found'),
            'TARGET_NOT_APPROVED_ADMIN': (403, 'Target must be an approved regular Admin'),
            'NOT_ASSIGNABLE': (403, 'Permission cannot be assigned to a regular Admin'),
            'NO_CHANGE': (409, 'Permission is already in that state'),
        }
        if result in errors:
            status, message = errors[result]
            raise HTTPException(status, message)
        return {'admin_id': str(target_id), 'permission_key': key, 'is_granted': is_granted}

    async def save_access(self, identity: VerifiedIdentity, target_id: UUID,
                          permission_keys: list[str], role: str):
        actor = await self.super_admin(identity)
        result = await self.repository.save_access(actor.id, target_id,
                                                   permission_keys, role)
        errors = {
            'NOT_FOUND': (404, 'Admin not found'),
            'PROTECTED': (403, 'Protected administrator cannot be changed'),
            'INVALID_PERMISSIONS': (422, 'Invalid or unavailable permissions'),
            'REQUIRES_ALL': (422, 'Super Admin promotion requires all assignable permissions'),
        }
        if result in errors:
            status, message = errors[result]
            raise HTTPException(status, message)
        return {'admin_id': str(target_id), 'role': role,
                'permissions_saved': len(set(permission_keys))}

from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db_session
from src.utils.supabase_auth import get_verified_identity, VerifiedIdentity
from src.repository.query_utils import one, many

async def current_admin(identity: VerifiedIdentity = Depends(get_verified_identity),
                        db: AsyncSession = Depends(get_db_session)) -> dict:
    admin = await one(db, '''SELECT id,auth_user_id,email,full_name,role,approval_status
                            FROM public.admin_users WHERE auth_user_id=:uid''',{'uid':identity.user_id})
    if not admin or admin['approval_status']!='APPROVED':
        raise HTTPException(403,'Admin account is not approved')
    return admin

async def permissions(db: AsyncSession, admin: dict) -> set[str]:
    if admin['role']=='SUPER_ADMIN':
        rows=await many(db,'''SELECT permission_key FROM public.admin_permission_catalog
                              WHERE is_active=TRUE''')
    else:
        rows=await many(db,'''SELECT c.permission_key FROM public.admin_permission_catalog c
         JOIN public.admin_permission_assignments a ON a.permission_key=c.permission_key
         WHERE a.admin_id=:id AND a.is_granted AND c.is_active AND c.assignable_to_admin''',{'id':admin['id']})
    return {r['permission_key'] for r in rows}

async def require(db: AsyncSession, admin: dict, *keys: str):
    if admin['role']=='SUPER_ADMIN':
        return
    allowed=await permissions(db,admin)
    if not set(keys).issubset(allowed):
        raise HTTPException(403,'Missing permission: '+', '.join(sorted(set(keys)-allowed)))

def require_super(admin:dict):
    if admin['role']!='SUPER_ADMIN':
        raise HTTPException(403,'Super Admin only')

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db_session
from src.controllers import admin_management_controller as controller
from src.models.admin_requests import ApplyForAdmin, ReviewAdmin, SetPermission, SaveAdminAccess
from src.utils.supabase_auth import VerifiedIdentity, get_verified_identity

router = APIRouter(prefix='/admin', tags=['Admin Applications & Permissions'])


@router.post('/apply')
async def apply_admin(payload: ApplyForAdmin,
                      identity: VerifiedIdentity = Depends(get_verified_identity),
                      session: AsyncSession = Depends(get_db_session)):
    return await controller.apply(identity, session, payload)


@router.get('/application-status')
async def get_application_status(
        identity: VerifiedIdentity = Depends(get_verified_identity),
        session: AsyncSession = Depends(get_db_session)):
    return await controller.status(identity, session)


@router.get('/applications/pending')
async def pending_applications(
        identity: VerifiedIdentity = Depends(get_verified_identity),
        session: AsyncSession = Depends(get_db_session)):
    return await controller.pending(identity, session)


@router.patch('/applications/{admin_id}')
async def review_admin_application(
        admin_id: UUID, payload: ReviewAdmin,
        identity: VerifiedIdentity = Depends(get_verified_identity),
        session: AsyncSession = Depends(get_db_session)):
    return await controller.decide(identity, session, admin_id, payload)


@router.put('/{admin_id}/permissions/{permission_key}')
async def update_admin_permission(
        admin_id: UUID, permission_key: str, payload: SetPermission,
        identity: VerifiedIdentity = Depends(get_verified_identity),
        session: AsyncSession = Depends(get_db_session)):
    return await controller.permission(identity, session, admin_id, permission_key, payload)


@router.put('/{admin_id}/access')
async def save_admin_access(
        admin_id: UUID, payload: SaveAdminAccess,
        identity: VerifiedIdentity = Depends(get_verified_identity),
        session: AsyncSession = Depends(get_db_session)):
    return await controller.save_access(identity, session, admin_id, payload)

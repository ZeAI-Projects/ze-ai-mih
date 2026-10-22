from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db_session
from src.controllers import admin_controller
from src.utils.supabase_auth import VerifiedIdentity, get_verified_identity

router = APIRouter(prefix='/admin', tags=['Admin Authentication'])


@router.get('/me')
async def get_admin_profile(
    identity: VerifiedIdentity = Depends(get_verified_identity),
    session: AsyncSession = Depends(get_db_session),
):
    return await admin_controller.my_profile(identity, session)


@router.get('/permissions')
async def get_admin_permissions(
    identity: VerifiedIdentity = Depends(get_verified_identity),
    session: AsyncSession = Depends(get_db_session),
):
    return await admin_controller.my_permissions(identity, session)

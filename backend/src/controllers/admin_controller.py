from sqlalchemy.ext.asyncio import AsyncSession

from src.models.schemas import AdminProfile, PermissionList
from src.repository.admin_repository import AdminRepository
from src.service.admin_service import AdminService
from src.utils.helper_utils import success
from src.utils.supabase_auth import VerifiedIdentity


async def my_profile(identity: VerifiedIdentity, session: AsyncSession) -> dict:
    service = AdminService(AdminRepository(session))
    admin = await service.approved_admin(identity.user_id)
    return success(AdminProfile.model_validate(admin).model_dump(mode='json'))


async def my_permissions(identity: VerifiedIdentity, session: AsyncSession) -> dict:
    service = AdminService(AdminRepository(session))
    admin = await service.approved_admin(identity.user_id)
    keys = await service.permissions(admin)
    result = PermissionList(role=admin.role, permissions=keys)
    return success(result.model_dump())

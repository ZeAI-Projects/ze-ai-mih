from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.models.admin_requests import ApplyForAdmin, ReviewAdmin, SetPermission, SaveAdminAccess
from src.repository.admin_management_repository import AdminManagementRepository
from src.service.admin_management_service import AdminManagementService
from src.utils.helper_utils import success
from src.utils.supabase_auth import VerifiedIdentity


def service(session: AsyncSession):
    return AdminManagementService(AdminManagementRepository(session), session)


async def apply(identity: VerifiedIdentity, session: AsyncSession, payload: ApplyForAdmin):
    return success(await service(session).application(identity, payload.full_name),
                   'Admin application submitted for review')


async def status(identity: VerifiedIdentity, session: AsyncSession):
    return success(await service(session).application_status(identity))


async def pending(identity: VerifiedIdentity, session: AsyncSession):
    return success(await service(session).pending(identity))


async def decide(identity: VerifiedIdentity, session: AsyncSession, target_id: UUID,
                 payload: ReviewAdmin):
    return success(await service(session).decision(
        identity, target_id, payload.decision.value, payload.reason,
    ))


async def permission(identity: VerifiedIdentity, session: AsyncSession,
                     target_id: UUID, key: str, payload: SetPermission):
    return success(await service(session).permission(identity, target_id,
                                                   key.upper(), payload.is_granted))


async def save_access(identity: VerifiedIdentity, session: AsyncSession,
                      target_id: UUID, payload: SaveAdminAccess):
    return success(await service(session).save_access(
        identity, target_id, payload.permission_keys, payload.role))

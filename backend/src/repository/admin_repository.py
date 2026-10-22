from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.admin import AdminPermissionAssignment, AdminPermissionCatalog, AdminUser


class AdminRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def by_auth_user_id(self, auth_user_id: UUID) -> AdminUser | None:
        return await self.session.scalar(
            select(AdminUser).where(AdminUser.auth_user_id == auth_user_id)
        )

    async def permission_keys(self, admin: AdminUser) -> list[str]:
        statement = select(AdminPermissionCatalog.permission_key).where(
            AdminPermissionCatalog.is_active.is_(True)
        )
        if admin.role != 'SUPER_ADMIN':
            statement = statement.join(
                AdminPermissionAssignment,
                AdminPermissionAssignment.permission_key == AdminPermissionCatalog.permission_key,
            ).where(
                AdminPermissionAssignment.admin_id == admin.id,
                AdminPermissionAssignment.is_granted.is_(True),
                AdminPermissionCatalog.assignable_to_admin.is_(True),
            )
        statement = statement.order_by(
            AdminPermissionCatalog.sort_order,
            AdminPermissionCatalog.permission_key,
        )
        result = await self.session.execute(statement)
        return list(result.scalars().all())

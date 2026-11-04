from uuid import UUID

from fastapi import HTTPException

from src.models.admin import AdminUser
from src.repository.admin_repository import AdminRepository


class AdminService:
    def __init__(self, repository: AdminRepository):
        self.repository = repository

    async def approved_admin(self, auth_user_id: UUID) -> AdminUser:
        admin = await self.repository.by_auth_user_id(auth_user_id)
        if admin is None or admin.approval_status != 'APPROVED':
            # Do not expose whether the email has an admin application.
            raise HTTPException(status_code=403, detail='Admin access not approved')
        if admin.role not in {'SUPER_ADMIN', 'ADMIN'}:
            raise HTTPException(status_code=403, detail='Admin role not recognized')
        return admin

    async def permissions(self, admin: AdminUser) -> list[str]:
        return await self.repository.permission_keys(admin)

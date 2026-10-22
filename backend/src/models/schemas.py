from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AdminProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    full_name: str
    email: str
    role: str
    approval_status: str
    approved_at: datetime | None = None


class PermissionList(BaseModel):
    role: str
    permissions: list[str]

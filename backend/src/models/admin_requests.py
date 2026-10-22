from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ApplyForAdmin(BaseModel):
    model_config = ConfigDict(extra='forbid')
    full_name: str = Field(min_length=2, max_length=200)


class ApprovalDecision(str, Enum):
    APPROVED = 'APPROVED'
    REJECTED = 'REJECTED'
    SUSPENDED = 'SUSPENDED'


class ReviewAdmin(BaseModel):
    model_config = ConfigDict(extra='forbid')
    decision: ApprovalDecision
    reason: str | None = Field(default=None, max_length=1000)


class SetPermission(BaseModel):
    model_config = ConfigDict(extra='forbid')
    is_granted: bool


class AdminApplicationResult(BaseModel):
    id: UUID
    full_name: str
    email: str
    role: str
    approval_status: str


class SaveAdminAccess(BaseModel):
    model_config = ConfigDict(extra='forbid')
    permission_keys: list[str] = Field(max_length=150)
    role: str = Field(pattern=r'^(ADMIN|SUPER_ADMIN)$')

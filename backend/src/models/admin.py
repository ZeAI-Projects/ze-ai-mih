from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Uuid
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class AdminUser(Base):
    __tablename__ = 'admin_users'
    __table_args__ = {'schema': 'public'}

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True)
    auth_user_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(254), nullable=False)
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    approval_status: Mapped[str] = mapped_column(String(30), nullable=False)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AdminPermissionCatalog(Base):
    __tablename__ = 'admin_permission_catalog'
    __table_args__ = {'schema': 'public'}

    permission_key: Mapped[str] = mapped_column(String(80), primary_key=True)
    module_key: Mapped[str] = mapped_column(String(40), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False)
    assignable_to_admin: Mapped[bool] = mapped_column(Boolean, nullable=False)
    sort_order: Mapped[int] = mapped_column(nullable=False)


class AdminPermissionAssignment(Base):
    __tablename__ = 'admin_permission_assignments'
    __table_args__ = {'schema': 'public'}

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True)
    admin_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey('public.admin_users.id'))
    permission_key: Mapped[str] = mapped_column(String(80), ForeignKey('public.admin_permission_catalog.permission_key'))
    is_granted: Mapped[bool] = mapped_column(Boolean, nullable=False)

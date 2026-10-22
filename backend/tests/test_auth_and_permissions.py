from dataclasses import dataclass
from uuid import uuid4

from fastapi.testclient import TestClient

from database import get_db_session
from main import app
from src.repository.admin_repository import AdminRepository
from src.utils.supabase_auth import VerifiedIdentity, get_verified_identity

USER_ID = uuid4()
ADMIN_ID = uuid4()


@dataclass
class FakeAdmin:
    id: object = ADMIN_ID
    auth_user_id: object = USER_ID
    full_name: str = 'Test Admin'
    email: str = 'admin@example.test'
    role: str = 'SUPER_ADMIN'
    approval_status: str = 'APPROVED'
    approved_at: object = None


async def fake_identity():
    return VerifiedIdentity(user_id=USER_ID, email='admin@example.test')


async def fake_session():
    yield object()


def configure(monkeypatch, *, role='SUPER_ADMIN', status='APPROVED', permissions=None):
    admin = FakeAdmin(role=role, approval_status=status)

    async def by_auth_user_id(self, auth_user_id):
        assert auth_user_id == USER_ID
        return admin

    async def permission_keys(self, found_admin):
        if found_admin.role == 'SUPER_ADMIN':
            return ['SITE_PUBLISH', 'ADMIN_PERMISSIONS_MANAGE']
        return permissions or []

    monkeypatch.setattr(AdminRepository, 'by_auth_user_id', by_auth_user_id)
    monkeypatch.setattr(AdminRepository, 'permission_keys', permission_keys)
    app.dependency_overrides[get_verified_identity] = fake_identity
    app.dependency_overrides[get_db_session] = fake_session
    return TestClient(app)


def teardown_function():
    app.dependency_overrides.clear()


def test_super_admin_can_read_profile_and_effective_permissions(monkeypatch):
    client = configure(monkeypatch)
    response = client.get('/api/v1/admin/me')
    assert response.status_code == 200
    assert response.json()['data']['role'] == 'SUPER_ADMIN'
    response = client.get('/api/v1/admin/permissions')
    assert response.status_code == 200
    assert 'SITE_PUBLISH' in response.json()['data']['permissions']


def test_unapproved_admin_is_blocked(monkeypatch):
    client = configure(monkeypatch, role='ADMIN', status='PENDING')
    assert client.get('/api/v1/admin/me').status_code == 403
    assert client.get('/api/v1/admin/permissions').status_code == 403


def test_regular_admin_only_sees_granted_permissions(monkeypatch):
    client = configure(monkeypatch, role='ADMIN', permissions=['SITE_PREVIEW'])
    response = client.get('/api/v1/admin/permissions')
    assert response.status_code == 200
    assert response.json()['data']['permissions'] == ['SITE_PREVIEW']


def test_no_token_is_rejected():
    client = TestClient(app)
    response = client.get('/api/v1/admin/me')
    assert response.status_code == 401

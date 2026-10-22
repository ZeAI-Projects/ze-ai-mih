from dataclasses import dataclass
from uuid import uuid4

from fastapi.testclient import TestClient

from database import get_db_session
from main import app
from src.repository.admin_repository import AdminRepository
from src.repository.admin_management_repository import AdminManagementRepository
from src.utils.supabase_auth import VerifiedIdentity, get_verified_identity

USER_ID = uuid4()
ADMIN_ID = uuid4()
TARGET_ID = uuid4()


@dataclass
class FakeAdmin:
    id: object = ADMIN_ID
    role: str = 'SUPER_ADMIN'
    approval_status: str = 'APPROVED'


async def fake_session():
    yield object()


def build_client(monkeypatch, *, role='SUPER_ADMIN', status='APPROVED', verified=True):
    async def identity():
        return VerifiedIdentity(user_id=USER_ID, email='person@example.test',
                                email_verified=verified)

    async def found_admin(self, user_id):
        assert user_id == USER_ID
        return FakeAdmin(role=role, approval_status=status)

    monkeypatch.setattr(AdminRepository, 'by_auth_user_id', found_admin)
    app.dependency_overrides[get_verified_identity] = identity
    app.dependency_overrides[get_db_session] = fake_session
    return TestClient(app)


def teardown_function():
    app.dependency_overrides.clear()


def test_pending_person_can_apply_only_as_admin(monkeypatch):
    client = build_client(monkeypatch, role='ADMIN', status='PENDING')
    async def existing(self, uid):
        return None
    async def create(self, user_id, email, full_name):
        return {'id': TARGET_ID, 'email': email, 'full_name': full_name,
                'role': 'ADMIN', 'approval_status': 'PENDING'}
    monkeypatch.setattr(AdminManagementRepository, 'application_by_auth_user', existing)
    monkeypatch.setattr(AdminManagementRepository, 'create_application', create)
    response = client.post('/api/v1/admin/apply', json={'full_name': 'Test Applicant'})
    assert response.status_code == 200
    assert response.json()['data']['approval_status'] == 'PENDING'
    assert response.json()['data']['role'] == 'ADMIN'
    assert client.get('/api/v1/admin/me').status_code == 403


def test_signup_rejects_unverified_email(monkeypatch):
    client = build_client(monkeypatch, verified=False)
    assert client.post('/api/v1/admin/apply',json={'full_name': 'Unverified'}).status_code == 403


def test_signup_cannot_self_assign_super_admin(monkeypatch):
    client = build_client(monkeypatch)
    response = client.post('/api/v1/admin/apply',json={
        'full_name':'Test Applicant','role':'SUPER_ADMIN', 'approval_status':'APPROVED'})
    assert response.status_code == 422


def test_normal_admin_cannot_approve(monkeypatch):
    client = build_client(monkeypatch, role='ADMIN')
    response = client.patch(f'/api/v1/admin/applications/{TARGET_ID}',json={'decision':'APPROVED'})
    assert response.status_code == 403


def test_normal_admin_cannot_grant_permissions(monkeypatch):
    client = build_client(monkeypatch, role='ADMIN')
    response = client.put(f'/api/v1/admin/{TARGET_ID}/permissions/SITE_PREVIEW',
                          json={'is_granted':True})
    assert response.status_code == 403


def test_super_admin_approves_application(monkeypatch):
    client = build_client(monkeypatch)
    async def decide(self, actor, target, decision, reason):
        assert actor == ADMIN_ID
        assert target == TARGET_ID
        assert decision == 'APPROVED'
        return 'OK'
    monkeypatch.setattr(AdminManagementRepository,'decide',decide)
    response=client.patch(f'/api/v1/admin/applications/{TARGET_ID}',json={'decision':'APPROVED'})
    assert response.status_code == 200
    assert response.json()['data']['approval_status'] == 'APPROVED'


def test_super_admin_can_grant_assignable_permissions(monkeypatch):
    client = build_client(monkeypatch)
    async def set_perm(self, actor, target, key, granted):
        assert actor == ADMIN_ID
        assert target == TARGET_ID
        assert key == 'SITE_PREVIEW'
        assert granted
        return 'OK'
    monkeypatch.setattr(AdminManagementRepository,'set_permission',set_perm)
    response=client.put(f'/api/v1/admin/{TARGET_ID}/permissions/site_preview',
                        json={'is_granted':True})
    assert response.status_code == 200
    assert response.json()['data']['permission_key'] == 'SITE_PREVIEW'


def test_nonassignable_permission_is_blocked(monkeypatch):
    client = build_client(monkeypatch)
    async def set_perm(self, actor, target, key, granted):
        return 'NOT_ASSIGNABLE'
    monkeypatch.setattr(AdminManagementRepository,'set_permission',set_perm)
    response=client.put(f'/api/v1/admin/{TARGET_ID}/permissions/PAYMENT_CONFIGURE',
                        json={'is_granted':True})
    assert response.status_code == 403


def test_unauthed_cannot_apply():
    client = TestClient(app)
    assert client.post('/api/v1/admin/apply',json={'full_name':'Someone'}).status_code==401


def test_application_status_only_shows_current_account(monkeypatch):
    client=build_client(monkeypatch, role='ADMIN',status='PENDING')
    async def existing(self,uid):
        assert uid == USER_ID
        return {'id': TARGET_ID, 'email':'person@example.test','role':'ADMIN',
                'approval_status':'PENDING','full_name':'Test Admin'}
    monkeypatch.setattr(AdminManagementRepository,'application_by_auth_user',existing)
    resp=client.get('/api/v1/admin/application-status')
    assert resp.status_code==200
    assert resp.json()['data']['approval_status']=='PENDING'

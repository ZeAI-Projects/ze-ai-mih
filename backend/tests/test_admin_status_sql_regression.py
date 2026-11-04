"""Regression tests for PostgreSQL parameter typing in admin/payment decisions.

The previous SQL bound :status both as varchar (column assignment) and as text
(CASE comparisons), causing psycopg.errors.AmbiguousParameter during approval.
These checks exercise both statement construction and decision flow without
making any live Supabase changes.
"""

import asyncio
from types import SimpleNamespace
from uuid import uuid4

import pytest

from src.repository.admin_management_repository import AdminManagementRepository
from src.service import operations_service


class _Result:
    def __init__(self, row=None):
        self.row = row

    def mappings(self):
        return self

    def one_or_none(self):
        return self.row


class _Session:
    def __init__(self, row):
        self.row = row
        self.statements = []
        self.commits = 0

    async def execute(self, statement, parameters=None):
        self.statements.append((str(statement), parameters or {}))
        if 'SELECT id, role, approval_status FROM public.admin_users' in str(statement):
            return _Result(self.row)
        return _Result()

    async def commit(self):
        self.commits += 1


@pytest.mark.parametrize('decision', ['APPROVED', 'REJECTED'])
def test_admin_review_uses_one_explicit_parameter_type(decision):
    actor, target = uuid4(), uuid4()
    session = _Session({'id': target, 'role': 'ADMIN', 'approval_status': 'PENDING'})
    result = asyncio.run(AdminManagementRepository(session).decide(actor, target, decision, None))

    assert result == 'OK'
    assert session.commits == 1
    update, parameters = next((sql, params) for sql, params in session.statements
                              if 'UPDATE public.admin_users' in sql)
    assert update.count('CAST(:status AS text)') == 3
    assert 'approval_status=:status' not in update
    assert parameters['status'] == decision
    assert any('INSERT INTO public.admin_approval_history' in sql for sql, _ in session.statements)
    assert any('INSERT INTO public.admin_audit_logs' in sql for sql, _ in session.statements)


@pytest.mark.parametrize('decision', ['VERIFIED', 'REJECTED'])
def test_payment_review_uses_one_explicit_parameter_type(monkeypatch, decision):
    statements = []
    async def fake_one(db, sql, parameters):
        statements.append((sql, parameters))
        if sql.lstrip().startswith('SELECT'):
            return {'id': payment_id, 'registration_id': uuid4(), 'status': 'PENDING'}
        return {'id': payment_id, 'status': decision}

    async def fake_audit(*args, **kwargs):
        return None

    async def fake_scalar(db, sql, parameters):
        return 'SUBMITTED'
    monkeypatch.setattr(operations_service, 'scalar', fake_scalar)
    monkeypatch.setattr(operations_service, 'one', fake_one)
    monkeypatch.setattr(operations_service, 'audit', fake_audit)
    payment_id = uuid4()
    session = _Session(None)
    admin = {'id': uuid4(), 'role': 'SUPER_ADMIN'}
    payload = SimpleNamespace(status=decision,
                              rejection_reason='Invalid proof' if decision == 'REJECTED' else None)
    result = asyncio.run(operations_service.review_payment(session, admin, payment_id, payload))

    assert result['status'] == decision
    assert session.commits == 1
    update, parameters = next((sql, params) for sql, params in statements
                              if sql.lstrip().startswith('UPDATE'))
    assert update.count('CAST(:status AS text)') == 4
    assert 'status=:status' not in update
    assert parameters['status'] == decision

"""Challenge API contract, validation, permissions and transaction auditing; no live DB."""
import asyncio
from uuid import uuid4
from unittest.mock import AsyncMock
import pytest
from fastapi import FastAPI, HTTPException, Response
from fastapi.testclient import TestClient
from pydantic import ValidationError
from database import get_db_session
from src.routes import problem_statement_routes as routes


def payload(**extra):
    return dict(edition_id=uuid4(), domain_id=uuid4(), track_id=uuid4(), statement_code='CHALLENGE_1', title='A useful challenge', **extra)


@pytest.mark.parametrize('extra', [{'title': '<script>x</script>'}, {'title': ' '}, {'status': 'LIVE'}, {'display_order': -1}, {'unexpected': 'field'}, {'statement_code': "x'; DROP TABLE domains;--"}])
def test_input_rejects_markup_and_unknown_fields(extra):
    data = payload(); data.update(extra)
    with pytest.raises(ValidationError): routes.StatementInput(**data)


def test_public_query_validation():
    app = FastAPI(); app.include_router(routes.router)
    async def db(): yield object()
    app.dependency_overrides[get_db_session] = db
    app.dependency_overrides[routes.require_challenge_schema] = lambda: None
    with TestClient(app) as client:
        for query in ['page=0', 'page_size=51', 'domain_id=invalid', 'track_code=UNKNOWN', 'edition_code=bad-code']:
            assert client.get('/public/problem-statements?' + query).status_code == 422


def test_missing_schema_is_safe_service_state(monkeypatch):
    monkeypatch.setattr(routes, 'one', AsyncMock(return_value={'tracks': None, 'statements': None}))
    with pytest.raises(HTTPException) as exc:
        asyncio.run(routes.require_challenge_schema(AsyncMock()))
    assert exc.value.status_code == 503
    assert exc.value.detail['code'] == 'CHALLENGE_SCHEMA_MISSING'
    assert exc.value.headers['Cache-Control'] == 'no-store'


def test_schema_connection_error_is_sanitized(monkeypatch):
    from sqlalchemy.exc import SQLAlchemyError
    monkeypatch.setattr(routes, 'one', AsyncMock(side_effect=SQLAlchemyError('private connection details')))
    db = AsyncMock()
    with pytest.raises(HTTPException) as exc:
        asyncio.run(routes.require_challenge_schema(db))
    assert exc.value.status_code == 503
    assert 'private' not in str(exc.value.detail)
    db.rollback.assert_awaited_once()


def test_public_filter_and_bounded_results(monkeypatch):
    monkeypatch.setattr(routes, 'public_edition', AsyncMock(return_value=uuid4()))
    monkeypatch.setattr(routes, 'one', AsyncMock(return_value={'total': 1}))
    rows = AsyncMock(return_value=[{'title': 'Published'}]); monkeypatch.setattr(routes, 'many', rows)
    response = Response()
    result = asyncio.run(routes.statements(response, 'MIIH_UPCOMING', 'RISING_BUILDERS', uuid4(), 2, 6, object()))
    sql, params = rows.call_args.args[1:]
    for condition in ["p.status='PUBLISHED'", 't.is_active', 'd.is_active', 'ed.is_enabled', 't.code=:track', 'p.domain_id=:domain']:
        assert condition in sql
    assert 'p.description' not in sql
    assert params['offset'] == 6 and params['limit'] == 6
    assert result['total'] == 1
    assert 'max-age=30' in response.headers['Cache-Control']


def test_editor_cannot_publish(monkeypatch):
    monkeypatch.setattr(routes, 'require', AsyncMock())
    with pytest.raises(HTTPException) as exc:
        asyncio.run(routes.save_statement(object(), {'role': 'ADMIN'}, routes.StatementInput(**payload(status='PUBLISHED'))))
    assert exc.value.status_code == 403


def test_draft_save_and_audit_same_transaction(monkeypatch):
    row = {'id': uuid4(), 'status': 'DRAFT'}
    monkeypatch.setattr(routes, 'require', AsyncMock())
    monkeypatch.setattr(routes, 'one', AsyncMock(side_effect=[{'domain_id': uuid4()}, None, row]))
    audit = AsyncMock(); monkeypatch.setattr(routes, 'record', audit)
    db = AsyncMock()
    asyncio.run(routes.save_statement(db, {'role': 'ADMIN', 'id': uuid4()}, routes.StatementInput(**payload())))
    assert audit.await_count == 1 and db.commit.await_count == 1


def test_disabled_domain_cannot_be_authored(monkeypatch):
    monkeypatch.setattr(routes, 'require', AsyncMock())
    monkeypatch.setattr(routes, 'one', AsyncMock(return_value=None))
    db = AsyncMock()
    with pytest.raises(HTTPException) as exc:
        asyncio.run(routes.save_statement(db, {'role': 'SUPER_ADMIN'}, routes.StatementInput(**payload())))
    assert exc.value.status_code == 422
    db.commit.assert_not_awaited()


def test_delete_requires_super_admin():
    with pytest.raises(HTTPException) as exc:
        asyncio.run(routes.delete(uuid4(), AsyncMock(), {'role': 'ADMIN'}))
    assert exc.value.status_code == 403

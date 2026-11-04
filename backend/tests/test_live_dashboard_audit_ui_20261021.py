"""Dashboard review-queue regression tests; never connects to Supabase."""
import pytest
from uuid import uuid4
from src.service import operations_service

@pytest.mark.asyncio
async def test_overview_counts_only_submitted_and_reviewed_teams(monkeypatch):
    scalar_queries=[]
    many_queries=[]
    async def require_stub(db, admin, permission):
        assert permission=='DASHBOARD_VIEW'
    async def scalar_stub(db, sql, params):
        scalar_queries.append(sql)
        return 3
    async def many_stub(db, sql, params):
        many_queries.append(sql)
        return [{'id':str(uuid4()),'team_name':'Example','status':'SUBMITTED','payment_verified':False}]
    monkeypatch.setattr(operations_service,'require',require_stub)
    monkeypatch.setattr(operations_service,'scalar',scalar_stub)
    monkeypatch.setattr(operations_service,'many',many_stub)
    result=await operations_service.overview(None,{'role':'ADMIN'})
    assert result['pending_approvals']==3
    assert len(result['pending_teams'])==1
    assert "r.status IN ('SUBMITTED','REVIEW')" in scalar_queries[2]
    assert "e.edition_code NOT LIKE 'MIIH_TEST_%'" in scalar_queries[2]
    assert "p.status='VERIFIED'" in many_queries[0]
    assert 'LIMIT 8' in many_queries[0]

@pytest.mark.asyncio
async def test_teams_filter_includes_both_approval_statuses(monkeypatch):
    calls=[]
    async def require_stub(db,admin,permission):
        assert permission=='TEAMS_VIEW'
    async def many_stub(db,sql,params):
        calls.append((sql,params))
        return []
    monkeypatch.setattr(operations_service,'require',require_stub)
    monkeypatch.setattr(operations_service,'many',many_stub)
    await operations_service.teams(None,{'role':'ADMIN'},status='PENDING_APPROVAL')
    sql,params=calls[0]
    assert "CAST(:status AS text)='PENDING_APPROVAL'" in sql
    assert "r.status IN ('SUBMITTED','REVIEW')" in sql
    assert params['status']=='PENDING_APPROVAL'
    assert 'LIMIT :max' in sql

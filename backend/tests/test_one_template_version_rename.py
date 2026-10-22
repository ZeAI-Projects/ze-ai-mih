"""Regression tests for the one-template form-version workflow."""
from uuid import uuid4
import pytest
from fastapi import HTTPException
from src.models.admin_ops_requests import FormVersionRename
from src.service import form_service

ACTOR={'id':uuid4(),'role':'ADMIN'}
VERSION_ID=uuid4()

@pytest.mark.asyncio
async def test_draft_rename_requires_form_edit_and_writes_audit(monkeypatch):
    seen=[]
    async def fake_one(db, sql, params):
        seen.append((sql,params))
        if 'SELECT id, name, status, version_number' in sql:
            return {'id':VERSION_ID,'name':'Form v5','status':'DRAFT','version_number':5}
        return {'id':VERSION_ID,'name':'New draft name','status':'DRAFT','version_number':5}
    async def fake_require(db, actor, permission):
        assert permission=='FORM_EDIT'
    async def fake_record(db, actor, action, table, id, before=None, after=None):
        assert action=='FORM_VERSION_RENAMED'
        assert before['name']=='Form v5' and after['name']=='New draft name'
    class DB:
        async def commit(self):seen.append(('COMMIT',None))
    monkeypatch.setattr(form_service,'one',fake_one)
    monkeypatch.setattr(form_service,'require',fake_require)
    monkeypatch.setattr(form_service,'record',fake_record)
    result=await form_service.rename_version(DB(),ACTOR,VERSION_ID,FormVersionRename(name='  New draft name  '))
    assert result['name']=='New draft name'
    assert sum('COMMIT' in x for x,_ in seen)==1

@pytest.mark.asyncio
async def test_published_requires_super_admin(monkeypatch):
    async def fake_one(db, sql, params):
        return {'id':VERSION_ID,'name':'Published form','status':'PUBLISHED','version_number':5}
    monkeypatch.setattr(form_service,'one',fake_one)
    with pytest.raises(HTTPException) as err:
        await form_service.rename_version(None,ACTOR,VERSION_ID,FormVersionRename(name='New public name'))
    assert err.value.status_code==403

@pytest.mark.asyncio
async def test_published_super_admin_can_rename(monkeypatch):
    calls=[]
    async def fake_one(db, sql, params):
        calls.append(sql)
        if 'SELECT id, name, status, version_number' in sql:
            return {'id':VERSION_ID,'name':'Live name','status':'PUBLISHED','version_number':5}
        return {'id':VERSION_ID,'name':'New live name','status':'PUBLISHED','version_number':5}
    async def fake_record(*args,**kwargs):calls.append('audit')
    class DB:
        async def commit(self):calls.append('commit')
    monkeypatch.setattr(form_service,'one',fake_one)
    monkeypatch.setattr(form_service,'record',fake_record)
    result=await form_service.rename_version(DB(),{'id':uuid4(),'role':'SUPER_ADMIN'},VERSION_ID,FormVersionRename(name='New live name'))
    assert result['name']=='New live name'
    assert 'audit' in calls and 'commit' in calls


def test_rename_name_validation():
    from pydantic import ValidationError
    with pytest.raises(ValidationError): FormVersionRename(name='')
    with pytest.raises(ValidationError): FormVersionRename(name='x'*151)

from io import BytesIO
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4
import pytest
from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers
from pydantic import ValidationError
from config import Settings
from src.models.registration_requests import Member, Answer
from src.service import storage_service as storage
from src.service import media_library_service as media

def test_new_secret_is_not_sent_as_jwt():
    assert storage.server_headers(SimpleNamespace(storage_server_key='sb_secret_example')) == {'apikey':'sb_secret_example'}
    assert storage.server_headers(SimpleNamespace(storage_server_key='legacy.jwt.key'))['Authorization']=='Bearer legacy.jwt.key'

def test_configuration_supports_both_keys_without_repr_leak():
    s=Settings(_env_file=None,supabase_url='https://example.supabase.co',supabase_publishable_key='public',database_url='unused',supabase_secret_key='sb_secret_example',supabase_service_role_key='legacy')
    assert s.storage_server_key=='sb_secret_example'
    assert 'sb_secret_example' not in repr(s)

@pytest.mark.parametrize('email,mobile',[('invalid','1234567890'),('name@example.com','abcdefghi')])
def test_invalid_member_contacts(email,mobile):
    with pytest.raises(ValidationError):Member(full_name='Team Leader',email=email,mobile=mobile)

def test_explicit_answer_removal():
    assert Answer(question_id=uuid4(),clear=True).clear
    with pytest.raises(ValidationError):Answer(question_id=uuid4(),clear=True,value='value')

@pytest.mark.asyncio
async def test_upload_rejects_forged_image_before_storage():
    file=UploadFile(BytesIO(b'<html>not a photo</html>'),filename='photo.png',headers=Headers({'content-type':'image/png'}))
    with pytest.raises(HTTPException) as exc:
        await storage.upload(None,bucket=storage.PRIVATE,file=file)
    assert exc.value.status_code==422

@pytest.mark.asyncio
async def test_private_upload_returns_database_asset(monkeypatch):
    monkeypatch.setattr(storage,'get_settings',lambda:SimpleNamespace(storage_server_key='sb_secret_example',supabase_url='https://example.supabase.co'))
    client=AsyncMock();client.post.return_value=SimpleNamespace(status_code=201)
    manager=AsyncMock();manager.__aenter__.return_value=client
    monkeypatch.setattr(storage.httpx,'AsyncClient',lambda **kw:manager)
    asset={'id':str(uuid4()),'storage_bucket':storage.PRIVATE,'file_url':None}
    query=AsyncMock(return_value=asset);monkeypatch.setattr(storage,'one',query)
    file=UploadFile(BytesIO(b'\x89PNG\r\n\x1a\nimage'),filename='photo.png',headers=Headers({'content-type':'image/png'}))
    result=await storage.upload(None,bucket=storage.PRIVATE,file=file,registration_id=uuid4())
    assert result==asset
    assert query.call_args.args[2]['private'] is True
    assert 'Authorization' not in client.post.call_args.kwargs['headers']

@pytest.mark.asyncio
async def test_restore_requires_super_admin():
    with pytest.raises(HTTPException) as exc:
        await media.restore_original(None,{'role':'ADMIN'},'item')
    assert exc.value.status_code==403

@pytest.mark.asyncio
async def test_restore_archives_and_audits_without_deleting_assets(monkeypatch):
    monkeypatch.setattr(media,'manifest',lambda:[{'key':'item'}])
    monkeypatch.setattr(media,'one',AsyncMock(return_value={'id':uuid4()}))
    audit=AsyncMock();monkeypatch.setattr(media,'record',audit)
    db=AsyncMock()
    assert await media.restore_original(db,{'role':'SUPER_ADMIN'},'item')=={'restored':True}
    assert 'ARCHIVED' in str(db.execute.call_args.args[0])
    assert 'DELETE' not in str(db.execute.call_args.args[0])
    audit.assert_awaited_once()
    db.commit.assert_awaited_once()

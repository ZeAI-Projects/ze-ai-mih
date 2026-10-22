"""Regression checks for the October registration fix. No external DB access."""
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from src.service.registration_documents import _make_pdf
from src.routes import public_routes, registration_routes


def test_registration_pdf_is_real_pdf():
    data=_make_pdf('Registration confirmation',[
        ('Team ID','MIIH2000'),('Status','SUBMITTED')],
        [{'full_name':'Test Leader','email':'test@example.com','mobile':'1234567890','role':'LEADER'}])
    assert data.startswith(b'%PDF-')
    assert len(data)>1200


@pytest.mark.asyncio
async def test_public_endpoint_blocks_test_edition():
    with pytest.raises(HTTPException) as exc:
        await public_routes.configuration('MIIH_TEST_48H',None)
    assert exc.value.status_code==404


@pytest.mark.asyncio
async def test_test_edition_requires_super_admin():
    with pytest.raises(HTTPException) as exc:
        await public_routes.internal_test_configuration('MIIH_TEST_48H',None,{'role':'ADMIN'})
    assert exc.value.status_code==403


@pytest.mark.asyncio
async def test_missing_super_admin_bearer_is_rejected():
    req=SimpleNamespace(headers={})
    with pytest.raises(HTTPException) as exc:
        await registration_routes._protect_test_edition(None,req,'MIIH_TEST_48H')
    assert exc.value.status_code==401


@pytest.mark.asyncio
async def test_normal_edition_does_not_need_admin_bearer():
    req=SimpleNamespace(headers={})
    assert await registration_routes._protect_test_edition(None,req,'MIIH_UPCOMING') is None

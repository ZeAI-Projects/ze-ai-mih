"""Part 2 regressions use a mocked repository, never a live Supabase project."""
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from src.service import settings_service


@pytest.mark.asyncio
async def test_readiness_lists_exact_registration_blockers(monkeypatch):
    now = datetime.now(timezone.utc)
    responses = [
        {'id': 'edition-id', 'edition_code': 'MIIH_UPCOMING', 'status': 'DRAFT',
         'is_published': False, 'registration_opens_at': now-timedelta(days=1),
         'registration_closes_at': now+timedelta(days=1)},
        None,
        {'fee_amount': 100, 'payment_required': True, 'proof_required': True,
         'razorpay_payment_url': None, 'is_active': False},
    ]
    monkeypatch.setattr(settings_service, 'require', AsyncMock())
    monkeypatch.setattr(settings_service, 'one', AsyncMock(side_effect=responses))
    monkeypatch.setattr(settings_service, 'scalar', AsyncMock(return_value=12))
    info = await settings_service.edition_readiness(None, {'role': 'SUPER_ADMIN'}, 'edition-id')
    assert info['ready'] is False
    flags = {check['key']:check['ok'] for check in info['checks']}
    assert not flags['publication'] and not flags['status']
    assert flags['domains'] and not flags['form'] and not flags['payment']


@pytest.mark.asyncio
async def test_private_test_payment_free_readiness(monkeypatch):
    monkeypatch.setattr(settings_service, 'require', AsyncMock())
    monkeypatch.setattr(settings_service, 'one', AsyncMock(side_effect=[
        {'id':'id', 'edition_code':'MIIH_TEST_48H', 'status':'OPEN', 'is_published':True,
         'registration_opens_at':None, 'registration_closes_at':None},
        {'version_number':1},
        {'fee_amount':0,'payment_required':False,'proof_required':False,
         'razorpay_payment_url':None,'is_active':True},
    ]))
    monkeypatch.setattr(settings_service, 'scalar', AsyncMock(return_value=12))
    info=await settings_service.edition_readiness(None, {'role':'SUPER_ADMIN'},'id')
    assert info['ready'] is True
    assert info['is_internal_test'] is True
    assert all(item['ok'] for item in info['checks'])


@pytest.mark.asyncio
async def test_readiness_unknown_edition(monkeypatch):
    monkeypatch.setattr(settings_service, 'require', AsyncMock())
    monkeypatch.setattr(settings_service, 'one', AsyncMock(return_value=None))
    with pytest.raises(HTTPException) as exc:
        await settings_service.edition_readiness(None, {'role':'SUPER_ADMIN'}, 'missing')
    assert exc.value.status_code==404

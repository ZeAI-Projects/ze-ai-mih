"""Regression checks for the October registration fix. No external DB access."""
import hashlib
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from src.service.registration_documents import _make_pdf
from src.service import registration_service
from src.service.registration_service import validate_unique_member_contacts
from src.routes import public_routes, registration_routes


def test_team_member_contacts_must_be_unique():
    members=[
        SimpleNamespace(email='one@example.com',mobile='+1 (415) 555-0100'),
        SimpleNamespace(email='two@example.com',mobile='14155550100'),
    ]
    with pytest.raises(HTTPException,match='mobile numbers must be unique'):
        validate_unique_member_contacts(members)

def test_team_member_mobile_duplicate_detects_indian_country_prefix():
    members=[
        SimpleNamespace(email='one@example.com',mobile='9876543210'),
        SimpleNamespace(email='two@example.com',mobile='+91 98765-43210'),
    ]
    with pytest.raises(HTTPException,match='mobile numbers must be unique'):
        validate_unique_member_contacts(members)

@pytest.mark.asyncio
async def test_validation_ignores_questions_removed_from_latest_published_form(monkeypatch):
    token='registration-edit-token-that-is-long-enough'
    registration={
        'form_version_id':'legacy-version',
        'edition_id':'edition-id',
        'leader_edit_token_hash':hashlib.sha256(token.encode()).hexdigest(),
    }
    monkeypatch.setattr(
        registration_service.RegistrationRepository,
        'registration',
        AsyncMock(return_value=registration),
    )
    monkeypatch.setattr(
        registration_service,
        'scalar',
        AsyncMock(return_value=[
            'removed_question:member-id',
            'still_required',
            'made_optional',
            'Payment transaction and screenshot are required',
        ]),
    )
    monkeypatch.setattr(registration_service,'one',AsyncMock(return_value={'id':'live-version'}))
    monkeypatch.setattr(registration_service,'many',AsyncMock(side_effect=[
        [{'field_key':'removed_question'},{'field_key':'still_required'},{'field_key':'made_optional'}],
        [{'field_key':'still_required'}],
    ]))

    issues=await registration_service._submission_errors(None,'draft-id',registration)

    assert issues==[
        'still_required',
        'Payment transaction and screenshot are required',
    ]

@pytest.mark.asyncio
async def test_submit_allows_legacy_form_without_removed_question_answer(monkeypatch):
    registration={'form_version_id':'legacy-version','edition_id':'edition-id','edition_code':'MIIH_UPCOMING'}
    monkeypatch.setattr(
        registration_service,
        'authorized_draft',
        AsyncMock(return_value=registration),
    )
    monkeypatch.setattr(
        registration_service,
        'scalar',
        AsyncMock(return_value=['removed_question:member-id']),
    )
    monkeypatch.setattr(
        registration_service,
        'one',
        AsyncMock(side_effect=[
            {'id':'live-version'},
            {
                'team_id':'MIIH2027-001',
                'registration_code':'REG-001',
                'team_name':'Test team',
                'submitted_at':'2026-11-11T00:00:00Z',
            },
        ]),
    )
    monkeypatch.setattr(registration_service,'many',AsyncMock(side_effect=[
        [{'field_key':'removed_question'}],
        [],
    ]))
    db=SimpleNamespace(execute=AsyncMock(),commit=AsyncMock())

    result=await registration_service.submit(db,'draft-id','token')

    assert result['status']=='SUBMITTED'
    assert result['team_id']=='MIIH2027-001'
    db.commit.assert_awaited_once()


def test_registration_pdf_is_real_pdf():
    data=_make_pdf('Registration confirmation',[
        ('Team ID','MIIH2000'),('Status','SUBMITTED')],
        [{'full_name':'Test Leader','email':'test@example.com','mobile':'1234567890','role':'LEADER'}])
    assert data.startswith(b'%PDF-')
    assert len(data)>1200
    assert data.count(b'/Subtype /Image')>=2


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

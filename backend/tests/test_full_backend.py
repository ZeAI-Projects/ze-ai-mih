"""Offline checks; deliberately never contact user's Supabase database."""
import json
from uuid import uuid4
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from types import SimpleNamespace
from unittest.mock import AsyncMock
from main import app
from src.service.settings_service import safe_payment_link,DUMMY_URL,validate_team_size_pricing
from src.service import settings_service
from src.service.export_service import render_excel,render_csv,DEFAULT_COLS
from src.service.payment_pricing import normalize_team_size_pricing,payment_rules_from_config
from src.service import registration_service
from src.service.registration_service import verify_draft_token,payment_rule_for_team_size
from src.service.access_service import require_super
from src.models.admin_ops_requests import PaymentSettingsUpdate,TeamSizePaymentRule
from src.models.registration_requests import PaymentEvidence
from openpyxl import load_workbook
from io import BytesIO
import hashlib


def test_dummy_url_cannot_be_activated():
    assert not safe_payment_link(DUMMY_URL,True)
    assert safe_payment_link(DUMMY_URL,False)
    assert not safe_payment_link(None,True)
    assert safe_payment_link('https://rzp.io/i/abc123',True)
    assert safe_payment_link('https://pages.razorpay.com/madeinindia',True)

@pytest.mark.parametrize('url',["https://evil.example/miih","http://rzp.io/a","https://rzp.io.evil.example/x",
                               "javascript:alert(1)","https://example.com/miih-payment-placeholder"])
def test_invalid_active_payment_hosts_rejected(url):
    assert not safe_payment_link(url,True)

def test_team_size_pricing_sorts_thresholds_and_resolves_exact_between_and_open_ended_sizes():
    rules=validate_team_size_pricing([
        TeamSizePaymentRule(min_members=5,fee_amount=5000,razorpay_payment_url='https://rzp.io/rzp/five'),
        TeamSizePaymentRule(min_members=1,fee_amount=1000,razorpay_payment_url='https://rzp.io/rzp/one'),
        TeamSizePaymentRule(min_members=3,fee_amount=3000,razorpay_payment_url='https://rzp.io/rzp/three'),
    ])
    assert [rule['min_members'] for rule in rules]==[1,3,5]
    assert all(set(rule)=={'min_members','fee_amount','razorpay_payment_url'} for rule in rules)
    for size,threshold,fee,url in [
        (1,1,1000,'https://rzp.io/rzp/one'),
        (2,1,1000,'https://rzp.io/rzp/one'),
        (3,3,3000,'https://rzp.io/rzp/three'),
        (4,3,3000,'https://rzp.io/rzp/three'),
        (5,5,5000,'https://rzp.io/rzp/five'),
        (20,5,5000,'https://rzp.io/rzp/five'),
    ]:
        selected=payment_rule_for_team_size(rules,size)
        assert selected['min_members']==threshold
        assert selected['fee_amount']==fee
        assert selected['razorpay_payment_url']==url
    assert payment_rule_for_team_size(rules,0) is None
    assert payment_rule_for_team_size(rules,4)['fee_amount']==3000

def test_team_size_pricing_rejects_duplicate_thresholds_and_invalid_fields():
    with pytest.raises(HTTPException) as duplicate:
        validate_team_size_pricing([
            TeamSizePaymentRule(min_members=2,fee_amount=1000,razorpay_payment_url='https://rzp.io/rzp/one'),
            TeamSizePaymentRule(min_members=2,fee_amount=2000,razorpay_payment_url='https://rzp.io/rzp/two'),
        ])
    assert duplicate.value.status_code==422
    with pytest.raises(ValidationError):
        TeamSizePaymentRule.model_validate({
            'min_members':1,'max_members':1,'fee_amount':1000,'razorpay_payment_url':'https://rzp.io/rzp/one'})
    with pytest.raises(ValidationError):
        TeamSizePaymentRule.model_validate({
            'min_members':1.5,'fee_amount':1000,'razorpay_payment_url':'https://rzp.io/rzp/one'})
    with pytest.raises(ValidationError):
        TeamSizePaymentRule.model_validate({
            'min_members':1,'fee_amount':0,'razorpay_payment_url':'https://rzp.io/rzp/one'})
    with pytest.raises(ValidationError):
        TeamSizePaymentRule.model_validate({
            'min_members':1,'fee_amount':1000,'razorpay_payment_url':''})

def test_saved_legacy_rules_and_single_fee_configs_normalize_without_losing_values():
    normalized=payment_rules_from_config([
        {'min_members':5,'max_members':None,'fee_amount':5000,'razorpay_payment_url':'https://rzp.io/rzp/five'},
        {'min_members':1,'max_members':2,'fee_amount':1000,'razorpay_payment_url':'https://rzp.io/rzp/one'},
        {'min_members':3,'max_members':4,'fee_amount':3000,'razorpay_payment_url':'https://rzp.io/rzp/three'},
    ])
    assert [rule['min_members'] for rule in normalized]==[1,3,5]
    assert [(rule['fee_amount'],rule['razorpay_payment_url']) for rule in normalized]==[
        (1000,'https://rzp.io/rzp/one'),
        (3000,'https://rzp.io/rzp/three'),
        (5000,'https://rzp.io/rzp/five'),
    ]
    assert all('max_members' not in rule for rule in normalized)
    legacy=payment_rules_from_config([],2500,'https://rzp.io/rzp/legacy')
    assert legacy==[{'min_members':1,'fee_amount':2500.0,'razorpay_payment_url':'https://rzp.io/rzp/legacy'}]

@pytest.mark.asyncio
async def test_admin_payment_settings_loads_legacy_rules_sorted_without_upper_bounds(monkeypatch):
    stored=[
        {'min_members':5,'max_members':None,'fee_amount':5000,'razorpay_payment_url':'https://rzp.io/rzp/five'},
        {'min_members':1,'max_members':3,'fee_amount':1000,'razorpay_payment_url':'https://rzp.io/rzp/one'},
    ]
    monkeypatch.setattr(settings_service,'many',AsyncMock(return_value=[{
        'fee_amount':5000,'razorpay_payment_url':'https://rzp.io/rzp/five','team_size_pricing':stored,
    }]))
    result=await settings_service.payment_settings(AsyncMock(),{'role':'SUPER_ADMIN'},uuid4())
    assert result[0]['team_size_pricing']==[
        {'min_members':1,'fee_amount':1000.0,'razorpay_payment_url':'https://rzp.io/rzp/one'},
        {'min_members':5,'fee_amount':5000.0,'razorpay_payment_url':'https://rzp.io/rzp/five'},
    ]

@pytest.mark.asyncio
async def test_payment_save_sorts_rules_and_persists_only_threshold_fields(monkeypatch):
    captured=[]
    result_row={'id':'saved-config','config_version':2,'team_size_pricing':[]}
    async def fake_one(db,query,params):
        statement=str(query)
        captured.append((statement,params))
        if 'SELECT id,edition_code,max_team_size' in statement:
            return {'id':'edition','edition_code':'MIIH_UPCOMING','max_team_size':4}
        return result_row
    monkeypatch.setattr(settings_service,'one',fake_one)
    monkeypatch.setattr(settings_service,'record',AsyncMock())
    db=SimpleNamespace(execute=AsyncMock(),commit=AsyncMock())
    payload=PaymentSettingsUpdate(
        button_label='Pay now',
        team_size_pricing=[
            TeamSizePaymentRule(min_members=5,fee_amount=5000,razorpay_payment_url='https://rzp.io/rzp/five'),
            TeamSizePaymentRule(min_members=1,fee_amount=1000,razorpay_payment_url='https://rzp.io/rzp/one'),
            TeamSizePaymentRule(min_members=3,fee_amount=3000,razorpay_payment_url='https://rzp.io/rzp/three'),
        ],
        payment_required=True,proof_required=True,activate=False,
    )
    await settings_service.change_payment_settings(db,{'id':'admin','role':'SUPER_ADMIN'},'edition',payload)
    insert_params=next(params for statement,params in captured if 'INSERT INTO public.payment_settings' in statement)
    saved=json.loads(insert_params['pricing'])
    assert [rule['min_members'] for rule in saved]==[1,3,5]
    assert all(set(rule)=={'min_members','fee_amount','razorpay_payment_url'} for rule in saved)
    assert insert_params['fee']=='5000.0'
    assert insert_params['link']=='https://rzp.io/rzp/five'

def test_payment_evidence_rejects_frontend_claimed_amount_and_url():
    with pytest.raises(ValidationError):
        PaymentEvidence.model_validate({
            'transaction_id':'TXN-12345',
            'proof_file_id':uuid4(),
            'fee_amount':1,
            'razorpay_payment_url':'https://evil.example/checkout',
        })

@pytest.mark.asyncio
async def test_payment_evidence_amount_uses_database_team_count_and_matching_rule(monkeypatch):
    registration={'edition_id':'edition','payment_setting_id':'payment','form_version_id':'form'}
    payment={'id':'payment','team_size_pricing':[
        {'min_members':1,'max_members':2,'fee_amount':1000,'razorpay_payment_url':'https://rzp.io/rzp/one'},
        {'min_members':3,'max_members':4,'fee_amount':3000,'razorpay_payment_url':'https://rzp.io/rzp/three'},
        {'min_members':5,'max_members':None,'fee_amount':5000,'razorpay_payment_url':'https://rzp.io/rzp/five'},
    ],'fee_amount':5000,'razorpay_payment_url':'https://rzp.io/rzp/five','currency':'INR'}
    proof_id=uuid4()
    async def fake_one(db,query,params):
        statement=str(query)
        if 'FROM public.payment_settings' in statement:return payment
        if 'FROM public.file_assets' in statement:return {'id':proof_id}
        return None
    monkeypatch.setattr(registration_service,'authorized_draft',AsyncMock(return_value=registration))
    monkeypatch.setattr(registration_service,'one',fake_one)
    monkeypatch.setattr(registration_service,'scalar',AsyncMock(return_value=4))
    db=SimpleNamespace(execute=AsyncMock(),commit=AsyncMock())
    await registration_service.record_payment(db,uuid4(),'draft-token',PaymentEvidence(
        transaction_id='TXN-12345',proof_file_id=proof_id))
    saved_values=db.execute.await_args.args[1]
    assert saved_values['fee']==3000
    assert saved_values['currency']=='INR'

@pytest.mark.asyncio
async def test_payment_evidence_rejects_team_size_below_first_threshold(monkeypatch):
    payment={'id':'payment','team_size_pricing':[
        {'min_members':3,'fee_amount':3000,'razorpay_payment_url':'https://rzp.io/rzp/three'},
    ],'fee_amount':3000,'razorpay_payment_url':'https://rzp.io/rzp/three','currency':'INR'}
    async def fake_one(db,query,params):
        return payment if 'FROM public.payment_settings' in str(query) else None
    monkeypatch.setattr(registration_service,'authorized_draft',AsyncMock(return_value={
        'edition_id':'edition','payment_setting_id':'payment','form_version_id':'form'}))
    monkeypatch.setattr(registration_service,'one',fake_one)
    monkeypatch.setattr(registration_service,'scalar',AsyncMock(return_value=2))
    db=SimpleNamespace(execute=AsyncMock(),commit=AsyncMock())
    with pytest.raises(HTTPException) as error:
        await registration_service.record_payment(db,uuid4(),'draft-token',PaymentEvidence(
            transaction_id='TXN-12345',proof_file_id=uuid4()))
    assert error.value.status_code==409
    assert error.value.detail=='Payment is not configured for a team of 2 members'

def test_admin_cannot_become_super_admin():
    with pytest.raises(HTTPException) as e:require_super({'role':'ADMIN'})
    assert e.value.status_code==403

def test_registration_edit_token_is_hashed_and_required():
    token='A'*45
    record={'id':uuid4(),'leader_edit_token_hash':hashlib.sha256(token.encode()).hexdigest()}
    verify_draft_token(record,token)
    with pytest.raises(HTTPException):verify_draft_token(record,'B'*45)
    with pytest.raises(HTTPException):verify_draft_token(record,None)

def test_xlsx_header_is_purple_and_filterable():
    b=render_excel(['team_name','status'],[{'team_name':'Test team','status':'SUBMITTED'}])
    ws=load_workbook(BytesIO(b)).active
    assert ws['A1'].fill.fgColor.rgb.endswith('8C52FF')
    assert ws['A1'].font.bold
    assert ws.freeze_panes=='A2'
    assert ws.auto_filter.ref=='A1:B2'

def test_export_prevents_formula_injection():
    b=render_csv(['team_name'],[{'team_name':'=IMPORTXML("https://evil.test")'}])
    assert b"'=IMPORTXML" in b

def test_public_paths_and_admin_paths_exposed():
    routes=set(app.openapi()['paths'])
    for p in ('/health','/api/v1/auth/login','/api/v1/auth/signup',
              '/api/v1/admin/apply','/api/v1/admin/applications/pending',
              '/api/v1/admin/editions/{edition_id}/payments/config',
              '/api/v1/admin/cms/preview/{page_key}',
              '/api/v1/admin/exports',
              '/api/v1/public/editions/{code}/registration-config',
              '/api/v1/registrations/{registration_id}/submit'):
        assert p in routes,p

def test_restricted_admin_routes_need_authentication():
    c=TestClient(app)
    assert c.get('/api/v1/admin/dashboard').status_code==401
    assert c.post('/api/v1/admin/exports',json={'dataset':'TEAMS'}).status_code==401
    assert c.get('/api/v1/admin/cms/preview/HOME').status_code==401
    assert c.post('/api/v1/admin/editions/'+str(uuid4())+'/payments/config',json={}).status_code==401

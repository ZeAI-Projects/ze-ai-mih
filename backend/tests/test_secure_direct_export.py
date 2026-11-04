"""Direct exports remain authorization-protected and do not require Storage keys."""
from unittest.mock import AsyncMock
import pytest
from fastapi import HTTPException
from openpyxl import load_workbook
from io import BytesIO
from src.models.admin_ops_requests import ExportRequest
from src.service import export_service as service

class Database:
    async def commit(self):
        self.committed = True

@pytest.mark.asyncio
async def test_xlsx_download_does_not_call_supabase_storage(monkeypatch):
    monkeypatch.setattr(service, 'many', AsyncMock(return_value=[{
        'team_id':'MIIH2000','registration_code':'MIIH-X',
        'team_name':'Test team', 'edition_code':'MIIH_UPCOMING'}]))
    audit = AsyncMock(return_value={'id':'audit-row'})
    monkeypatch.setattr(service, 'one', audit)
    monkeypatch.setattr(service, 'upload', AsyncMock(side_effect=AssertionError('Storage must not be called')))
    admin = {'role':'SUPER_ADMIN','id':'00000000-0000-0000-0000-000000000001'}
    db = Database()
    raw, mime, filename, rows = await service.download_direct(db, admin,
        ExportRequest(dataset='TEAMS',file_format='XLSX',columns=['team_id','team_name']))
    assert rows==1
    assert mime.startswith('application/vnd.openxmlformats')
    assert filename.endswith('.xlsx')
    assert db.committed
    wb=load_workbook(BytesIO(raw))
    assert wb.active['A2'].value=='MIIH2000'
    assert wb.active['B2'].value=='Test team'
    assert wb.active.freeze_panes=='A2'
    assert audit.await_count==1

@pytest.mark.asyncio
async def test_only_super_admin_can_download_payment_exports(monkeypatch):
    async def allow(*_args):return None
    monkeypatch.setattr(service, 'require', allow)
    monkeypatch.setattr(service, 'many', AsyncMock(side_effect=AssertionError('No query allowed')))
    admin={'role':'ADMIN','id':'00000000-0000-0000-0000-000000000002'}
    with pytest.raises(HTTPException) as exc:
        await service.download_direct(Database(),admin,ExportRequest(dataset='PAYMENTS'))
    assert exc.value.status_code==403

@pytest.mark.asyncio
async def test_csv_formula_injection_is_escaped(monkeypatch):
    monkeypatch.setattr(service, 'many', AsyncMock(return_value=[{'team_name':'=IMPORTXML("x","y")'}]))
    monkeypatch.setattr(service, 'one', AsyncMock(return_value={'id':'audit-row'}))
    admin={'role':'SUPER_ADMIN','id':'00000000-0000-0000-0000-000000000001'}
    content,mime,filename,rows=await service.download_direct(Database(),admin,
        ExportRequest(dataset='TEAMS',file_format='CSV',columns=['team_name']))
    assert b"'=IMPORTXML" in content
    assert rows==1
    assert filename.endswith('.csv')

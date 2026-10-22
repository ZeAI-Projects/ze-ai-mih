from uuid import UUID
from fastapi.responses import Response
from src.service import registration_documents
from fastapi import APIRouter, Depends, Header, UploadFile, File, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from database import get_db_session
from src.models.registration_requests import TeamUpdate,AnswersUpdate,PaymentEvidence
from src.controllers import registration_controller as service
from src.service.storage_service import upload,PRIVATE
from src.repository.query_utils import one
from src.repository.registration_repository import RegistrationRepository
from src.service.access_service import require_super
from src.utils.supabase_auth import get_verified_identity
from fastapi.security import HTTPAuthorizationCredentials

async def _protect_test_edition(db,request:Request,edition_code:str):
    if edition_code != 'MIIH_TEST_48H':
        if edition_code.startswith('MIIH_TEST_'):
            raise HTTPException(404,'Unknown edition')
        return
    header=request.headers.get('authorization','')
    scheme,_,token=header.partition(' ')
    if scheme.lower()!='bearer' or not token:
        raise HTTPException(401,'Super Admin sign-in required for test registration')
    identity=await get_verified_identity(HTTPAuthorizationCredentials(scheme='Bearer',credentials=token))
    admin=await one(db,'''SELECT role,approval_status FROM public.admin_users
      WHERE auth_user_id=:uid''',{'uid':identity.user_id})
    if not admin or admin['approval_status']!='APPROVED':
        raise HTTPException(403,'Approved Super Admin required')
    require_super(admin)

async def _protect_test_registration(db,request:Request,rid:UUID):
    edition=await one(db,'''SELECT e.edition_code FROM public.team_registrations r
      JOIN public.hackathon_editions e ON e.id=r.edition_id
      WHERE r.id=:rid''',{'rid':rid})
    if edition:
        await _protect_test_edition(db,request,edition['edition_code'])


router=APIRouter(prefix='/registrations',tags=['Team Registration'])

def edit_header(x_registration_token:str|None=Header(None)):
    return x_registration_token

@router.post('/{edition_code}/start',status_code=201)
async def start(edition_code:str,request:Request,db:AsyncSession=Depends(get_db_session)):
    await _protect_test_edition(db,request,edition_code)
    return await service.create_draft(db,edition_code)

@router.get('/{registration_id}')
async def get_draft(registration_id:UUID, request:Request, token:str=Depends(edit_header), db:AsyncSession=Depends(get_db_session)):
    await _protect_test_registration(db,request,registration_id)
    r=await service.authorized_draft(db,registration_id,token)
    return await RegistrationRepository(db).snapshot(registration_id)

@router.put('/{registration_id}/team')
async def team(registration_id:UUID,payload:TeamUpdate,request:Request,token:str=Depends(edit_header),
               db:AsyncSession=Depends(get_db_session)):
    await _protect_test_registration(db,request,registration_id)
    return await service.save_team(db,registration_id,token,payload)

@router.put('/{registration_id}/answers')
async def answers(registration_id:UUID,payload:AnswersUpdate,request:Request,token:str=Depends(edit_header),
                  db:AsyncSession=Depends(get_db_session)):
    await _protect_test_registration(db,request,registration_id)
    return await service.save_answers(db,registration_id,token,payload)

@router.post('/{registration_id}/upload')
async def upload_registration_file(registration_id:UUID,request:Request,file:UploadFile=File(...),
      token:str=Depends(edit_header),db:AsyncSession=Depends(get_db_session)):
    await _protect_test_registration(db,request,registration_id)
    r=await service.authorized_draft(db,registration_id,token)
    result=await upload(db,bucket=PRIVATE,file=file,edition_id=r['edition_id'],registration_id=registration_id)
    await db.commit()
    return result

@router.post('/{registration_id}/payment-evidence')
async def payment(registration_id:UUID,payload:PaymentEvidence,request:Request,token:str=Depends(edit_header),
                  db:AsyncSession=Depends(get_db_session)):
    await _protect_test_registration(db,request,registration_id)
    try:
        return await service.record_payment(db,registration_id,token,payload)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(409,'Transaction ID or payment evidence already recorded') from exc

@router.get('/{registration_id}/validation')
async def validation(registration_id:UUID,request:Request,token:str=Depends(edit_header),db:AsyncSession=Depends(get_db_session)):
    await _protect_test_registration(db,request,registration_id)
    issues=await service.errors(db,registration_id,token)
    return {'can_submit':not bool(issues),'errors':issues}

@router.post('/{registration_id}/submit')
async def submit(registration_id:UUID,request:Request,token:str=Depends(edit_header),db:AsyncSession=Depends(get_db_session)):
    await _protect_test_registration(db,request,registration_id)
    return await service.submit(db,registration_id,token)

@router.get('/{registration_id}/confirmation.pdf')
async def confirmation_pdf(registration_id:UUID,request:Request,token:str=Depends(edit_header),
                           db:AsyncSession=Depends(get_db_session)):
    await _protect_test_registration(db,request,registration_id)
    pdf=await registration_documents.confirmation(db,registration_id,token)
    return Response(content=pdf,media_type='application/pdf',headers={
        'Content-Disposition':'attachment; filename="MIIH-registration-confirmation.pdf"',
        'Cache-Control':'no-store'})

@router.get('/{registration_id}/payment-receipt.pdf')
async def payment_receipt_pdf(registration_id:UUID,request:Request,token:str=Depends(edit_header),
                              db:AsyncSession=Depends(get_db_session)):
    await _protect_test_registration(db,request,registration_id)
    pdf=await registration_documents.verified_payment_receipt(db,registration_id,token)
    return Response(content=pdf,media_type='application/pdf',headers={
        'Content-Disposition':'attachment; filename="MIIH-verified-payment-receipt.pdf"',
        'Cache-Control':'no-store'})

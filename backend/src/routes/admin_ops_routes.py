from uuid import UUID
from fastapi import APIRouter,Depends,UploadFile,File,HTTPException,Query,Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from database import get_db_session
from src.service.access_service import current_admin,require,require_super
from src.service import settings_service, cms_service, form_service, operations_service,export_service,media_library_service
from src.service.storage_service import upload,signed_url,PUBLIC
from src.repository.query_utils import one
from src.service.preset_service import Preset
from src.models.admin_ops_requests import (EditionUpdate,ContentRevision,QuestionUpdate,
  NewQuestion,OptionUpdate,FormVersionRename,PaymentSettingsUpdate,PaymentReview,TeamReview,ExportRequest,EventBlock,EditionHighlight)

router=APIRouter(prefix='/admin',tags=['Admin Operations'])

@router.get('/editions')
async def editions(admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await settings_service.list_editions(db,admin)

@router.patch('/editions/{edition_id}')
async def edit_edition(edition_id:UUID,body:EditionUpdate,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await settings_service.update_edition(db,admin,edition_id,body)

@router.post('/editions/{edition_id}/publish')
async def publish_edition(edition_id:UUID,open_registration:bool=False,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await settings_service.publish_edition(db,admin,edition_id,open_registration)

@router.get('/editions/{edition_id}/readiness')
async def readiness(edition_id:UUID,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await settings_service.edition_readiness(db,admin,edition_id)

@router.get('/editions/{edition_id}/domains')
async def edition_domains(edition_id:UUID,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await settings_service.domains(db,admin,edition_id)

@router.patch('/editions/{edition_id}/domains/{domain_id}')
async def domain_toggle(edition_id:UUID,domain_id:UUID,enabled:bool,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await settings_service.toggle_domain(db,admin,edition_id,domain_id,enabled)

@router.get('/editions/{edition_id}/payments/config')
async def get_payment(edition_id:UUID,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await settings_service.payment_settings(db,admin,edition_id)

@router.post('/editions/{edition_id}/payments/config')
async def set_payment(edition_id:UUID,body:PaymentSettingsUpdate,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await settings_service.change_payment_settings(db,admin,edition_id,body)

@router.get('/media/library')
async def media_catalog(admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await media_library_service.media_library(db,admin)

@router.post('/media/library/add')
async def media_add(body:media_library_service.NewMedia,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await media_library_service.create_media(db,admin,body)

@router.post('/media/library/{media_key}/replacement')
async def media_replacement(media_key:str,body:media_library_service.MediaReplacement,
                            admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await media_library_service.replace_media(db,admin,media_key,body)

@router.post('/media/revisions/{revision_id}/publish')
async def media_publish(revision_id:UUID,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await media_library_service.publish_media(db,admin,revision_id)

@router.post('/media/library/{media_key}/restore')
async def media_restore(media_key:str,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await media_library_service.restore_original(db,admin,media_key)

@router.get('/cms/slots')
async def content_slots(page:str|None=None,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await cms_service.slots(db,admin,page)

@router.get('/cms/preview/{page_key}')
async def cms_preview(page_key:str,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await cms_service.preview(db,admin,page_key)

@router.post('/cms/slots/{slot_id}/revisions')
async def new_revision(slot_id:UUID,body:ContentRevision,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await cms_service.create_revision(db,admin,slot_id,body)

@router.post('/cms/revisions/{revision_id}/publish')
async def publish_revision(revision_id:UUID,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await cms_service.publish_revision(db,admin,revision_id)

@router.post('/cms/upload')
async def cms_upload(file:UploadFile=File(...),admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    if admin['role']!='SUPER_ADMIN':
        permissions=await __import__('src.service.access_service',fromlist=['permissions']).permissions(db,admin)
        if not ({'SITE_CONTENT_EDIT','GALLERY_EDIT'}&permissions):raise HTTPException(403,'Cannot upload CMS media')
    result=await upload(db,bucket=PUBLIC,file=file,admin_id=admin['id'])
    await db.commit()
    return result

@router.get('/forms/editions/{edition_id}/versions')
async def forms(edition_id:UUID,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await form_service.list_versions(db,admin,edition_id)

@router.get('/forms/versions/{version_id}')
async def form_detail(version_id:UUID,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await form_service.form_details(db,admin,version_id)

@router.post('/forms/editions/{edition_id}/clone')
async def clone_form(edition_id:UUID,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await form_service.clone(db,admin,edition_id)

@router.patch('/forms/versions/{version_id}/name')
async def rename_form_version(version_id:UUID, body:FormVersionRename,
                              admin=Depends(current_admin), db:AsyncSession=Depends(get_db_session)):
    return await form_service.rename_version(db, admin, version_id, body)

@router.patch('/forms/questions/{question_id}')
async def edit_question(question_id:UUID,body:QuestionUpdate,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await form_service.question_update(db,admin,question_id,body)

@router.post('/forms/sections/{section_id}/questions')
async def add_question(section_id:UUID,body:NewQuestion,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await form_service.add_question(db,admin,section_id,body)

@router.put('/forms/questions/{question_id}/options')
async def set_option(question_id:UUID,body:OptionUpdate,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await form_service.add_option(db,admin,question_id,body)

@router.post('/forms/versions/{version_id}/publish')
async def publish_form(version_id:UUID,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await form_service.publish(db,admin,version_id)

@router.get('/dashboard')
async def overview(edition_id:UUID|None=None,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await operations_service.overview(db,admin,edition_id)

@router.get('/teams')
async def teams(edition_id:UUID|None=None,domain_id:UUID|None=None,status:str|None=None,
  search:str|None=None,limit:int=Query(100,ge=1,le=500),offset:int=Query(0,ge=0),
  admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await operations_service.teams(db,admin,edition_id,domain_id,status,search,limit,offset)

@router.get('/participants')
async def participants(edition_id:UUID|None=None,search:str|None=None,status:str|None=None,limit:int=Query(100,ge=1,le=500),
   offset:int=Query(0,ge=0),admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await operations_service.participants(db,admin,edition_id,search,limit,offset,status=status)

@router.patch('/teams/{registration_id}/review')
async def review_team(registration_id:UUID,body:TeamReview,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await operations_service.review_team(db,admin,registration_id,body)

@router.get('/teams/{registration_id}/payments')
async def team_payments(registration_id:UUID,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await operations_service.team_payment_evidence(db,admin,registration_id)

@router.get('/revenue')
async def revenue(edition_id:UUID|None=None,status:str|None=None,limit:int=Query(100,ge=1,le=500),
  offset:int=Query(0,ge=0),admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await operations_service.revenue(db,admin,edition_id,status,limit,offset)

@router.patch('/revenue/payments/{payment_id}')
async def payment_review(payment_id:UUID,body:PaymentReview,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await operations_service.review_payment(db,admin,payment_id,body)

@router.get('/statistics')
async def statistics(edition_id:UUID|None=None,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await operations_service.statistics(db,admin,edition_id)

@router.get('/history')
async def history(edition_id:UUID|None=None,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await operations_service.history(db,admin,edition_id)

@router.get('/audit-logs')
async def audit(limit:int=Query(100,ge=1,le=500),offset:int=Query(0,ge=0),
  admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await operations_service.logs(db,admin,limit,offset)

@router.post('/exports')
async def exports(body:ExportRequest,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await export_service.run_export(db,admin,body)

@router.post('/exports/direct-download')
async def direct_export(body:ExportRequest,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    try:
        content, mime, filename, count = await export_service.download_direct(db,admin,body)
    except IntegrityError as error:
        await db.rollback()
        if getattr(getattr(error.orig,'diag',None),'constraint_name',None)=='export_runs_dataset_check':
            raise HTTPException(503,'History and statistics exports need the database update in 17_ENABLE_REPORT_EXPORTS.sql.') from error
        raise
    return Response(content=content,media_type=mime,
                    headers={'Content-Disposition':f'attachment; filename="{filename}"',
                             'X-Export-Row-Count':str(count),
                             'Cache-Control':'no-store',
                             'X-Content-Type-Options':'nosniff'})

@router.get('/exports/history')
async def export_history(admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await export_service.history(db,admin)

@router.get('/files/{asset_id}/signed-url')
async def file_access(asset_id:UUID,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    item=await one(db,'''SELECT id,storage_bucket,storage_path,file_url,registration_id
      FROM public.file_assets WHERE id=:id''',{'id':asset_id})
    if not item:raise HTTPException(404,'File not found')
    if item['storage_bucket']=='miih-registration-private':require_super(admin)
    elif item['storage_bucket']=='miih-exports-private':
        require_super(admin) # Conservative: reports include private data.
    else:await require(db,admin,'SITE_PREVIEW')
    return {'url':await signed_url(item),'expires_in_seconds':120}

@router.get('/permission-catalog')
async def permission_catalog(admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    require_super(admin)
    from src.repository.query_utils import many
    return await many(db,'''SELECT permission_key,module_key,display_name,description,
      assignable_to_admin,is_active,sort_order FROM public.admin_permission_catalog
      ORDER BY sort_order''')

@router.get('/admins')
async def admin_list(status:str|None=None,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    require_super(admin)
    from src.repository.query_utils import many
    return await many(db,'''SELECT id,full_name,email,role,approval_status,requested_at,
       approved_at,last_login_at FROM public.admin_users
       WHERE (CAST(:status AS text) IS NULL OR approval_status=:status) ORDER BY requested_at DESC''',{'status':status})

@router.get('/admins/{admin_id}/grants')
async def grants(admin_id:UUID,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    require_super(admin)
    from src.repository.query_utils import many
    return await many(db,'''SELECT a.permission_key,c.display_name,a.is_granted,a.granted_at
     FROM public.admin_permission_assignments a JOIN public.admin_permission_catalog c
     ON c.permission_key=a.permission_key WHERE a.admin_id=:id ORDER BY c.sort_order''',{'id':admin_id})

@router.get('/export-presets')
async def presets(admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    from src.service.preset_service import all_presets
    return await all_presets(db,admin)

@router.post('/export-presets')
async def create_preset(body:Preset,
                        admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    from src.service.preset_service import save
    return await save(db,admin,body)

@router.get('/editions/{edition_id}/blocks')
async def event_blocks(edition_id:UUID,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    from src.service.edition_content_service import blocks
    return await blocks(db,admin,edition_id)

@router.put('/editions/{edition_id}/blocks')
async def save_event_block(edition_id:UUID,body:EventBlock,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    from src.service.edition_content_service import save_block
    return await save_block(db,admin,edition_id,body)

@router.get('/editions/{edition_id}/highlights')
async def get_highlights(edition_id:UUID,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    from src.service.edition_content_service import highlights
    return await highlights(db,admin,edition_id)

@router.post('/editions/{edition_id}/highlights')
async def new_highlight(edition_id:UUID,body:EditionHighlight,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    from src.service.edition_content_service import add_highlight
    return await add_highlight(db,admin,edition_id,body)

@router.get('/teams/{registration_id}')
async def team_info(registration_id:UUID,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await operations_service.team_detail(db,admin,registration_id)

@router.get('/participants/{member_id}')
async def participant_info(member_id:UUID,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    return await operations_service.member_detail(db,admin,member_id)

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime,timezone
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db_session
from src.service.access_service import current_admin,require_super
from src.repository.query_utils import one,many

router=APIRouter(prefix='/public',tags=['Public Content'])
PLACEHOLDER='https://example.com/miih-payment-placeholder'

@router.get('/gallery-additions')
async def gallery_additions(db:AsyncSession=Depends(get_db_session)):
    from src.service.media_library_service import published_additions
    return await published_additions(db)

@router.get('/editions')
async def editions(db:AsyncSession=Depends(get_db_session)):
    return await many(db,'''SELECT edition_code,title,tagline,description,year,status,
    starts_at,ends_at,registration_opens_at,registration_closes_at,venue,location,event_mode,
    eligibility_text,guidelines_text,min_team_size,max_team_size,default_team_size
    FROM public.hackathon_editions WHERE is_published AND edition_code NOT LIKE 'MIIH_TEST_%' ORDER BY year DESC NULLS LAST''')

@router.get('/editions/{code}/registration-config')
async def configuration(code:str,db:AsyncSession=Depends(get_db_session)):
    if code.startswith('MIIH_TEST_'):
        raise HTTPException(404,'Published edition not found')
    return await _load_config(code,db)

@router.get('/test-editions/{code}/registration-config')
async def internal_test_configuration(code:str, db:AsyncSession=Depends(get_db_session),
                                      admin:dict=Depends(current_admin)):
    require_super(admin)
    if code!='MIIH_TEST_48H':
        raise HTTPException(404,'Internal test edition not found')
    return await _load_config(code,db)

async def _load_config(code:str,db:AsyncSession):
    edition=await one(db,'''SELECT * FROM public.hackathon_editions
      WHERE edition_code=:code AND is_published''',{'code':code})
    if not edition:raise HTTPException(404,'Published edition not found')
    domains=await many(db,'''SELECT d.id,d.domain_code,d.domain_name FROM public.edition_domains ed
      JOIN public.domains d ON d.id=ed.domain_id
      WHERE ed.edition_id=:id AND ed.is_enabled AND d.is_active
      ORDER BY ed.display_order,d.display_order''',{'id':edition['id']})
    form=await one(db,'''SELECT id,version_number,name FROM public.form_versions
      WHERE edition_id=:id AND status='PUBLISHED' ''',{'id':edition['id']})
    sections=[]
    if form:
        sections=await many(db,'''SELECT id,section_key,title,description,display_order
           FROM public.form_sections WHERE form_version_id=:v AND is_active ORDER BY display_order''',{'v':form['id']})
        for s in sections:
            qs=await many(db,'''SELECT id,field_key,legacy_question_number,question_label,description,
              placeholder,input_type,answer_scope,is_required,display_order,validation_rules,
              visibility_rules,default_value
              FROM public.form_questions WHERE section_id=:s AND is_active ORDER BY display_order''',{'s':s['id']})
            for q in qs:
                q['options']=await many(db,'''SELECT option_value,option_label FROM public.form_question_options
                   WHERE question_id=:id AND is_active ORDER BY display_order''',{'id':q['id']})
            s['questions']=qs
    payment=await one(db,'''SELECT button_label,razorpay_payment_url,fee_amount,currency,
        payment_required,proof_required,is_active,instructions
        FROM public.payment_settings WHERE edition_id=:id
        ORDER BY is_active DESC,config_version DESC LIMIT 1''',{'id':edition['id']})
    # Backend never exposes a clickable dummy payment URL as if it were payable.
    ready=bool(payment and payment['is_active'] and payment.get('razorpay_payment_url') and
               payment['razorpay_payment_url'].startswith('https://') and
               not payment['razorpay_payment_url'].startswith('https://example.com/'))
    # A payment-free configuration is permissible only for internal test editions.
    test_payment_free=bool(code=='MIIH_TEST_48H' and payment and payment['is_active']
                           and not payment['payment_required'] and not payment['proof_required']
                           and not payment.get('razorpay_payment_url') and payment['fee_amount']==0)

    pay={'button_label':payment['button_label'] if payment else 'Secure Your Spot - Pay Now',
         'payment_url':payment['razorpay_payment_url'] if ready else None,
         'placeholder_url':(payment.get('razorpay_payment_url') if payment and payment.get('razorpay_payment_url')==PLACEHOLDER else PLACEHOLDER),'payment_enabled':ready,
         'fee_amount':payment['fee_amount'] if payment else None,
         'currency':payment['currency'] if payment else 'INR',
         'payment_required':payment['payment_required'] if payment else True}
    now=datetime.now(timezone.utc)
    within_window=((edition['registration_opens_at'] is None or now>=edition['registration_opens_at'])
                   and (edition['registration_closes_at'] is None or now<=edition['registration_closes_at']))
    return {'edition':{k:v for k,v in edition.items() if k not in ('created_by','modified_by')},
            'domains':domains,'form':form,'sections':sections,'payment':pay,
            'registration_enabled':edition['status']=='OPEN' and bool(form) and within_window and (ready or test_payment_free)}

@router.get('/editions/{code}/content')
async def public_edition_content(code:str,db:AsyncSession=Depends(get_db_session)):
    if code.startswith('MIIH_TEST_'):
        raise HTTPException(404,'Content not public')
    return await many(db,"""SELECT b.block_key,b.block_type,b.title,b.body,b.display_order
      FROM public.edition_content_blocks b
      JOIN public.hackathon_editions e ON e.id=b.edition_id
      WHERE e.edition_code=:code AND e.is_published AND b.is_visible
      ORDER BY b.display_order,b.created_at""",{'code':code})

@router.get('/site-content/{page_key}')
async def published_content(page_key:str,db:AsyncSession=Depends(get_db_session)):
    if page_key not in ('GLOBAL','HOME','ABOUT','GALLERY','REGISTER'):
        raise HTTPException(404,'Unknown page')
    return await many(db,'''SELECT s.section_key,s.slot_key,s.slot_type,
      r.text_value,r.link_url,r.alt_text,r.content_json,r.display_order,r.is_visible,
      a.file_url AS asset_url, p.file_url AS poster_url
      FROM public.site_content_slots s
      JOIN public.site_content_revisions r ON r.slot_id=s.id AND r.status='PUBLISHED'
      LEFT JOIN public.file_assets a ON a.id=r.asset_file_id
      LEFT JOIN public.file_assets p ON p.id=r.poster_file_id
      WHERE s.page_key=:page AND r.is_visible AND s.is_editable ORDER BY s.section_key,s.slot_key''',{'page':page_key})

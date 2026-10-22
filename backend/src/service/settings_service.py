from urllib.parse import urlsplit
from fastapi import HTTPException
from sqlalchemy import text
from src.repository.query_utils import one,many,scalar
from src.service.access_service import require,require_super
from src.service.admin_activity import record

DUMMY_URL='https://example.com/miih-payment-placeholder'

def safe_payment_link(link:str|None,active:bool):
    if not link:return not active
    if link==DUMMY_URL:return not active
    p=urlsplit(link)
    hostname=(p.hostname or '').lower()
    return p.scheme=='https' and bool(hostname) and (
        hostname in ('rzp.io','rzp.link','razorpay.com') or hostname.endswith('.razorpay.com'))

async def list_editions(db,admin):
    await require(db,admin,'EVENT_VIEW')
    return await many(db,'''SELECT * FROM public.hackathon_editions WHERE edition_code='MIIH_UPCOMING' ORDER BY created_at DESC''')

async def update_edition(db,admin,eid,payload):
    await require(db,admin,'EVENT_EDIT')
    updates=payload.model_dump(exclude_unset=True)
    if not updates:raise HTTPException(422,'No values provided')
    previous=await one(db,'SELECT * FROM public.hackathon_editions WHERE id=:id',{'id':eid})
    if not previous:raise HTTPException(404,'Edition not found')
    if previous['is_published']:require_super(admin)
    columns=', '.join(f'{key}=:{key}' for key in updates)  # Pydantic's fixed field names only.
    if admin['role']=='SUPER_ADMIN':
        columns+=', is_published=TRUE, published_at=COALESCE(published_at, now())'
    # Publishing information here does not change status to OPEN or collect money.
    row=await one(db,f'''UPDATE public.hackathon_editions SET {columns},modified_by=:actor
      WHERE id=:id RETURNING *''',{**updates,'id':eid,'actor':admin['id']})
    if not row:raise HTTPException(404,'Edition not found')
    await record(db,admin,'EVENT_DETAILS_SAVED','hackathon_editions',eid,previous,updates)
    await db.commit()
    return row

async def publish_edition(db,admin,eid,open_registration:bool):
    require_super(admin)
    edition=await one(db,'SELECT * FROM public.hackathon_editions WHERE id=:id FOR UPDATE',{'id':eid})
    if not edition:raise HTTPException(404,'Edition not found')
    if open_registration:
        # Registration status must never implicitly publish an admin-created draft.
        # Super Admin chooses the exact version via POST /forms/versions/{id}/publish.
        readiness = await edition_readiness(db,admin,eid)
        # These two items are set by the same atomic publish operation.
        blockers = [c['label'] for c in readiness['checks']
                    if c['key'] not in ('publication','status') and not c['ok']]
        if blockers:
            raise HTTPException(409, {'message':'Registration cannot open yet', 'blockers':blockers})
    row=await one(db,'''UPDATE public.hackathon_editions SET is_published=TRUE,
      status=CASE WHEN :open THEN 'OPEN' ELSE status END,
      published_at=now(),modified_by=:actor
      WHERE id=:id RETURNING id,edition_code,status,is_published''',
      {'id':eid,'actor':admin['id'],'open':open_registration})
    await record(db,admin,'REGISTRATION_OPENED' if open_registration else 'EVENT_PUBLISHED','hackathon_editions',eid,after=row)
    await db.commit()
    return row

async def payment_settings(db,admin,eid):
    require_super(admin)
    return await many(db,'''SELECT * FROM public.payment_settings WHERE edition_id=:id
       ORDER BY config_version DESC''',{'id':eid})

async def change_payment_settings(db,admin,eid,payload):
    require_super(admin)
    edition=await one(db,'SELECT id,edition_code FROM public.hackathon_editions WHERE id=:id FOR UPDATE',{'id':eid})
    if not edition:raise HTTPException(404,'Edition not found')
    test_free=(edition['edition_code']=='MIIH_TEST_48H' and payload.activate
               and not payload.payment_required and not payload.proof_required
               and payload.fee_amount==0 and not payload.razorpay_payment_url)
    link=(None if test_free else payload.razorpay_payment_url or DUMMY_URL)
    if not test_free and not safe_payment_link(link,payload.activate):
        raise HTTPException(422,'Active payment link must use a valid HTTPS Razorpay host')
    if payload.activate and not test_free and (not payload.payment_required or not payload.proof_required):
        raise HTTPException(422,'Manual payment flow requires transaction and screenshot proof')
    if payload.activate and not test_free and payload.fee_amount<=0:
        raise HTTPException(422,'Set a positive registration fee before enabling real payments')
    if not edition:raise HTTPException(404,'Edition not found')
    # New version avoids modifying payment evidence from previous registrations.
    # Each new configuration explicitly replaces the previously active state.
    # An inactive placeholder must deactivate any prior Pay Now link.
    await db.execute(text('''UPDATE public.payment_settings SET is_active=FALSE
      WHERE edition_id=:id AND is_active'''),{'id':eid})
    row=await one(db,'''INSERT INTO public.payment_settings
      (edition_id,config_version,razorpay_payment_url,button_label,instructions,
       fee_amount,currency,payment_required,proof_required,is_active,created_by)
      VALUES (:eid,(SELECT COALESCE(MAX(config_version),0)+1 FROM public.payment_settings
       WHERE edition_id=:eid),:link,:label,:instructions,:fee,'INR',:required,:proof,:active,:actor)
      RETURNING id,config_version,button_label,razorpay_payment_url,fee_amount,currency,
       payment_required,proof_required,is_active''',
      {'eid':eid,'link':link,'label':payload.button_label,'instructions':payload.instructions,
       'fee':str(payload.fee_amount),'required':payload.payment_required,
       'proof':payload.proof_required,'active':payload.activate,'actor':admin['id']})
    await record(db,admin,'PAYMENT_CONFIGURATION_SAVED','payment_settings',row['id'],after={**row,'razorpay_payment_url':'[configured]' if row.get('razorpay_payment_url') else None})
    await db.commit()
    return row

async def domains(db,admin,eid):
    await require(db,admin,'EVENT_VIEW')
    return await many(db,'''SELECT d.*,ed.is_enabled,ed.display_order AS edition_order
      FROM public.edition_domains ed JOIN public.domains d ON d.id=ed.domain_id
      WHERE ed.edition_id=:id ORDER BY ed.display_order''',{'id':eid})

async def toggle_domain(db,admin,eid,did,enabled:bool):
    await require(db,admin,'DOMAIN_EDIT')
    row=await one(db,'''UPDATE public.edition_domains SET is_enabled=:enabled,modified_by=:actor
      WHERE edition_id=:eid AND domain_id=:did RETURNING edition_id,domain_id,is_enabled''',
      {'eid':eid,'did':did,'enabled':enabled,'actor':admin['id']})
    if not row:raise HTTPException(404,'Edition domain not found')
    await record(db,admin,'DOMAIN_ENABLED' if enabled else 'DOMAIN_DISABLED','edition_domains',eid,after={'domain_id':str(did),'enabled':enabled})
    await db.commit()
    return row


async def edition_readiness(db, admin, eid):
    """Read-only registration checklist for administrators. Never activates payments."""
    await require(db, admin, 'EVENT_VIEW')
    edition = await one(db, '''SELECT id,edition_code,title,status,is_published,
      registration_opens_at,registration_closes_at,min_team_size,max_team_size
      FROM public.hackathon_editions WHERE id=:id''', {'id': eid})
    if not edition:
        raise HTTPException(404, 'Edition not found')
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    window_open = (edition['registration_opens_at'] is None or
                   now >= edition['registration_opens_at'])
    window_not_closed = (edition['registration_closes_at'] is None or
                         now <= edition['registration_closes_at'])
    domain_count = await scalar(db, '''SELECT count(*) FROM public.edition_domains ed
      JOIN public.domains d ON d.id=ed.domain_id WHERE ed.edition_id=:id
      AND ed.is_enabled AND d.is_active''', {'id': eid})
    form = await one(db, '''SELECT id,version_number FROM public.form_versions
      WHERE edition_id=:id AND status='PUBLISHED' ORDER BY version_number DESC LIMIT 1''', {'id': eid})
    payment = await one(db, '''SELECT fee_amount,payment_required,proof_required,
      razorpay_payment_url,is_active FROM public.payment_settings
      WHERE edition_id=:id ORDER BY is_active DESC,config_version DESC LIMIT 1''', {'id': eid})
    internal = edition['edition_code'] == 'MIIH_TEST_48H'
    payment_ok = bool(payment and payment['is_active'] and (
      (internal and not payment['payment_required'] and not payment['proof_required']
       and payment['fee_amount'] == 0) or
      (not internal and payment['payment_required'] and payment['proof_required']
       and payment['fee_amount'] > 0 and safe_payment_link(payment['razorpay_payment_url'], True))
    ))
    checks = [
      {'key': 'publication', 'label': 'Edition information published', 'ok': bool(edition['is_published']), 'fix': 'Publish event information in Hackathon Settings'},
      {'key': 'status', 'label': 'Registration status is OPEN', 'ok': edition['status'] == 'OPEN', 'fix': 'Open registration after all requirements pass'},
      {'key': 'start', 'label': 'Registration opening time has arrived', 'ok': window_open, 'fix': 'Edit registration opening date'},
      {'key': 'end', 'label': 'Registration closing time has not passed', 'ok': window_not_closed, 'fix': 'Extend registration closing date'},
      {'key': 'domains', 'label': 'At least one active domain', 'ok': bool(domain_count), 'fix': 'Enable a domain for this edition'},
      {'key': 'form', 'label': 'A registration form is published', 'ok': bool(form), 'fix': 'Publish a complete form version under Registration Form'},
      {'key': 'payment', 'label': 'Payment configuration is ready' if not internal else 'Payment-free internal test is configured',
       'ok': payment_ok, 'fix': 'Configure the real fee and active Razorpay link' if not internal else 'Configure an active zero-fee, payment-free internal test setting'},
    ]
    return {
      'edition_code': edition['edition_code'], 'is_internal_test': internal,
      'ready': all(check['ok'] for check in checks),
      'checks': checks, 'enabled_domains': domain_count,
      'published_form_version': form['version_number'] if form else None,
      'note': 'This endpoint only diagnoses configuration. It does not publish forms, open registration, or process payments.',
    }

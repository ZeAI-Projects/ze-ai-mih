from fastapi import HTTPException
from sqlalchemy import text
from src.repository.query_utils import one,many,scalar
from src.service.access_service import require,require_super

async def overview(db,admin,edition_id=None):
    await require(db,admin,'DASHBOARD_VIEW')
    params={'edition':edition_id}
    team_count=await scalar(db,'''SELECT count(*) FROM public.team_registrations r
       JOIN public.hackathon_editions e ON e.id=r.edition_id
       WHERE e.edition_code NOT LIKE 'MIIH_TEST_%'
       AND (CAST(:edition AS uuid) IS NULL OR r.edition_id=:edition) AND r.status<>'DRAFT' ''',params)
    participants=await scalar(db,'''SELECT count(*) FROM public.team_members m
       JOIN public.team_registrations r ON r.id=m.registration_id
       JOIN public.hackathon_editions e ON e.id=r.edition_id
       WHERE e.edition_code NOT LIKE 'MIIH_TEST_%'
       AND (CAST(:edition AS uuid) IS NULL OR r.edition_id=:edition) AND r.status<>'DRAFT' ''',params)
    response={'registered_teams':team_count,'participants':participants}
    # Live-review queue excludes drafts, completed reviews and restricted internal editions.
    # Payment is shown as a separate verification state; it is never assumed verified.
    response['pending_approvals']=await scalar(db,'''SELECT count(*)
      FROM public.team_registrations r
      JOIN public.hackathon_editions e ON e.id=r.edition_id
      WHERE r.status IN ('SUBMITTED','REVIEW')
      AND e.edition_code NOT LIKE 'MIIH_TEST_%'
      AND (CAST(:edition AS uuid) IS NULL OR r.edition_id=:edition)''',params)
    response['pending_teams']=await many(db,'''SELECT r.id,r.team_name,r.registration_code,
      r.status,r.submitted_at,d.domain_name,
      EXISTS(SELECT 1 FROM public.payment_submissions p
        WHERE p.registration_id=r.id AND p.status='VERIFIED') AS payment_verified
      FROM public.team_registrations r
      JOIN public.hackathon_editions e ON e.id=r.edition_id
      LEFT JOIN public.domains d ON d.id=r.domain_id
      WHERE r.status IN ('SUBMITTED','REVIEW')
      AND e.edition_code NOT LIKE 'MIIH_TEST_%'
      AND (CAST(:edition AS uuid) IS NULL OR r.edition_id=:edition)
      ORDER BY r.submitted_at ASC NULLS LAST,r.created_at ASC LIMIT 8''',params)
    response['internal_test_teams']=await scalar(db,'''SELECT count(*)
      FROM public.team_registrations r JOIN public.hackathon_editions e ON e.id=r.edition_id
      WHERE e.edition_code LIKE 'MIIH_TEST_%' AND r.status<>'DRAFT'
      AND (CAST(:edition AS uuid) IS NULL OR r.edition_id=:edition)''',params)
    if admin['role']=='SUPER_ADMIN':
        response['verified_revenue']=await scalar(db,'''SELECT
          COALESCE((SELECT sum(p.claimed_amount) FROM public.payment_submissions p
           JOIN public.team_registrations r ON r.id=p.registration_id
           JOIN public.hackathon_editions e ON e.id=r.edition_id
           WHERE e.edition_code NOT LIKE 'MIIH_TEST_%' AND r.status='APPROVED' AND p.status='VERIFIED' AND (CAST(:edition AS uuid) IS NULL OR r.edition_id=:edition)),0)
          -COALESCE((SELECT sum(f.amount) FROM public.payment_refunds f
             JOIN public.payment_submissions p ON p.id=f.payment_submission_id
             JOIN public.team_registrations r ON r.id=p.registration_id
             JOIN public.hackathon_editions e ON e.id=r.edition_id
             WHERE e.edition_code NOT LIKE 'MIIH_TEST_%' AND r.status='APPROVED' AND p.status='VERIFIED' AND (CAST(:edition AS uuid) IS NULL OR r.edition_id=:edition)),0)''',params)
    return response

async def teams(db,admin,edition_id=None,domain_id=None,status=None,search=None,limit=100,offset=0):
    await require(db,admin,'TEAMS_VIEW')
    return await many(db,'''SELECT r.id,r.team_id,r.registration_code,r.team_name,r.source_team_id,
      r.status,r.submitted_at,r.created_at,r.investor_pitch_interest,
      e.title AS edition,e.edition_code,d.domain_name,
      (SELECT count(*) FROM public.team_members m WHERE m.registration_id=r.id) AS member_count
      FROM public.team_registrations r
      JOIN public.hackathon_editions e ON e.id=r.edition_id
      LEFT JOIN public.domains d ON d.id=r.domain_id
      WHERE (CAST(:eid AS uuid) IS NULL OR r.edition_id=:eid)
      AND (CAST(:did AS uuid) IS NULL OR r.domain_id=:did)
      AND ((CAST(:status AS text) IS NULL AND r.status<>'DRAFT')
        OR (CAST(:status AS text)='PENDING_APPROVAL' AND r.status IN ('SUBMITTED','REVIEW'))
        OR r.status=CAST(:status AS text))
      AND (CAST(:term AS text) IS NULL OR r.team_name ILIKE ('%'||:term||'%') OR r.registration_code ILIKE ('%'||:term||'%'))
      ORDER BY r.created_at DESC LIMIT :max OFFSET :skip''',
      {'eid':edition_id,'did':domain_id,'status':status,'term':search,'max':limit,'skip':offset})

async def participants(db,admin,edition_id=None,search=None,limit=100,offset=0,status=None):
    await require(db,admin,'PARTICIPANTS_VIEW')
    return await many(db,'''SELECT m.id,m.full_name,m.email,m.mobile,m.role,m.member_order,
      r.registration_code,r.team_name,r.status,e.title AS edition,e.edition_code
      FROM public.team_members m JOIN public.team_registrations r ON r.id=m.registration_id
      JOIN public.hackathon_editions e ON e.id=r.edition_id
      WHERE (CAST(:eid AS uuid) IS NULL OR r.edition_id=:eid)
      AND ((CAST(:status AS text) IS NULL AND r.status<>'DRAFT') OR r.status=:status)
      AND (CAST(:term AS text) IS NULL OR m.full_name ILIKE ('%'||:term||'%') OR m.email ILIKE ('%'||:term||'%'))
      ORDER BY m.created_at DESC LIMIT :max OFFSET :skip''',
      {'status':status,'eid':edition_id,'term':search,'max':limit,'skip':offset})

async def revenue(db,admin,edition_id=None,status=None,limit=100,offset=0):
    require_super(admin)
    return await many(db,'''SELECT p.id,p.registration_id,r.registration_code,r.team_name,
       p.transaction_id,p.proof_file_id,p.claimed_amount,p.currency,p.status,
       p.submitted_at,p.verified_at,p.rejection_reason,
       COALESCE((SELECT sum(f.amount) FROM public.payment_refunds f
         WHERE f.payment_submission_id=p.id),0) AS refunded
      FROM public.payment_submissions p
      JOIN public.team_registrations r ON r.id=p.registration_id
      JOIN public.hackathon_editions e ON e.id=r.edition_id
      WHERE r.status='APPROVED' AND p.status='VERIFIED'
      AND e.edition_code NOT LIKE 'MIIH_TEST_%'
      AND (CAST(:edition AS uuid) IS NULL OR r.edition_id=:edition)
      AND (CAST(:status AS text) IS NULL OR p.status=:status)
      ORDER BY p.submitted_at DESC LIMIT :lim OFFSET :offset''',
      {'edition':edition_id,'status':status,'lim':limit,'offset':offset})

async def team_payment_evidence(db,admin,registration_id):
    # Pending evidence is reviewed from Teams, never counted in Revenue.
    require_super(admin)
    return await many(db,'''SELECT p.id,p.registration_id,p.transaction_id,p.proof_file_id,
        p.claimed_amount,p.currency,p.status,p.submitted_at,p.verified_at,p.rejection_reason
        FROM public.payment_submissions p JOIN public.team_registrations r
          ON r.id=p.registration_id
        WHERE p.registration_id=:id ORDER BY p.submitted_at DESC''',{'id':registration_id})

async def review_payment(db,admin,payment_id,payload):
    require_super(admin)
    row=await one(db,'''SELECT * FROM public.payment_submissions WHERE id=:id FOR UPDATE''',{'id':payment_id})
    if not row:raise HTTPException(404,'Payment not found')
    if row['status']!='PENDING':raise HTTPException(409,'Only pending proofs can be reviewed')
    registration_status=await scalar(db,'''SELECT status FROM public.team_registrations WHERE id=:id''',{'id':row['registration_id']})
    if registration_status not in ('SUBMITTED','REVIEW','APPROVED'):
        raise HTTPException(409,'Submit the team registration before reviewing payment')
    if payload.status=='REJECTED' and not payload.rejection_reason:
        raise HTTPException(422,'Rejection reason is required')
    result=await one(db,'''UPDATE public.payment_submissions SET status=CAST(:status AS text),
      verified_at=CASE WHEN CAST(:status AS text)='VERIFIED' THEN now() ELSE NULL END,
      verified_by=CASE WHEN CAST(:status AS text)='VERIFIED' THEN :actor ELSE NULL END,
      rejection_reason=CASE WHEN CAST(:status AS text)='REJECTED' THEN :reason ELSE NULL END,
      modified_by=:actor WHERE id=:id RETURNING id,status''',
      {'id':payment_id,'status':payload.status,'actor':admin['id'],'reason':payload.rejection_reason})
    await audit(db,admin,'PAYMENT_REVIEW','payment_submissions',payment_id,{'status':row['status']},
                {'status':payload.status})
    await db.commit()
    return result

async def review_team(db,admin,rid,payload):
    await require(db,admin,'REGISTRATION_REVIEW')
    row=await one(db,'''SELECT * FROM public.team_registrations WHERE id=:id FOR UPDATE''',{'id':rid})
    if not row:raise HTTPException(404,'Team not found')
    if row['status'] not in ('SUBMITTED','REVIEW'):
        raise HTTPException(409,'Only submitted/reviewed teams may be updated')
    if payload.status=='APPROVED':
        free_test=await scalar(db,'''SELECT EXISTS(
          SELECT 1 FROM public.hackathon_editions e
          JOIN public.payment_settings p ON p.edition_id=e.id
          WHERE e.id=:edition AND e.edition_code='MIIH_TEST_48H'
          AND p.id=:payment AND p.fee_amount=0 AND NOT p.payment_required
          AND NOT p.proof_required)''',
          {'edition':row['edition_id'],'payment':row['payment_setting_id']})
        if not free_test:
            verified=await scalar(db,'''SELECT EXISTS(SELECT 1 FROM public.payment_submissions
              WHERE registration_id=:id AND status='VERIFIED')''',{'id':rid})
            if not verified:raise HTTPException(409,'Verify team payment before approving registration')
    await db.execute(text('''UPDATE public.team_registrations SET status=:status,modified_by=:actor
      WHERE id=:id'''),{'id':rid,'status':payload.status,'actor':admin['id']})
    await db.execute(text('''INSERT INTO public.registration_status_history
      (registration_id,old_status,new_status,reason,changed_by_admin_id,created_by)
      VALUES (:id,:before,:after,:reason,:actor,:actor)'''),
      {'id':rid,'before':row['status'],'after':payload.status,'reason':payload.reason,'actor':admin['id']})
    await audit(db,admin,'TEAM_REVIEW','team_registrations',rid,
                {'status':row['status']},{'status':payload.status})
    await db.commit()
    return {'id':rid,'status':payload.status}

async def audit(db,admin,action,table,id,before=None,after=None):
    import json
    await db.execute(text('''INSERT INTO public.admin_audit_logs
       (admin_id,action,entity_table,entity_id,before_value,after_value,created_by)
       VALUES (:actor,:action,:table,:id,cast(:before AS jsonb),cast(:after AS jsonb),:actor)'''),
       {'actor':admin['id'],'action':action,'table':table,'id':id,
        'before':json.dumps(before),'after':json.dumps(after)})

async def statistics(db,admin,edition_id=None):
    await require(db,admin,'STATISTICS_VIEW')
    return {'by_domain':await many(db,'''SELECT d.domain_name,count(r.id) AS registered_teams
        FROM public.domains d LEFT JOIN public.team_registrations r
          ON r.domain_id=d.id AND r.status<>'DRAFT' AND (CAST(:eid AS uuid) IS NULL OR r.edition_id=:eid)
          AND r.edition_id NOT IN (SELECT id FROM public.hackathon_editions WHERE edition_code LIKE 'MIIH_TEST_%')
        GROUP BY d.id,d.domain_name ORDER BY registered_teams DESC,d.domain_name''',{'eid':edition_id}),
      'by_status':await many(db,'''SELECT status,count(*) AS teams FROM public.team_registrations
        WHERE (CAST(:eid AS uuid) IS NULL OR edition_id=:eid)
        AND edition_id NOT IN (SELECT id FROM public.hackathon_editions WHERE edition_code LIKE 'MIIH_TEST_%') GROUP BY status ORDER BY status''',{'eid':edition_id}),
      'by_day':await many(db,'''SELECT submitted_at::date AS day,count(*) AS teams
       FROM public.team_registrations WHERE submitted_at IS NOT NULL
       AND (CAST(:eid AS uuid) IS NULL OR edition_id=:eid)
       AND edition_id NOT IN (SELECT id FROM public.hackathon_editions WHERE edition_code LIKE 'MIIH_TEST_%')
       GROUP BY day ORDER BY day DESC LIMIT 100''',{'eid':edition_id})}

async def history(db,admin,edition_id=None):
    await require(db,admin,'HISTORY_VIEW')
    return {'editions':await many(db,'''SELECT id,title,edition_code,year,status,starts_at,ends_at,location
      FROM public.hackathon_editions WHERE (CAST(:id AS uuid) IS NULL OR id=:id) ORDER BY year DESC NULLS LAST''',{'id':edition_id}),
      'highlights':await many(db,'''SELECT h.id,h.edition_id,h.title,h.description,h.highlight_date,
       h.media_file_id,h.metrics_json FROM public.edition_highlights h
       WHERE (CAST(:id AS uuid) IS NULL OR h.edition_id=:id) ORDER BY h.highlight_date DESC NULLS LAST''',{'id':edition_id})}

async def logs(db,admin,limit=100,offset=0):
    require_super(admin)
    return await many(db,'''SELECT l.action,l.entity_table,l.entity_id,l.activity_at,l.admin_id,
      a.full_name AS admin_name,a.email AS admin_email,l.before_value,l.after_value
      FROM public.admin_audit_logs l LEFT JOIN public.admin_users a ON a.id=l.admin_id
      ORDER BY l.activity_at DESC LIMIT :lim OFFSET :skip''',
      {'lim':limit,'skip':offset})

async def team_detail(db,admin,registration_id):
    await require(db,admin,'TEAMS_VIEW')
    row=await one(db,'''SELECT r.id,r.team_id,r.registration_code,r.team_name,r.source_team_id,
      r.status,r.investor_pitch_interest,r.submitted_at,e.title AS edition,d.domain_name
      FROM public.team_registrations r
      JOIN public.hackathon_editions e ON e.id=r.edition_id
      LEFT JOIN public.domains d ON d.id=r.domain_id WHERE r.id=:id''',{'id':registration_id})
    if not row:raise HTTPException(404,'Team not found')
    if admin['role']=='SUPER_ADMIN':
        show_private=True
    else:
        allowed=await __import__('src.service.access_service',fromlist=['permissions']).permissions(db,admin)
        show_private='PARTICIPANTS_VIEW' in allowed
    if show_private:
        row['members']=await many(db,'''SELECT id,full_name,email,mobile,role,member_order,photo_file_id
          FROM public.team_members WHERE registration_id=:id ORDER BY member_order''',{'id':registration_id})
        row['answers']=await many(db,'''SELECT q.field_key,q.question_label,m.member_order,
          a.answer_json,a.uploaded_file_id
          FROM public.form_answers a JOIN public.form_questions q ON q.id=a.question_id
          LEFT JOIN public.team_members m ON m.id=a.team_member_id
          WHERE a.registration_id=:id ORDER BY q.display_order,m.member_order''',{'id':registration_id})
    else:
        row['members']=[]
        row['answers']=[]
        row['private_data_hidden']=True
    return row

async def member_detail(db,admin,member_id):
    await require(db,admin,'PARTICIPANTS_VIEW')
    row=await one(db,'''SELECT m.id,m.full_name,m.email,m.mobile,m.role,m.member_order,
      m.photo_file_id,r.registration_code,r.team_name,e.title AS edition
      FROM public.team_members m JOIN public.team_registrations r ON r.id=m.registration_id
      JOIN public.hackathon_editions e ON e.id=r.edition_id WHERE m.id=:id''',{'id':member_id})
    if not row:raise HTTPException(404,'Participant not found')
    return row

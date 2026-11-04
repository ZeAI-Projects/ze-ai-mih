import hashlib
import re
import secrets
from uuid import UUID
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from src.repository.query_utils import one, many, scalar
from src.repository.registration_repository import RegistrationRepository
from src.service.pitch_conditions import is_pitch_dependent


def verify_draft_token(reg:dict|None,token:str|None):
    if not reg: raise HTTPException(404,'Registration not found')
    if not token or len(token)<40 or not reg.get('leader_edit_token_hash'):
        raise HTTPException(401,'Registration edit token required')
    expected=reg['leader_edit_token_hash']
    if not secrets.compare_digest(hashlib.sha256(token.encode()).hexdigest(),expected):
        raise HTTPException(403,'Incorrect registration edit token')

async def authorized_draft(db,rid,token,lock=False):
    reg=await RegistrationRepository(db).registration(rid,lock=lock)
    verify_draft_token(reg,token)
    if reg['status']!='DRAFT':raise HTTPException(409,'Registration is no longer editable')
    return reg

async def create_draft(db,edition_code):
    edition=await one(db,'''SELECT e.*,f.id AS form_version_id FROM public.hackathon_editions e
      JOIN public.form_versions f ON f.edition_id=e.id AND f.status='PUBLISHED'
      WHERE e.edition_code=:code AND e.is_published AND e.status='OPEN'
      AND (e.registration_opens_at IS NULL OR e.registration_opens_at<=now())
      AND (e.registration_closes_at IS NULL OR e.registration_closes_at>=now())''',{'code':edition_code})
    if not edition: raise HTTPException(409,'Registration is not open or form is not published')
    secret=secrets.token_urlsafe(36)
    payment=await one(db,'''SELECT id FROM public.payment_settings WHERE edition_id=:id
       AND is_active ORDER BY config_version DESC LIMIT 1''',{'id':edition['id']})
    row=await one(db,'''INSERT INTO public.team_registrations
      (edition_id,form_version_id,payment_setting_id,leader_edit_token_hash,team_size_rules_snapshot)
      VALUES (:edition,:version,:pay,:hash,
      jsonb_build_object('min_team_size',cast(:min AS integer),'max_team_size',cast(:max AS integer),'default_team_size',cast(:default AS integer)))
      RETURNING id,registration_code,status''',
      {'edition':edition['id'],'version':edition['form_version_id'],'pay':payment['id'] if payment else None,
       'hash':hashlib.sha256(secret.encode()).hexdigest(),
       'min':edition['min_team_size'],'max':edition['max_team_size'],'default':edition['default_team_size']})
    await db.commit()
    return {**row,'edit_token':secret, 'note':'Store this token privately; it cannot be recovered. Draft is not a submitted registration.'}

async def save_team(db,rid,token,payload):
    reg=await authorized_draft(db,rid,token,lock=True)
    size=len(payload.members)
    if not reg['min_team_size']<=size<=reg['max_team_size']:
        raise HTTPException(422,f'Team needs {reg["min_team_size"]} to {reg["max_team_size"]} members')
    emails=[m.email.strip().casefold() for m in payload.members]
    if len(set(emails))!=len(emails):raise HTTPException(422,'Team member emails must be unique')
    if payload.domain_id and not await scalar(db,'''SELECT EXISTS(
        SELECT 1 FROM public.edition_domains ed JOIN public.domains d ON d.id=ed.domain_id
        WHERE ed.edition_id=:e AND ed.domain_id=:d AND ed.is_enabled AND d.is_active)''',
        {'e':reg['edition_id'],'d':payload.domain_id}):
        raise HTTPException(422,'Domain is not enabled for this edition')
    await db.execute(__import__('sqlalchemy').text('''UPDATE public.team_registrations SET
       team_name=:name,source_team_id=:source,participant_category=:category,
       investor_pitch_interest=:pitch,domain_id=:domain WHERE id=:rid'''),
       {'rid':rid,'name':payload.team_name.strip(),'source':payload.source_team_id,
        'category':payload.participant_category,'pitch':payload.investor_pitch_interest,'domain':payload.domain_id})
    existing=await RegistrationRepository(db).members(rid)
    if len(existing)>size:
        # Safe removal only while no related data is attached to surplus members.
        for m in existing[size:]:
            references=await scalar(db,'''SELECT EXISTS(SELECT 1 FROM public.form_answers WHERE team_member_id=:id)
              OR EXISTS(SELECT 1 FROM public.participant_consents WHERE member_id=:id)''',{'id':m['id']})
            if references:raise HTTPException(409,'Cannot remove a member with recorded answers/consents')
        await db.execute(__import__('sqlalchemy').text('''DELETE FROM public.team_members
          WHERE registration_id=:rid AND member_order>:size'''),{'rid':rid,'size':size})
    for i,m in enumerate(payload.members,1):
        await db.execute(__import__('sqlalchemy').text('''INSERT INTO public.team_members
           (registration_id,role,member_order,full_name,email,mobile)
           VALUES (:rid,:role,:position,:name,:email,:mobile)
           ON CONFLICT (registration_id,member_order) DO UPDATE SET
             full_name=EXCLUDED.full_name,email=EXCLUDED.email,mobile=EXCLUDED.mobile'''),
           {'rid':rid,'role':'LEADER' if i==1 else 'MEMBER','position':i,
            'name':m.full_name.strip(),'email':m.email.strip(),'mobile':m.mobile.strip()})
    # Changing the leader's pitch answer to No must also remove previously
    # saved pitch details. Historical submitted registrations are untouched:
    # authorized_draft() requires DRAFT status and locks that row.
    if payload.investor_pitch_interest is False:
        from sqlalchemy import text
        form_questions = await RegistrationRepository(db).questions(reg['form_version_id'])
        for dependent in form_questions:
            if is_pitch_dependent(dependent):
                await db.execute(text('''DELETE FROM public.form_answers
                    WHERE registration_id=:rid AND question_id=:qid'''),
                    {'rid':rid,'qid':dependent['id']})
    # Mirror canonical team/member fields into the editable form so the leader
    # enters names/emails only once, even though those fields are form questions.
    from sqlalchemy import text
    import json
    members=await RegistrationRepository(db).members(rid)
    qs={q['field_key']:q for q in await RegistrationRepository(db).questions(reg['form_version_id'])}
    async def upsert(q,value,member=None):
        if value is None or value=='':return
        sql='''INSERT INTO public.form_answers(registration_id,team_member_id,question_id,answer_json)
               VALUES (:rid,:member,:qid,cast(:value AS jsonb))'''
        sql+=(''' ON CONFLICT (registration_id,team_member_id,question_id)
                WHERE team_member_id IS NOT NULL DO UPDATE SET answer_json=EXCLUDED.answer_json'''
              if member else ''' ON CONFLICT (registration_id,question_id)
                WHERE team_member_id IS NULL DO UPDATE SET answer_json=EXCLUDED.answer_json''')
        await db.execute(text(sql),{'rid':rid,'member':member,'qid':q['id'],'value':json.dumps(str(value) if isinstance(value,UUID) else value)})
    for key,value in {'team_name':payload.team_name,'source_team_id':payload.source_team_id,
                      'participant_category':payload.participant_category,
                      'investor_pitch_interest':payload.investor_pitch_interest,
                      'team_domain':payload.domain_id}.items():
        if key in qs:await upsert(qs[key],value)
    for m in members:
        for key in ('full_name','email','mobile'):
            if key in qs:await upsert(qs[key],m[key],m['id'])
    await db.commit()
    return await RegistrationRepository(db).snapshot(rid)

async def save_answers(db,rid,token,payload):
    reg=await authorized_draft(db,rid,token,lock=True)
    questions={str(q['id']):q for q in await RegistrationRepository(db).questions(reg['form_version_id'])}
    members={m['member_order']:m for m in await RegistrationRepository(db).members(rid)}
    if not members:raise HTTPException(409,'Save team members first')
    if len(set((a.question_id,a.member_order) for a in payload.answers))!=len(payload.answers):
        raise HTTPException(422,'Duplicate question answers')
    # First validate all inputs to avoid accepting half an invalid form.
    ready=[]
    for a in payload.answers:
        q=questions.get(str(a.question_id))
        if not q:raise HTTPException(422,'Invalid or inactive question')
        if q['input_type']=='DERIVED':raise HTTPException(422,'Derived answers cannot be submitted')
        # Pitch answers are inapplicable after the leader chooses No.
        # Allow clear:true to support discarding stale values, but never
        # accept new pitch data when the canonical answer is No/unknown.
        if is_pitch_dependent(q) and reg.get('investor_pitch_interest') is not True and not a.clear:
            raise HTTPException(422,'Investor-pitch details are only applicable when the team selects Yes')
        scope=q['answer_scope']
        if q['field_key'] in ('terms_consent','media_consent','communication_consent') and scope=='MEMBER':
            raise HTTPException(409,'This form requires individual confirmations. Contact the organizer for the leader-completed registration form.')
        if scope in ('MEMBER','LEADER'):
            member=members.get(a.member_order)
            if not member or (scope=='LEADER' and member['role']!='LEADER'):
                raise HTTPException(422,'Invalid member for question')
        elif a.member_order is not None:raise HTTPException(422,'Team answer cannot select a member')
        else:member=None
        if a.clear:
            ready.append((q,member,a))
            continue
        if a.file_id:
            if q['input_type']!='FILE':raise HTTPException(422,'File not valid for this question')
            allowed=await one(db,'''SELECT id,mime_type FROM public.file_assets WHERE id=:fid
              AND registration_id=:rid AND storage_bucket='miih-registration-private' ''',
              {'fid':a.file_id,'rid':rid})
            if not allowed:raise HTTPException(422,'File does not belong to this registration')
            if ('photo' in q['field_key'] or 'portrait' in q['field_key']) and allowed['mime_type'] not in ('image/jpeg','image/png','image/webp'):
                raise HTTPException(422,'Profile photographs must be JPG, PNG or WebP images')
        else:
            if q['input_type']=='FILE':raise HTTPException(422,'File required')
            if q['input_type']=='BOOLEAN' and type(a.value) is not bool:
                raise HTTPException(422,'Expected a Yes/No value')
            if q['input_type'] in ('TEXT','TEXTAREA','EMAIL','PHONE','URL','DATE','SINGLE_SELECT'):
                if not isinstance(a.value,str) or not a.value.strip():
                    raise HTTPException(422,'Expected a nonempty text answer')
            if q['input_type']=='EMAIL' and not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+',a.value):
                raise HTTPException(422,'Invalid email')
            if q['input_type']=='PHONE' and (not re.fullmatch(r'\+?[0-9 ()-]+',a.value) or not 7<=len(re.sub(r'\D','',a.value))<=15):
                raise HTTPException(422,'Invalid phone number')
            if q['input_type']=='URL' and not a.value.startswith(('https://','http://')):
                raise HTTPException(422,'Invalid web address')
            if q['input_type']=='NUMBER' and (isinstance(a.value,bool) or not isinstance(a.value,(float,int))):
                raise HTTPException(422,'Invalid number')
            if q['input_type']=='MULTI_SELECT' and not isinstance(a.value,list):
                raise HTTPException(422,'Expected multiple options')
            if q['input_type'] in ('SINGLE_SELECT','MULTI_SELECT'):
                opts=await many(db,'''SELECT option_value FROM public.form_question_options
                   WHERE question_id=:id AND is_active''',{'id':q['id']})
                allowed={x['option_value'] for x in opts}
                values=a.value if isinstance(a.value,list) else [a.value]
                if allowed and any(str(x) not in allowed for x in values):
                    raise HTTPException(422,'Invalid question option')
            if q['validation_rules'].get('must_be_true') and a.value is not True:
                raise HTTPException(422,'Participant terms must be accepted')
        ready.append((q,member,a))
    from sqlalchemy import text
    import json
    for q,m,a in ready:
        if a.clear:
            await db.execute(text('''DELETE FROM public.form_answers WHERE registration_id=:rid
                AND question_id=:qid AND team_member_id IS NOT DISTINCT FROM :member'''),
                {'rid':rid,'qid':q['id'],'member':m['id'] if m else None})
            if q['field_key']=='photo' and m:
                await db.execute(text('UPDATE public.team_members SET photo_file_id=NULL WHERE id=:mid'),{'mid':m['id']})
            continue
        await db.execute(text('''INSERT INTO public.form_answers
            (registration_id,team_member_id,question_id,answer_json,uploaded_file_id)
            VALUES (:rid,:member,:qid,cast(:value AS jsonb),:file)
            ON CONFLICT DO NOTHING'''),
            {'rid':rid,'member':m['id'] if m else None,'qid':q['id'],
             'value':json.dumps(a.value),'file':a.file_id})
        await db.execute(text('''UPDATE public.form_answers SET answer_json=cast(:value AS jsonb),
            uploaded_file_id=:file,answered_at=now()
            WHERE registration_id=:rid AND question_id=:qid AND
            team_member_id IS NOT DISTINCT FROM :member'''),
            {'rid':rid,'member':m['id'] if m else None,'qid':q['id'],
             'value':json.dumps(a.value),'file':a.file_id})
        field=q['field_key']
        bindings={'team_name':('team_name',str),'source_team_id':('source_team_id',str),
                  'participant_category':('participant_category',str),
                  'investor_pitch_interest':('investor_pitch_interest',bool),
                  'team_domain':('domain_id',str)}
        if not m and field in bindings:
            col,typ=bindings[field]
            # fixed server-owned allowlist of SQL identifiers
            await db.execute(text(f'UPDATE public.team_registrations SET {col}=:value WHERE id=:rid'),
                             {'value':UUID(a.value) if field=='team_domain' else a.value,'rid':rid})
        if field=='photo' and m and a.file_id:
            await db.execute(text('''UPDATE public.team_members SET photo_file_id=:file WHERE id=:mid'''),
                             {'file':a.file_id,'mid':m['id']})
        if m and field in ('terms_consent','media_consent','communication_consent'):
            await db.execute(text('''INSERT INTO public.participant_consents
              (member_id,question_id,consent_type,response,policy_version)
              VALUES (:mid,:qid,:kind,:result,:version)
              ON CONFLICT (member_id,question_id,policy_version) DO UPDATE SET response=EXCLUDED.response,recorded_at=now()'''),
              {'mid':m['id'],'qid':q['id'], 'kind':{'terms_consent':'TERMS','media_consent':'MEDIA',
               'communication_consent':'COMMUNICATION'}[field], 'result':a.value,'version':str(reg['form_version_id'])})
    await db.commit()
    return {'saved':len(ready)}

async def record_payment(db,rid,token,payload):
    reg=await authorized_draft(db,rid,token,lock=True)
    pay=await one(db,'''SELECT * FROM public.payment_settings
      WHERE edition_id=:edition AND is_active ORDER BY config_version DESC LIMIT 1''',
      {'edition':reg['edition_id']})
    if pay and pay['id']!=reg['payment_setting_id']:
        from sqlalchemy import text
        # Only rebind if this draft has no previous payment evidence.
        count=await scalar(db,'''SELECT count(*) FROM public.payment_submissions
          WHERE registration_id=:rid''',{'rid':rid})
        if count:raise HTTPException(409,'Existing payment evidence requires admin review')
        await db.execute(text('''UPDATE public.team_registrations
          SET payment_setting_id=:pid WHERE id=:rid'''),{'pid':pay['id'],'rid':rid})
    if not pay or not pay.get('razorpay_payment_url') or 'example.com' in pay['razorpay_payment_url']:
        raise HTTPException(409,'Payment is not configured yet')
    asset=await one(db,'''SELECT id FROM public.file_assets WHERE id=:id
       AND registration_id=:rid AND storage_bucket='miih-registration-private'
       AND mime_type LIKE 'image/%' ''',{'id':payload.proof_file_id,'rid':rid})
    if not asset:raise HTTPException(422,'Payment screenshot must belong to this registration')
    from sqlalchemy import text
    await db.execute(text('''INSERT INTO public.payment_submissions
      (registration_id,payment_setting_id,transaction_id,proof_file_id,claimed_amount,currency)
      VALUES (:rid,:config,:txn,:file,:fee,:currency)'''),
      {'rid':rid,'config':pay['id'],'txn':payload.transaction_id.strip(),
       'file':payload.proof_file_id,'fee':pay['fee_amount'],'currency':pay['currency']})
    # Keep dynamic registration questions consistent with the payment evidence.
    for key,value,fid in (('payment_transaction_id',payload.transaction_id.strip(),None),
                          ('payment_proof',None,payload.proof_file_id)):
        q=await one(db,'''SELECT q.id FROM public.form_questions q JOIN public.form_sections s ON s.id=q.section_id
          WHERE s.form_version_id=:fv AND q.field_key=:key AND q.is_active''',
          {'fv':reg['form_version_id'],'key':key})
        if q:
            await db.execute(text('''INSERT INTO public.form_answers
               (registration_id,question_id,answer_json,uploaded_file_id)
               VALUES (:rid,:q,cast(:json AS jsonb),:fid)
               ON CONFLICT (registration_id,question_id) WHERE team_member_id IS NULL
               DO UPDATE SET answer_json=EXCLUDED.answer_json,uploaded_file_id=EXCLUDED.uploaded_file_id'''),
               {'rid':rid,'q':q['id'],'json':__import__('json').dumps(value),'fid':fid})
    await db.commit()
    return {'status':'PENDING','message':'Payment evidence saved. You can submit registration now; admin approval is not required.'}

async def errors(db,rid,token):
    reg=await RegistrationRepository(db).registration(rid)
    verify_draft_token(reg,token)
    return await scalar(db,'SELECT public.miih_submission_errors(:id)',{'id':rid})

async def submit(db,rid,token):
    reg=await authorized_draft(db,rid,token,lock=True)
    current=await scalar(db,'SELECT public.miih_submission_errors(:id)',{'id':rid})
    if current: raise HTTPException(422,{'validation_errors':current})
    from sqlalchemy import text
    submitted=await one(db,'''UPDATE public.team_registrations SET status='SUBMITTED' WHERE id=:id AND status='DRAFT' RETURNING team_id,registration_code,team_name,submitted_at''',{'id':rid})
    if not submitted or not submitted['team_id']:
        raise HTTPException(500,'Team ID migration is missing or generation failed')
    await db.execute(text('''INSERT INTO public.registration_status_history
       (registration_id,old_status,new_status,reason)
       VALUES (:id,'DRAFT','SUBMITTED','Submitted by team leader')'''),{'id':rid})
    await db.commit()
    return {'team_id':submitted['team_id'],'registration_code':submitted['registration_code'],
            'team_name':submitted['team_name'],'submitted_at':submitted['submitted_at'],
            'status':'SUBMITTED',
            'payment_status':'NOT_REQUIRED' if reg['edition_code']=='MIIH_TEST_48H' else 'DETAILS_RECEIVED'}

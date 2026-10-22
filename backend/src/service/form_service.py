from fastapi import HTTPException
from sqlalchemy import text
from src.repository.query_utils import one,many,scalar
from src.service.access_service import require,require_super
from src.service.admin_activity import record

async def list_versions(db,admin,eid):
    await require(db,admin,'FORM_VIEW')
    return await many(db,'''SELECT id,edition_id,version_number,status,name,published_at
       FROM public.form_versions WHERE edition_id=:eid ORDER BY version_number DESC''',{'eid':eid})

async def form_details(db,admin,version):
    await require(db,admin,'FORM_VIEW')
    v=await one(db,'SELECT * FROM public.form_versions WHERE id=:id',{'id':version})
    if not v:raise HTTPException(404,'Form not found')
    v['sections']=await many(db,'''SELECT * FROM public.form_sections
      WHERE form_version_id=:id ORDER BY display_order''',{'id':version})
    for sec in v['sections']:
        sec['questions']=await many(db,'''SELECT * FROM public.form_questions
          WHERE section_id=:id ORDER BY display_order''',{'id':sec['id']})
        for q in sec['questions']:
            q['options']=await many(db,'''SELECT * FROM public.form_question_options
               WHERE question_id=:id ORDER BY display_order''',{'id':q['id']})
    return v

async def clone(db,admin,eid):
    await require(db,admin,'FORM_EDIT')
    await one(db,'SELECT id FROM public.hackathon_editions WHERE id=:eid FOR UPDATE',{'eid':eid})
    orig=await one(db,'''SELECT * FROM public.form_versions WHERE edition_id=:eid
      ORDER BY version_number DESC LIMIT 1''',{'eid':eid})
    if not orig:raise HTTPException(404,'No source form')
    latest=await one(db,'''INSERT INTO public.form_versions(edition_id,version_number,name,created_by)
      VALUES (:eid,:n,:name,:actor) RETURNING id,version_number,status''',
      {'eid':eid,'n':orig['version_number']+1,'name':f'MIIH Form v{orig["version_number"]+1}',
       'actor':admin['id']})
    secs=await many(db,'''SELECT * FROM public.form_sections WHERE form_version_id=:v
      ORDER BY display_order''',{'v':orig['id']})
    for sec in secs:
        new_sec=await one(db,'''INSERT INTO public.form_sections
          (form_version_id,section_key,title,description,display_order,is_active,created_by)
          VALUES (:fv,:key,:title,:description,:sort,:active,:actor) RETURNING id''',
          {'fv':latest['id'],'key':sec['section_key'],'title':sec['title'],
           'description':sec['description'],'sort':sec['display_order'],
           'active':sec['is_active'],'actor':admin['id']})
        qs=await many(db,'''SELECT * FROM public.form_questions WHERE section_id=:sid
           ORDER BY display_order''',{'sid':sec['id']})
        for q in qs:
            import json
            new_q=await one(db,'''INSERT INTO public.form_questions
             (section_id,field_key,legacy_question_number,question_label,description,
              placeholder,input_type,answer_scope,storage_binding,is_required,is_active,
              display_order,validation_rules,visibility_rules,default_value,created_by)
             VALUES (:sec,:key,:n,:label,:desc,:placeholder,:type,:scope,:binding,:req,:active,
              :sort,cast(:validation AS jsonb),cast(:visibility AS jsonb),cast(:default AS jsonb),:actor)
             RETURNING id''',{'sec':new_sec['id'],'key':q['field_key'],
               'n':q['legacy_question_number'],'label':q['question_label'],
               'desc':q['description'],'placeholder':q['placeholder'],'type':q['input_type'],
               'scope':q['answer_scope'],'binding':q['storage_binding'],'req':q['is_required'],
               'active':q['is_active'],'sort':q['display_order'],
               'validation':json.dumps(q['validation_rules']),
               'visibility':json.dumps(q['visibility_rules']),
               'default':json.dumps(q['default_value']), 'actor':admin['id']})
            opts=await many(db,'''SELECT * FROM public.form_question_options WHERE question_id=:q''',{'q':q['id']})
            for opt in opts:
                await db.execute(text('''INSERT INTO public.form_question_options
                  (question_id,option_value,option_label,display_order,is_active,created_by)
                  VALUES (:q,:val,:lab,:sort,:active,:actor)'''),
                  {'q':new_q['id'],'val':opt['option_value'],'lab':opt['option_label'],
                   'sort':opt['display_order'],'active':opt['is_active'],'actor':admin['id']})
    await record(db,admin,'FORM_VERSION_CREATED','form_versions',latest['id'],
                 after={'edition_id':str(eid),'version_number':latest['version_number'],'name':f'MIIH Form v{latest["version_number"]}'})
    await db.commit()
    return latest

async def rename_version(db, admin, version, payload):
    # Rename only, with no changes to questions or publication state.
    new_name = payload.name.strip()
    if len(new_name) < 2:
        raise HTTPException(422, 'Enter a version name of at least 2 characters')
    previous = await one(db, '''SELECT id, name, status, version_number
      FROM public.form_versions WHERE id=:id FOR UPDATE''', {'id':version})
    if not previous:
        raise HTTPException(404, 'Form version not found')
    if previous['status'] != 'DRAFT':
        require_super(admin)
    else:
        await require(db, admin, 'FORM_EDIT')
    if previous['name'] == new_name:
        return previous
    result = await one(db, '''UPDATE public.form_versions
      SET name=:name, modified_by=:actor, modified_at=now()
      WHERE id=:id RETURNING id, name, status, version_number''',
      {'id':version, 'name':new_name, 'actor':admin['id']})
    await record(db, admin, 'FORM_VERSION_RENAMED', 'form_versions', version,
                 before={'name':previous['name'], 'version_number':previous['version_number']},
                 after={'name':new_name, 'version_number':previous['version_number']})
    await db.commit()
    return result

async def question_update(db,admin,qid,payload):
    await require(db,admin,'FORM_EDIT')
    changes=payload.model_dump(exclude_unset=True)
    if not changes:raise HTTPException(422,'No changes')
    q=await one(db,'''SELECT q.id,v.status FROM public.form_questions q
      JOIN public.form_sections s ON s.id=q.section_id
      JOIN public.form_versions v ON v.id=s.form_version_id
      WHERE q.id=:qid''',{'qid':qid})
    if not q:raise HTTPException(404,'Question not found')
    if q['status']!='DRAFT':raise HTTPException(409,'Clone a new draft version to edit a published form')
    import json
    for key in ('validation_rules','visibility_rules'):
        if key in changes:changes[key]=json.dumps(changes[key])
    update=', '.join(f'{key}=cast(:{key} AS jsonb)' if key in ('validation_rules','visibility_rules')
                     else f'{key}=:{key}' for key in changes)
    result=await one(db,f'''UPDATE public.form_questions SET {update},modified_by=:actor
       WHERE id=:qid RETURNING id,field_key,question_label,is_required,is_active''',
       {**changes,'actor':admin['id'],'qid':qid})
    await db.commit()
    return result

async def add_question(db,admin,section_id,payload):
    await require(db,admin,'FORM_EDIT')
    sec=await one(db,'''SELECT s.id,v.status FROM public.form_sections s
     JOIN public.form_versions v ON v.id=s.form_version_id WHERE s.id=:id''',{'id':section_id})
    if not sec:raise HTTPException(404,'Section not found')
    if sec['status']!='DRAFT':raise HTTPException(409,'Only draft forms can be edited')
    if payload.input_type not in {'TEXT','TEXTAREA','EMAIL','PHONE','DATE','NUMBER','URL','SINGLE_SELECT','MULTI_SELECT','BOOLEAN','FILE','DERIVED'} or payload.answer_scope not in {'TEAM','MEMBER','LEADER','PITCH'}:
        raise HTTPException(422,'Unsupported input type or answer scope')
    row=await one(db,'''INSERT INTO public.form_questions
      (section_id,field_key,question_label,input_type,answer_scope,is_required,display_order,created_by)
      VALUES (:sec,:key,:label,:typ,:scope,:required,:sort,:actor)
      RETURNING id,field_key,question_label,is_required''',
      {'sec':section_id,'key':payload.field_key,'label':payload.question_label,
       'typ':payload.input_type,'scope':payload.answer_scope,'required':payload.is_required,
       'sort':payload.display_order,'actor':admin['id']})
    await db.commit()
    return row

async def add_option(db,admin,qid,payload):
    await require(db,admin,'FORM_EDIT')
    q=await one(db,'''SELECT v.status FROM public.form_questions q
      JOIN public.form_sections s ON s.id=q.section_id
      JOIN public.form_versions v ON v.id=s.form_version_id WHERE q.id=:id''',{'id':qid})
    if not q:raise HTTPException(404,'Question not found')
    if q['status']!='DRAFT':raise HTTPException(409,'Only draft questions can be changed')
    row=await one(db,'''INSERT INTO public.form_question_options
      (question_id,option_value,option_label,display_order,is_active,created_by)
      VALUES (:qid,:value,:label,:sort,:active,:actor)
      ON CONFLICT (question_id,option_value) DO UPDATE SET
       option_label=EXCLUDED.option_label,display_order=EXCLUDED.display_order,is_active=EXCLUDED.is_active
      RETURNING id,option_value,option_label,is_active''',
      {'qid':qid,'value':payload.option_value,'label':payload.option_label,
       'sort':payload.display_order,'active':payload.is_active,'actor':admin['id']})
    await db.commit()
    return row

async def publish(db,admin,version):
    require_super(admin)
    target=await one(db,'''SELECT * FROM public.form_versions WHERE id=:id''',{'id':version})
    if not target:raise HTTPException(404,'Form not found')
    if target['status']!='DRAFT':raise HTTPException(409,'Only draft versions can be published')
    await one(db,'''SELECT id FROM public.hackathon_editions WHERE id=:eid FOR UPDATE''',{'eid':target['edition_id']})
    await db.execute(text('''UPDATE public.form_versions SET status='ARCHIVED'
      WHERE edition_id=:edition AND status='PUBLISHED' '''),{'edition':target['edition_id']})
    result=await one(db,'''UPDATE public.form_versions
      SET status='PUBLISHED',published_at=now(),published_by=:admin
      WHERE id=:id RETURNING id,version_number,status''',{'id':version,'admin':admin['id']})
    await record(db,admin,'FORM_PUBLISHED','form_versions',version,after={'version_number':result['version_number']})
    await db.commit()
    return result

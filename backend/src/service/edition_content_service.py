import json
from fastapi import HTTPException
from src.repository.query_utils import many,one
from src.service.access_service import require,require_super
from src.service.admin_activity import record

async def safe_to_edit(db,admin,eid):
    await require(db,admin,'EVENT_EDIT')
    edition=await one(db,'''SELECT id,is_published FROM public.hackathon_editions WHERE id=:id''',{'id':eid})
    if not edition:raise HTTPException(404,'Edition not found')
    if edition['is_published']:require_super(admin)

async def blocks(db,admin,eid):
    await require(db,admin,'EVENT_VIEW')
    return await many(db,'''SELECT * FROM public.edition_content_blocks
      WHERE edition_id=:id ORDER BY display_order''',{'id':eid})

async def save_block(db,admin,eid,p):
    await safe_to_edit(db,admin,eid)
    result=await one(db,'''INSERT INTO public.edition_content_blocks
     (edition_id,block_key,block_type,title,body,content_json,asset_file_id,display_order,is_visible,created_by)
     VALUES (:eid,:key,:type,:title,:body,cast(:content AS jsonb),:asset,:position,:visible,:actor)
     ON CONFLICT (edition_id,block_key) DO UPDATE SET block_type=EXCLUDED.block_type,
      title=EXCLUDED.title,body=EXCLUDED.body,content_json=EXCLUDED.content_json,
      asset_file_id=EXCLUDED.asset_file_id,display_order=EXCLUDED.display_order,
      is_visible=EXCLUDED.is_visible,modified_by=:actor
     RETURNING id,block_key,block_type,title,is_visible''',
     {'eid':eid,'key':p.block_key,'type':p.block_type,'title':p.title,'body':p.body,
      'content':json.dumps(p.content_json),'asset':p.asset_file_id,
      'position':p.display_order,'visible':p.is_visible,'actor':admin['id']})
    await record(db,admin,'EVENT_CONTENT_SAVED','edition_content_blocks',result['id'],after={'title':p.title,'block_key':p.block_key,'visible':p.is_visible})
    await db.commit();return result

async def highlights(db,admin,eid):
    await require(db,admin,'HISTORY_VIEW')
    return await many(db,'''SELECT * FROM public.edition_highlights
       WHERE edition_id=:id ORDER BY display_order''',{'id':eid})

async def add_highlight(db,admin,eid,p):
    await safe_to_edit(db,admin,eid)
    result=await one(db,'''INSERT INTO public.edition_highlights
      (edition_id,title,description,highlight_date,media_file_id,metrics_json,
       display_order,is_visible,created_by)
      VALUES (:eid,:title,:description,:day,:asset,cast(:metrics AS jsonb),:sort,:visible,:actor)
      RETURNING id,title''',
      {'eid':eid,'title':p.title,'description':p.description,'day':p.highlight_date,
       'asset':p.media_file_id,'metrics':json.dumps(p.metrics_json),'sort':p.display_order,
       'visible':p.is_visible,'actor':admin['id']})
    await record(db,admin,'HIGHLIGHT_CREATED','edition_highlights',result['id'],after={'title':p.title})
    await db.commit();return result

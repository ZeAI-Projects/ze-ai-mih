from uuid import UUID
from fastapi import HTTPException
from sqlalchemy import text
from src.repository.query_utils import one,many,scalar
from src.service.access_service import require,require_super
from src.service.admin_activity import record

async def slots(db,admin,page=None):
    await require(db,admin,'SITE_PREVIEW')
    return await many(db,'''SELECT s.*,pub.revision_number AS published_revision,
      draft.revision_number AS latest_draft_revision
      FROM public.site_content_slots s
      LEFT JOIN LATERAL (SELECT revision_number FROM public.site_content_revisions r
         WHERE r.slot_id=s.id AND r.status='PUBLISHED' LIMIT 1) pub ON TRUE
      LEFT JOIN LATERAL (SELECT revision_number FROM public.site_content_revisions r
         WHERE r.slot_id=s.id AND r.status IN ('DRAFT','IN_REVIEW')
         ORDER BY revision_number DESC LIMIT 1) draft ON TRUE
      WHERE (CAST(:page AS text) IS NULL OR s.page_key=:page) ORDER BY s.page_key,s.section_key,s.slot_key''',{'page':page})

async def preview(db,admin,page):
    await require(db,admin,'SITE_PREVIEW')
    if page not in ('GLOBAL','HOME','ABOUT','GALLERY','REGISTER'):raise HTTPException(404,'Unknown page')
    return await many(db,'''SELECT s.id AS slot_id,s.section_key,s.slot_key,s.slot_type,s.editor_label,
      r.id AS revision_id,r.status,r.text_value,r.link_url,r.alt_text,r.asset_file_id,r.poster_file_id,r.content_json,
      r.display_order,r.is_visible,a.file_url AS asset_url,p.file_url AS poster_url
      FROM public.site_content_slots s
      LEFT JOIN LATERAL (SELECT * FROM public.site_content_revisions r
        WHERE r.slot_id=s.id AND r.status IN ('DRAFT','IN_REVIEW','PUBLISHED')
        ORDER BY CASE WHEN r.status='DRAFT' THEN 0 WHEN r.status='IN_REVIEW' THEN 1 ELSE 2 END,
        r.revision_number DESC LIMIT 1) r ON TRUE
      LEFT JOIN public.file_assets a ON a.id=r.asset_file_id
      LEFT JOIN public.file_assets p ON p.id=r.poster_file_id
      WHERE s.page_key=:page ORDER BY s.section_key,s.slot_key''',{'page':page})

async def create_revision(db,admin,slot_id:UUID,payload):
    slot=await one(db,'''SELECT * FROM public.site_content_slots WHERE id=:id FOR UPDATE''',{'id':slot_id})
    if not slot or not slot['is_editable']:raise HTTPException(404,'Editable slot not found')
    await require(db,admin,'GALLERY_EDIT' if slot['page_key']=='GALLERY' else 'SITE_CONTENT_EDIT')
    if slot['slot_type'] in ('IMAGE','VIDEO','GALLERY_ITEM','BANNER') and not payload.asset_file_id:
        # Allow clearing an image only by explicitly marking it invisible.
        if payload.is_visible: raise HTTPException(422,'Visible media slots require an uploaded asset')
    revision=await one(db,'''INSERT INTO public.site_content_revisions
     (slot_id,revision_number,status,text_value,link_url,alt_text,asset_file_id,poster_file_id,
      content_json,display_order,is_visible,created_by_admin_id)
     VALUES (:slot,(SELECT COALESCE(MAX(revision_number),0)+1 FROM public.site_content_revisions WHERE slot_id=:slot),
      'DRAFT',:content,:link,:alt,:asset,:poster,cast(:json AS jsonb),:position,:visible,:author)
     RETURNING id,slot_id,revision_number,status''',
     {'slot':slot_id,'content':payload.text_value,'link':payload.link_url,'alt':payload.alt_text,
      'asset':payload.asset_file_id,'poster':payload.poster_file_id,
      'json':__import__('json').dumps(payload.content_json), 'position':payload.display_order,
      'visible':payload.is_visible,'author':admin['id']})
    await record(db,admin,'STUDIO_DRAFT_SAVED','site_content_revisions',revision['id'],after={'slot_id':str(slot_id)})
    await db.commit()
    return revision

async def publish_revision(db,admin,revision_id:UUID):
    require_super(admin)
    row=await one(db,'''SELECT r.*,s.page_key FROM public.site_content_revisions r
      JOIN public.site_content_slots s ON s.id=r.slot_id WHERE r.id=:id''',{'id':revision_id})
    if not row:raise HTTPException(404,'Revision not found')
    # Lock the parent slot before changing one-published-revision constraint.
    await one(db,'''SELECT id FROM public.site_content_slots WHERE id=:id FOR UPDATE''',{'id':row['slot_id']})
    if row['status'] not in ('DRAFT','IN_REVIEW'):
        raise HTTPException(409,'Only draft/review revisions can be published')
    await db.execute(text('''UPDATE public.site_content_revisions SET status='ARCHIVED'
      WHERE slot_id=:slot AND status='PUBLISHED' '''),{'slot':row['slot_id']})
    await db.execute(text('''UPDATE public.site_content_revisions
      SET status='PUBLISHED',published_at=now(),published_by_admin_id=:actor
      WHERE id=:id'''),{'id':revision_id,'actor':admin['id']})
    await record(db,admin,'STUDIO_MEDIA_PUBLISHED','site_content_revisions',revision_id,
                 after={'slot_id':str(row['slot_id'])})
    await db.commit()
    return {'id':revision_id,'status':'PUBLISHED'}

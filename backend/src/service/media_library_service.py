"""Staff-facing media library built on existing CMS tables (no schema migration).

Every bundled public image/video is catalogued. Replacements are admin-uploaded
public Supabase assets, versioned as drafts and published by Super Admin.
"""
import json
from functools import lru_cache
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import HTTPException
from pydantic import BaseModel, Field

from src.repository.query_utils import many, one
from src.service.access_service import require, require_super
from src.service import cms_service
from src.models.admin_ops_requests import ContentRevision
from sqlalchemy import text
from src.service.admin_activity import record


CATEGORIES = ('Hackathon Photos','Hackathon Videos','Afterparty','Highlights','Other')

class NewMedia(BaseModel):
    label: str = Field(min_length=2,max_length=120)
    category: str
    kind: str
    asset_file_id: UUID
    alt_text: str | None = None


class MediaReplacement(BaseModel):
    asset_file_id: UUID
    alt_text: str | None = None


@lru_cache

def manifest():
    filename = Path(__file__).resolve().parents[1] / 'data' / 'site_media_catalog.json'
    return json.loads(filename.read_text(encoding='utf-8'))


async def media_library(db, admin):
    await require(db, admin, 'SITE_PREVIEW')
    rows = await many(db, '''
        SELECT s.id AS slot_id, s.slot_key,
          pub.id AS published_revision_id, pub.asset_file_id AS published_file_id,
          pub_asset.file_url AS published_url, pub.alt_text AS published_alt,
          draft.id AS draft_revision_id, draft.asset_file_id AS draft_file_id,
          draft_asset.file_url AS draft_url, draft.alt_text AS draft_alt
        FROM public.site_content_slots s
        LEFT JOIN LATERAL (
            SELECT id,asset_file_id,alt_text FROM public.site_content_revisions
            WHERE slot_id=s.id AND status='PUBLISHED' LIMIT 1
        ) pub ON TRUE
        LEFT JOIN LATERAL (
            SELECT id,asset_file_id,alt_text FROM public.site_content_revisions
            WHERE slot_id=s.id AND status IN ('DRAFT','IN_REVIEW')
            ORDER BY revision_number DESC LIMIT 1
        ) draft ON TRUE
        LEFT JOIN public.file_assets pub_asset ON pub_asset.id=pub.asset_file_id
        LEFT JOIN public.file_assets draft_asset ON draft_asset.id=draft.asset_file_id
        WHERE s.page_key='GALLERY' AND s.section_key='MEDIA_LIBRARY'
    ''')
    indexed = {row['slot_key']: row for row in rows}
    static=[]
    for item in manifest():
        src=str(item.get('original_src') or '').lower()
        category=('Afterparty' if 'afterparty' in src else
                  'Hackathon Videos' if item['kind']=='VIDEO' else 'Hackathon Photos')
        static.append({**item,'group':category,**(indexed.get(item['key']) or {})})
    additions=await many(db,'''SELECT s.id AS slot_id,s.slot_key,
      pub.id AS published_revision_id,a.file_url AS published_url,pub.alt_text AS published_alt,
      draft.id AS draft_revision_id,da.file_url AS draft_url,draft.alt_text AS draft_alt,
      COALESCE(pub.content_json,draft.content_json,'{}'::jsonb) AS media_metadata,
      s.slot_type AS kind,s.editor_label AS label
      FROM public.site_content_slots s
      LEFT JOIN LATERAL (SELECT id,asset_file_id,alt_text,content_json
        FROM public.site_content_revisions WHERE slot_id=s.id AND status='PUBLISHED'
        ORDER BY revision_number DESC LIMIT 1) pub ON TRUE
      LEFT JOIN LATERAL (SELECT id,asset_file_id,alt_text,content_json
        FROM public.site_content_revisions WHERE slot_id=s.id AND status='DRAFT'
        ORDER BY revision_number DESC LIMIT 1) draft ON TRUE
      LEFT JOIN public.file_assets a ON a.id=pub.asset_file_id
      LEFT JOIN public.file_assets da ON da.id=draft.asset_file_id
      WHERE s.page_key='GALLERY' AND s.section_key='MEDIA_ADDITIONS'
      ORDER BY s.created_at DESC''')
    for entry in additions:
        meta=entry.pop('media_metadata') or {}
        entry.update(key=entry.pop('slot_key'),group=meta.get('category','Other'),
                     original_src=entry.get('published_url') or entry.get('draft_url') or '',
                     is_new=True)
    return [*static,*additions]


async def replace_media(db, admin, key: str, replacement: MediaReplacement):
    await require(db, admin, 'GALLERY_EDIT')
    original = next((item for item in manifest() if item['key'] == key), None)
    if not original:
        dynamic=next((item for item in await media_library(db,admin) if item['key']==key and item.get('is_new')),None)
        if not dynamic:raise HTTPException(404,'Media item not found')
        original=dynamic
    asset = await one(db, '''
       SELECT id,storage_bucket,mime_type,file_url
       FROM public.file_assets WHERE id=:id
    ''', {'id': replacement.asset_file_id})
    expected = 'video/' if original['kind'] == 'VIDEO' else 'image/'
    if not asset or asset['storage_bucket'] != 'miih-event-public' or not asset['mime_type'].startswith(expected) or not asset['file_url']:
        raise HTTPException(422, 'Please upload a matching public image or video first')
    section = 'MEDIA_ADDITIONS' if original.get('is_new') else 'MEDIA_LIBRARY'
    slot = await one(db, '''
        INSERT INTO public.site_content_slots
          (page_key,section_key,slot_key,slot_type,editor_label,editor_help,created_by)
        VALUES ('GALLERY',:section,:key,:kind,:label,
          'Original website asset replacement',:actor)
        ON CONFLICT (page_key,section_key,slot_key)
        DO UPDATE SET modified_at=now()
        RETURNING id
    ''', {'key': key, 'kind': original['kind'], 'label': original['label'], 'actor': admin['id'],'section':section})
    result = await cms_service.create_revision(db, admin, slot['id'], ContentRevision(
        asset_file_id=replacement.asset_file_id,
        alt_text=replacement.alt_text or original['label'],
        content_json=({'category':original.get('group','Other'),'added_media':True} if original.get('is_new') else {'original_src': original['original_src'], 'media_key': key}),
        is_visible=True,
    ))
    return result


async def publish_media(db, admin, revision_id: UUID):
    require_super(admin)
    found = await one(db, '''
        SELECT r.id FROM public.site_content_revisions r
        JOIN public.site_content_slots s ON s.id=r.slot_id
        WHERE r.id=:id AND s.page_key='GALLERY' AND s.section_key IN ('MEDIA_LIBRARY','MEDIA_ADDITIONS')
    ''', {'id': revision_id})
    if not found:
        raise HTTPException(404, 'Media draft not found')
    return await cms_service.publish_revision(db, admin, revision_id)

async def restore_original(db, admin, key: str):
    require_super(admin)
    if not any(item['key']==key for item in manifest()):
        raise HTTPException(404,'Media item not found')
    slot=await one(db,"""SELECT id FROM public.site_content_slots
      WHERE page_key='GALLERY' AND section_key='MEDIA_LIBRARY' AND slot_key=:key FOR UPDATE""",{'key':key})
    if slot:
        await db.execute(text("""UPDATE public.site_content_revisions SET status='ARCHIVED'
          WHERE slot_id=:id AND status IN ('PUBLISHED','DRAFT','IN_REVIEW')"""),{'id':slot['id']})
        await record(db,admin,'STUDIO_ORIGINAL_RESTORED','site_content_slots',slot['id'],after={'media_key':key})
        await db.commit()
    return {'restored':True}


async def create_media(db, admin, payload: NewMedia):
    await require(db,admin,'GALLERY_EDIT')
    if payload.category not in CATEGORIES or payload.kind not in ('IMAGE','VIDEO'):
        raise HTTPException(422,'Choose a valid category and media type')
    asset=await one(db,'''SELECT id,storage_bucket,mime_type,file_url
       FROM public.file_assets WHERE id=:id''',{'id':payload.asset_file_id})
    expected='image/' if payload.kind=='IMAGE' else 'video/'
    if not asset or asset['storage_bucket']!='miih-event-public' or not asset['mime_type'].startswith(expected) or not asset['file_url']:
        raise HTTPException(422,'Upload a matching public media file first')
    key='added_'+uuid4().hex
    slot=await one(db,'''INSERT INTO public.site_content_slots
        (page_key,section_key,slot_key,slot_type,editor_label,editor_help,created_by)
        VALUES ('GALLERY','MEDIA_ADDITIONS',:key,:kind,:label,
                'Gallery media added by administrator',:actor)
        RETURNING id''',{'key':key,'kind':payload.kind,'label':payload.label,'actor':admin['id']})
    result=await cms_service.create_revision(db,admin,slot['id'],ContentRevision(
        asset_file_id=payload.asset_file_id, alt_text=payload.alt_text or payload.label,
        content_json={'category':payload.category,'added_media':True},is_visible=True))
    return {'key':key,'revision_id':result['id'] if isinstance(result,dict) else result.id,
            'message':'Media draft created. Publish it to add to the gallery.'}


async def published_additions(db):
    return await many(db,'''SELECT s.slot_key AS key,s.slot_type AS kind,s.editor_label AS label,
      r.alt_text,a.file_url AS url,
      COALESCE(r.content_json->>'category','Other') AS category
      FROM public.site_content_slots s
      JOIN LATERAL (SELECT asset_file_id,alt_text,content_json
        FROM public.site_content_revisions WHERE slot_id=s.id AND status='PUBLISHED' AND is_visible
        ORDER BY revision_number DESC LIMIT 1) r ON TRUE
      JOIN public.file_assets a ON a.id=r.asset_file_id
      WHERE s.page_key='GALLERY' AND s.section_key='MEDIA_ADDITIONS'
      ORDER BY s.created_at DESC''')

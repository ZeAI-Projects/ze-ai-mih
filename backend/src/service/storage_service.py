"""Storage uses a SERVER-ONLY Supabase secret; never expose it in a browser."""
from urllib.parse import quote
from uuid import uuid4,UUID
import httpx
from fastapi import HTTPException, UploadFile
from config import get_settings
from src.repository.query_utils import one

PRIVATE='miih-registration-private'
PUBLIC='miih-event-public'
EXPORT='miih-exports-private'
MAX_PHOTO=10*1024*1024
MAX_VIDEO=50*1024*1024
MAX_EXPORT=50*1024*1024
ALLOWED={
 PRIVATE:{'image/jpeg','image/png','image/webp','application/pdf'},
 PUBLIC:{'image/jpeg','image/png','image/webp','application/pdf','video/mp4','video/webm'},
 EXPORT:{'text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},
}
def server_headers(settings):
    key=settings.storage_server_key
    if not key:
        raise HTTPException(503,'File uploads are temporarily unavailable. Please contact the organizer.')
    headers={'apikey':key}
    if not key.startswith('sb_secret_'):
        headers['Authorization']='Bearer '+key
    return headers

async def upload(db, *, bucket:str, file: UploadFile, edition_id=None, registration_id=None, admin_id=None):
    if bucket not in ALLOWED or (file.content_type or '').lower() not in ALLOWED[bucket]:
        raise HTTPException(422,'Unsupported file type')
    max_size= MAX_EXPORT if bucket==EXPORT else MAX_VIDEO if (file.content_type or '').startswith('video/') else MAX_PHOTO
    raw=await file.read(max_size+1)
    if not raw or len(raw)>max_size: raise HTTPException(413,'File too large or empty')
    # Minimal signature checks so a MIME header alone cannot upload HTML/scripts.
    mime=file.content_type.lower()
    signatures={'image/jpeg':b'\xff\xd8\xff','image/png':b'\x89PNG\r\n\x1a\n','application/pdf':b'%PDF-'}
    if mime in signatures and not raw.startswith(signatures[mime]): raise HTTPException(422,'Invalid file signature')
    if mime=='image/webp' and not(raw.startswith(b'RIFF') and raw[8:12]==b'WEBP'):
        raise HTTPException(422,'Invalid WEBP')
    if mime=='video/mp4' and b'ftyp' not in raw[4:16]: raise HTTPException(422,'Invalid MP4')
    if mime=='video/webm' and not raw.startswith(b'\x1a\x45\xdf\xa3'): raise HTTPException(422,'Invalid WebM')
    ext={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','application/pdf':'.pdf',
         'video/mp4':'.mp4','video/webm':'.webm','text/csv':'.csv',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'.xlsx'}[mime]
    path=f'{registration_id or edition_id or "site"}/{uuid4().hex}{ext}'
    settings=get_settings()
    url=f'{str(settings.supabase_url).rstrip("/")}/storage/v1/object/{bucket}/{quote(path,safe="/")}'
    headers={**server_headers(settings),'Content-Type':mime,'x-upsert':'false'}
    try:
        async with httpx.AsyncClient(timeout=70) as c:
            response=await c.post(url,headers=headers,content=raw)
    except httpx.HTTPError as exc: raise HTTPException(503,'Storage unavailable') from exc
    if response.status_code not in (200,201): raise HTTPException(502,'Storage rejected upload')
    public_url=url.replace('/storage/v1/object/','/storage/v1/object/public/') if bucket==PUBLIC else None
    row=await one(db,'''INSERT INTO public.file_assets
       (edition_id,registration_id,storage_bucket,storage_path,file_url,original_filename,
        mime_type,size_bytes,is_private,uploaded_by_admin_id,created_by)
       VALUES (:edition,:registration,:bucket,:path,:url,:filename,:mime,:size,:private,:admin,:admin)
       RETURNING id,storage_bucket,storage_path,file_url,mime_type,size_bytes''',
       {'edition':edition_id,'registration':registration_id,'bucket':bucket,'path':path,'url':public_url,
        'filename':(file.filename or 'upload')[:255], 'mime':mime,'size':len(raw),
        'private':bucket!=PUBLIC,'admin':admin_id})
    return row

async def signed_url(asset:dict):
    if not asset: raise HTTPException(404,'File not found')
    if asset['storage_bucket']==PUBLIC:
        return asset.get('file_url') or f'{str(get_settings().supabase_url).rstrip("/")}/storage/v1/object/public/{PUBLIC}/{quote(asset["storage_path"],safe="/")}'
    settings=get_settings()
    if not settings.storage_server_key: raise HTTPException(503,'Storage unavailable')
    endpoint=f'{str(settings.supabase_url).rstrip("/")}/storage/v1/object/sign/{asset["storage_bucket"]}/{quote(asset["storage_path"],safe="/")}'
    async with httpx.AsyncClient(timeout=15) as c:
        res=await c.post(endpoint,headers=server_headers(settings),json={'expiresIn':120})
    if res.status_code!=200: raise HTTPException(502,'Cannot obtain signed file URL')
    signed=res.json().get('signedURL','')
    return f'{str(settings.supabase_url).rstrip("/")}/storage/v1{signed}' if signed.startswith('/') else signed

"""Optional server routes for Supabase Auth: signup/login, with no password stored in DB."""
import httpx
from fastapi import APIRouter,HTTPException,Depends
from pydantic import BaseModel,ConfigDict,Field
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db_session
from config import get_settings
from src.service.access_service import current_admin
from src.repository.query_utils import one

router=APIRouter(prefix='/auth',tags=['Admin Login & Signup'])

class Account(BaseModel):
    model_config=ConfigDict(extra='forbid')
    email:str=Field(min_length=6,max_length=254)
    password:str=Field(min_length=8,max_length=256)

class ProfileUpdate(BaseModel):
    model_config=ConfigDict(extra='forbid')
    full_name:str=Field(min_length=2,max_length=200)

async def supabase_auth(path:str,payload:dict):
    conf=get_settings()
    async with httpx.AsyncClient(timeout=12) as client:
        try:
            r=await client.post(f'{str(conf.supabase_url).rstrip("/")}/auth/v1/{path}',
               headers={'apikey':conf.supabase_publishable_key,'Content-Type':'application/json'},json=payload)
        except httpx.HTTPError as exc:
            raise HTTPException(503,'Authentication server unavailable') from exc
    if r.status_code>=400:
        # Return a generic error rather than an internal Supabase stack trace.
        raise HTTPException(400,'Authentication request rejected')
    return r.json()

@router.post('/signup')
async def signup(account:Account):
    await supabase_auth('signup',account.model_dump())
    return {'message':'Check your email for confirmation, then sign in and apply for admin access.'}

@router.post('/login')
async def login(account:Account):
    response=await supabase_auth('token?grant_type=password',account.model_dump())
    return {'access_token':response.get('access_token'),'refresh_token':response.get('refresh_token'),
            'token_type':'bearer','expires_in':response.get('expires_in')}

@router.patch('/admin/profile')
async def profile_update(body:ProfileUpdate,admin=Depends(current_admin),db:AsyncSession=Depends(get_db_session)):
    row=await one(db,'''UPDATE public.admin_users SET full_name=:name,modified_by=:id
      WHERE id=:id RETURNING id,full_name,email,role,approval_status''',
      {'id':admin['id'],'name':body.full_name.strip()})
    await db.commit()
    return row

class RefreshRequest(BaseModel):
    model_config=ConfigDict(extra='forbid')
    refresh_token:str=Field(min_length=12)

@router.post('/refresh')
async def refresh_session(body:RefreshRequest):
    response=await supabase_auth('token?grant_type=refresh_token',body.model_dump())
    return {'access_token':response.get('access_token'),'refresh_token':response.get('refresh_token'),
            'token_type':'bearer','expires_in':response.get('expires_in')}

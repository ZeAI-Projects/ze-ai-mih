from dataclasses import dataclass
from uuid import UUID

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config import get_settings

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class VerifiedIdentity:
    user_id: UUID
    email: str | None
    email_verified: bool = False


async def get_verified_identity(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> VerifiedIdentity:
    if credentials is None or credentials.scheme.lower() != 'bearer':
        raise HTTPException(status_code=401, detail='Bearer token required')

    settings = get_settings()
    headers = {
        'Authorization': f'Bearer {credentials.credentials}',
        'apikey': settings.supabase_publishable_key,
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                f'{str(settings.supabase_url).rstrip("/")}/auth/v1/user', headers=headers,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail='Authentication service unavailable') from exc

    if response.status_code in {401, 403}:
        raise HTTPException(status_code=401, detail='Invalid or expired token')
    if response.status_code != 200:
        raise HTTPException(status_code=503, detail='Authentication service unavailable')
    try:
        body = response.json()
        return VerifiedIdentity(
            user_id=UUID(body['id']),
            email=body.get('email'),
            email_verified=bool(body.get('email_confirmed_at')),
        )
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(status_code=503, detail='Malformed authentication response') from exc

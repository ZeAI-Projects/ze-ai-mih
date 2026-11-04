"""Public challenge catalogue and narrowly scoped, audited staff authoring."""
from typing import Literal
from uuid import UUID
import re

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError
from database import get_db_session
from src.repository.query_utils import one, many
from src.service.access_service import current_admin, require, require_super
from src.service.admin_activity import record

router = APIRouter(tags=['Problem statements'])
TrackCode = Literal['RISING_BUILDERS', 'NEXT_LEVEL_BUILDERS']
EDITION_PATTERN = r'^[A-Z][A-Z0-9_]{0,63}$'


async def require_challenge_schema(db: AsyncSession = Depends(get_db_session)):
    """Report pending installation without leaking database errors or hiding domains."""
    try:
        schema = await one(db, "SELECT to_regclass('public.problem_statement_tracks') AS tracks, to_regclass('public.problem_statements') AS statements")
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(503, {'code': 'CHALLENGE_SERVICE_UNAVAILABLE', 'message': 'The challenge service is temporarily unavailable. Please try again.'}, headers={'Cache-Control': 'no-store'}) from None
    if not schema or not schema['tracks'] or not schema['statements']:
        raise HTTPException(503, {'code': 'CHALLENGE_SCHEMA_MISSING', 'message': 'The challenge catalogue is not configured yet. Please check back soon.'}, headers={'Cache-Control': 'no-store'})


class StatementInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    edition_id: UUID
    domain_id: UUID
    track_id: UUID
    statement_code: str = Field(min_length=1, max_length=64, pattern=EDITION_PATTERN)
    title: str = Field(min_length=1, max_length=200)
    summary: str = Field(max_length=1000, default='')
    description: str = Field(max_length=16000, default='')
    expected_outcome: str = Field(max_length=4000, default='')
    difficulty: str = Field(max_length=40, default='')
    display_order: int = Field(default=0, ge=0, le=100000)
    status: Literal['DRAFT', 'PUBLISHED', 'ARCHIVED'] = 'DRAFT'

    @field_validator('title', 'summary', 'description', 'expected_outcome', 'difficulty')
    @classmethod
    def plain_text(cls, value):
        # Authoring accepts plain text only; never persist executable markup.
        if '<' in value or '>' in value or re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', value):
            raise ValueError('Use plain text without HTML or control characters')
        return value


async def public_edition(db, code):
    edition = await one(db, '''SELECT id FROM public.hackathon_editions
        WHERE edition_code=:code AND is_published AND edition_code NOT LIKE 'MIIH_TEST_%' ''', {'code': code})
    if not edition:
        raise HTTPException(404, 'Published edition not found')
    return edition['id']


@router.get('/public/problem-statement-tracks', dependencies=[Depends(require_challenge_schema)])
async def tracks(response: Response, db: AsyncSession = Depends(get_db_session)):
    response.headers['Cache-Control'] = 'public, max-age=60'
    return await many(db, '''SELECT id,code,name,description FROM public.problem_statement_tracks
        WHERE is_active AND code IN ('RISING_BUILDERS','NEXT_LEVEL_BUILDERS') ORDER BY display_order,code''')


@router.get('/public/challenge-domains')
async def domains(response: Response, edition_code: str = Query('MIIH_UPCOMING', pattern=EDITION_PATTERN),
                  db: AsyncSession = Depends(get_db_session)):
    eid = await public_edition(db, edition_code)
    response.headers['Cache-Control'] = 'public, max-age=60'
    return await many(db, '''SELECT d.id,d.domain_code,d.domain_name FROM public.edition_domains ed
        JOIN public.domains d ON d.id=ed.domain_id WHERE ed.edition_id=:id
        AND ed.is_enabled AND d.is_active ORDER BY ed.display_order,d.display_order,d.id''', {'id': eid})


PUBLIC_FROM = '''FROM public.problem_statements p
    JOIN public.problem_statement_tracks t ON t.id=p.track_id
    JOIN public.domains d ON d.id=p.domain_id
    JOIN public.edition_domains ed ON ed.edition_id=p.edition_id AND ed.domain_id=p.domain_id
    WHERE p.edition_id=:edition AND p.status='PUBLISHED' AND t.is_active AND d.is_active
    AND ed.is_enabled AND t.code IN ('RISING_BUILDERS','NEXT_LEVEL_BUILDERS')'''


@router.get('/public/problem-statements', dependencies=[Depends(require_challenge_schema)])
async def statements(response: Response, edition_code: str = Query('MIIH_UPCOMING', pattern=EDITION_PATTERN),
                     track_code: TrackCode | None = None, domain_id: UUID | None = None,
                     page: int = Query(1, ge=1, le=10000), page_size: int = Query(12, ge=1, le=50),
                     db: AsyncSession = Depends(get_db_session)):
    params = {'edition': await public_edition(db, edition_code), 'limit': page_size, 'offset': (page-1)*page_size}
    sql = PUBLIC_FROM
    if track_code:
        sql += ' AND t.code=:track'
        params['track'] = track_code
    if domain_id:
        sql += ' AND p.domain_id=:domain'
        params['domain'] = domain_id
    count = await one(db, 'SELECT count(*) AS total ' + sql, params)
    items = await many(db, '''SELECT p.id,p.title,p.summary,p.difficulty,t.name AS track_name,
        t.code AS track_code,d.domain_name ''' + sql + ' ORDER BY p.display_order,p.id LIMIT :limit OFFSET :offset', params)
    response.headers['Cache-Control'] = 'public, max-age=30'
    return {'items': items, 'total': count['total'], 'page': page, 'page_size': page_size}


@router.get('/public/problem-statements/{statement_id}', dependencies=[Depends(require_challenge_schema)])
async def statement_detail(statement_id: UUID, response: Response,
                           edition_code: str = Query('MIIH_UPCOMING', pattern=EDITION_PATTERN),
                           db: AsyncSession = Depends(get_db_session)):
    params = {'edition': await public_edition(db, edition_code), 'id': statement_id}
    item = await one(db, 'SELECT p.id,p.description,p.expected_outcome ' + PUBLIC_FROM + ' AND p.id=:id', params)
    if not item:
        raise HTTPException(404, 'Challenge not found')
    response.headers['Cache-Control'] = 'public, max-age=30'
    return item


@router.get('/admin/problem-statements')
async def admin_list(edition_id: UUID, page: int = Query(1, ge=1, le=10000),
                     db: AsyncSession = Depends(get_db_session), admin: dict = Depends(current_admin)):
    await require(db, admin, 'EVENT_VIEW')
    return await many(db, '''SELECT * FROM public.problem_statements WHERE edition_id=:id
        ORDER BY display_order,id LIMIT 50 OFFSET :offset''', {'id': edition_id, 'offset': (page-1)*50})


async def save_statement(db, admin, data, statement_id=None):
    await require(db, admin, 'EVENT_EDIT')
    before = None
    if statement_id:
        before = await one(db, 'SELECT * FROM public.problem_statements WHERE id=:id FOR UPDATE', {'id': statement_id})
        if not before:
            raise HTTPException(404, 'Challenge not found')
        if str(before['edition_id']) != str(data.edition_id):
            raise HTTPException(422, 'Cannot move a challenge between editions')
    if data.status == 'PUBLISHED' or (before and before['status'] == 'PUBLISHED'):
        require_super(admin)
    valid = await one(db, '''SELECT ed.domain_id FROM public.edition_domains ed
        JOIN public.domains d ON d.id=ed.domain_id
        JOIN public.problem_statement_tracks t ON t.id=:track
        WHERE ed.edition_id=:edition AND ed.domain_id=:domain AND ed.is_enabled AND d.is_active
        AND t.is_active AND t.code IN ('RISING_BUILDERS','NEXT_LEVEL_BUILDERS')''',
        {'edition': data.edition_id, 'domain': data.domain_id, 'track': data.track_id})
    if not valid:
        raise HTTPException(422, 'Choose an active track and an enabled edition domain')
    params = data.model_dump()
    duplicate = await one(db, '''SELECT id FROM public.problem_statements WHERE edition_id=:edition_id
        AND track_id=:track_id AND domain_id=:domain_id AND statement_code=:statement_code''', params)
    if duplicate and str(duplicate['id']) != str(statement_id):
        raise HTTPException(409, 'Statement code already exists in this track and domain')
    # Column names originate exclusively from the closed Pydantic model above.
    if statement_id:
        sql = 'UPDATE public.problem_statements SET ' + ','.join(f'{key}=:{key}' for key in params) + ' WHERE id=:id RETURNING *'
        params['id'] = statement_id
    else:
        sql = 'INSERT INTO public.problem_statements (' + ','.join(params) + ') VALUES (' + ','.join(':'+key for key in params) + ') RETURNING *'
    after = await one(db, sql, params)
    await record(db, admin, 'PROBLEM_STATEMENT_SAVE', 'problem_statements', after['id'], before, after)
    await db.commit()
    return after


@router.post('/admin/problem-statements', status_code=201)
async def create(data: StatementInput, db: AsyncSession = Depends(get_db_session), admin: dict = Depends(current_admin)):
    return await save_statement(db, admin, data)


@router.put('/admin/problem-statements/{statement_id}')
async def update(statement_id: UUID, data: StatementInput, db: AsyncSession = Depends(get_db_session), admin: dict = Depends(current_admin)):
    return await save_statement(db, admin, data, statement_id)


@router.delete('/admin/problem-statements/{statement_id}')
async def delete(statement_id: UUID, db: AsyncSession = Depends(get_db_session), admin: dict = Depends(current_admin)):
    require_super(admin)
    before = await one(db, 'DELETE FROM public.problem_statements WHERE id=:id RETURNING *', {'id': statement_id})
    if not before:
        raise HTTPException(404, 'Challenge not found')
    await record(db, admin, 'PROBLEM_STATEMENT_DELETE', 'problem_statements', statement_id, before, None)
    await db.commit()
    return {'deleted': True}

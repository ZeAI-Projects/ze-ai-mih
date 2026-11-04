"""Small parameterized-query helpers. No raw user-supplied SQL identifiers."""
from sqlalchemy import text

async def one(db, sql, params=None):
    result = await db.execute(text(sql), params or {})
    row = result.mappings().one_or_none()
    return dict(row) if row else None

async def many(db, sql, params=None):
    result = await db.execute(text(sql), params or {})
    return [dict(x) for x in result.mappings().all()]

async def scalar(db, sql, params=None):
    return (await db.execute(text(sql), params or {})).scalar()

async def write(db, sql, params=None):
    return await one(db,sql,params)

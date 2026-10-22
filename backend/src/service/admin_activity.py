"""Central transaction-safe audit trail for staff edits.

Called BEFORE the enclosing service transaction commits, so the audit and the
business change either commit together or roll back together.
"""
import json
from sqlalchemy import text

async def record(db, admin, action, table_name, entity_id=None, before=None, after=None):
    await db.execute(text("""
        INSERT INTO public.admin_audit_logs
          (admin_id,action,entity_table,entity_id,before_value,after_value)
        VALUES (:actor,:action,:entity,:id,CAST(:before AS jsonb),CAST(:after AS jsonb))
    """), {
        'actor': admin['id'], 'action': action, 'entity': table_name,
        'id': entity_id,
        'before': json.dumps(before, default=str) if before is not None else None,
        'after': json.dumps(after, default=str) if after is not None else None,
    })

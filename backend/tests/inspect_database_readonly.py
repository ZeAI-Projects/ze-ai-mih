"""Explicitly read-only readiness inspection; no personal records or secrets printed."""
import sys
from pathlib import Path
sys.path[:0]=[str(Path(__file__).resolve().parents[1]/'.test-deps'),str(Path(__file__).resolve().parents[1])]
import json
import psycopg
from config import get_settings

def main():
    url=get_settings().database_url.replace('postgresql+psycopg://','postgresql://')
    try:
        with psycopg.connect(url,connect_timeout=10,options='-c default_transaction_read_only=on') as conn:
            with conn.cursor() as cur:
                queries={
                    'export_dataset_constraints':"SELECT conname,pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.export_runs'::regclass AND contype='c'",
                    'application_tables':"SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
                    'team_id_column':"SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='team_registrations' AND column_name='team_id'",
                    'registration_triggers':"SELECT tgname,pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid='public.team_registrations'::regclass AND NOT tgisinternal",
                    'enabled_domains':"SELECT e.edition_code,count(*) FILTER (WHERE ed.is_enabled AND d.is_active) FROM public.hackathon_editions e JOIN public.edition_domains ed ON ed.edition_id=e.id JOIN public.domains d ON d.id=ed.domain_id GROUP BY e.edition_code",
                    'editions':"SELECT edition_code,status,is_published,registration_opens_at,registration_closes_at FROM public.hackathon_editions ORDER BY edition_code",
                    'forms':"SELECT e.edition_code,f.version_number,f.status FROM public.form_versions f JOIN public.hackathon_editions e ON e.id=f.edition_id ORDER BY e.edition_code,f.version_number",
                    'active_questions':"SELECT e.edition_code,q.field_key,q.answer_scope,q.input_type,q.is_required FROM public.form_questions q JOIN public.form_sections s ON s.id=q.section_id JOIN public.form_versions f ON f.id=s.form_version_id JOIN public.hackathon_editions e ON e.id=f.edition_id WHERE f.status='PUBLISHED' AND s.is_active AND q.is_active ORDER BY e.edition_code,q.display_order",
                    'payment_config':"SELECT e.edition_code,p.is_active,p.payment_required,p.proof_required,p.fee_amount,(p.razorpay_payment_url='https://pages.razorpay.com/pl_Tq7ND79LNPZBUt/view') AS official_url FROM public.payment_settings p JOIN public.hackathon_editions e ON e.id=p.edition_id ORDER BY e.edition_code,p.config_version",
                    'buckets':"SELECT id,public FROM storage.buckets WHERE id IN ('miih-registration-private','miih-event-public','miih-exports-private')",
                    'storage_policies':"SELECT policyname,cmd,roles FROM pg_policies WHERE schemaname='storage' AND tablename='objects'",
                }
                for name,query in queries.items():
                    cur.execute(query);print(json.dumps({name:cur.fetchall()},default=str))
    except Exception as exc:
        print('Read-only inspection unavailable: '+type(exc).__name__)
        raise SystemExit(1)

def api_checks():
    import asyncio
    from fastapi.testclient import TestClient
    from sqlalchemy.ext.asyncio import create_async_engine,async_sessionmaker
    from database import get_db_session
    from main import app
    async def readonly_session():
        engine=create_async_engine(get_settings().database_url,
            connect_args={'options':'-c default_transaction_read_only=on','connect_timeout':10})
        try:
            async with async_sessionmaker(engine)() as session:
                yield session
        finally:
            await engine.dispose()
    app.dependency_overrides[get_db_session]=readonly_session
    try:
        with TestClient(app,backend_options={'loop_factory':asyncio.SelectorEventLoop}) as client:
            for path in ['/health','/api/v1/public/editions',
                         '/api/v1/public/editions/MIIH_UPCOMING/registration-config',
                         '/api/v1/public/editions/MIIH_TEST_48H/registration-config',
                         '/api/v1/public/test-editions/MIIH_TEST_48H/registration-config']:
                response=client.get(path)
                print(json.dumps({'api':path,'status':response.status_code}))
                expected=404 if '/editions/MIIH_TEST_' in path else 401 if '/test-editions/' in path else 200
                if response.status_code!=expected:raise RuntimeError('Unexpected read-only API status')
    finally:
        app.dependency_overrides.pop(get_db_session,None)


def admin_query_checks():
    import asyncio
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine,async_sessionmaker
    from src.service import operations_service as operations
    from src.service.export_service import DATASETS
    async def check():
        engine=create_async_engine(get_settings().database_url,
            connect_args={'options':'-c default_transaction_read_only=on','connect_timeout':10})
        admin={'role':'SUPER_ADMIN','id':'00000000-0000-0000-0000-000000000000'}
        try:
            for name in ['overview','teams','participants','revenue','statistics','history','logs']:
                async with async_sessionmaker(engine)() as session:
                    result=await getattr(operations,name)(session,admin)
                    if name in ('teams','participants'):
                        assert all(row['status']!='DRAFT' for row in result)
                        drafts=await getattr(operations,name)(session,admin,status='DRAFT')
                        assert all(row['status']=='DRAFT' for row in drafts)
                    print(json.dumps({'admin_query':name,'result':'OK (read only)'}))
            for name,(_,sql) in DATASETS.items():
                async with async_sessionmaker(engine)() as session:
                    await session.execute(text(sql.replace('LIMIT 10001','LIMIT 0')),
                        {'edition':None,'domain':None,'status':None,'start':None,'end':None})
                    print(json.dumps({'export_query':name,'result':'OK (read only)'}))
        finally:
            await engine.dispose()
    with asyncio.Runner(loop_factory=asyncio.SelectorEventLoop) as runner:
        runner.run(check())

if __name__=='__main__':
    main()
    api_checks()
    admin_query_checks()

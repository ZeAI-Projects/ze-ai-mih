-- READ ONLY: review these results before approving migration 18.
SELECT table_name,column_name,data_type,is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name IN
 ('hackathon_editions','domains','edition_domains','admin_audit_logs',
  'problem_statement_tracks','problem_statements')
ORDER BY table_name,ordinal_position;
SELECT conrelid::regclass AS table_name,conname,pg_get_constraintdef(oid)
FROM pg_constraint WHERE connamespace='public'::regnamespace
AND conrelid IN (to_regclass('public.hackathon_editions'),to_regclass('public.domains'),
 to_regclass('public.edition_domains'));
SELECT e.edition_code,e.is_published,e.status,count(d.id) AS enabled_active_domains
FROM public.hackathon_editions e
LEFT JOIN public.edition_domains ed ON ed.edition_id=e.id AND ed.is_enabled
LEFT JOIN public.domains d ON d.id=ed.domain_id AND d.is_active
GROUP BY e.id,e.edition_code,e.is_published,e.status;

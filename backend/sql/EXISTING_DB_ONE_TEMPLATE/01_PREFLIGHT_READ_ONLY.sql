-- READ ONLY: run in your existing Supabase SQL Editor before the migration.
SELECT edition_code, title, status, min_team_size, max_team_size, default_team_size
FROM public.hackathon_editions
WHERE edition_code IN ('MIIH_TEST_48H', 'MIIH_UPCOMING')
ORDER BY edition_code;

SELECT e.edition_code,
       (SELECT count(*) FROM public.team_registrations r WHERE r.edition_id=e.id) AS registrations,
       (SELECT count(*) FROM public.file_assets a WHERE a.edition_id=e.id) AS attached_media,
       (SELECT count(*) FROM public.file_assets a JOIN public.team_registrations r ON r.id=a.registration_id WHERE r.edition_id=e.id) AS registration_files,
       (SELECT count(*) FROM public.form_versions f WHERE f.edition_id=e.id) AS form_versions,
       (SELECT count(*) FROM public.payment_settings p WHERE p.edition_id=e.id) AS payment_configs
FROM public.hackathon_editions e
WHERE e.edition_code IN ('MIIH_TEST_48H','MIIH_UPCOMING');

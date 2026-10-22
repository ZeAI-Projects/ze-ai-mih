-- PRECONDITIONS:
--   1. Apply your previously approved fake-registration cleanup if any test
--      registrations remain. No user submissions are deleted by this script.
--   2. Check 01_PREFLIGHT_READ_ONLY.sql first.
--   3. This is an EXISTING DATABASE change: do not rerun initial schema scripts.
-- A transaction stops safely if the private test edition still owns registrations,
-- file_assets, or an unexpected referencing row.
BEGIN;
DO $migration$
DECLARE
    public_id uuid;
    test_id uuid;
BEGIN
    SELECT id INTO STRICT public_id FROM public.hackathon_editions
    WHERE edition_code = 'MIIH_UPCOMING';

    UPDATE public.hackathon_editions
    SET title='Made In India Hackathon', modified_at=now()
    WHERE id=public_id AND title IS DISTINCT FROM 'Made In India Hackathon';

    SELECT id INTO test_id FROM public.hackathon_editions
    WHERE edition_code = 'MIIH_TEST_48H' FOR UPDATE;
    IF test_id IS NULL THEN
        RAISE NOTICE 'Private test edition already removed';
        RETURN;
    END IF;
    IF EXISTS (SELECT 1 FROM public.team_registrations WHERE edition_id=test_id) THEN
        RAISE EXCEPTION 'Private test edition still has registrations. Do the previously agreed registration cleanup first; no changes were committed.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.file_assets WHERE edition_id=test_id) THEN
        RAISE EXCEPTION 'Private test edition still owns uploaded files. Delete only test files using Supabase Storage API and their file_assets metadata first; no changes were committed.';
    END IF;
    -- Remove dependent option/metadata rows before deleting the test form versions.
    DELETE FROM public.form_question_options WHERE question_id IN (
        SELECT q.id FROM public.form_questions q
        JOIN public.form_sections s ON s.id=q.section_id
        JOIN public.form_versions v ON v.id=s.form_version_id
        WHERE v.edition_id=test_id
    );
    DELETE FROM public.form_questions WHERE section_id IN (
        SELECT s.id FROM public.form_sections s
        JOIN public.form_versions v ON v.id=s.form_version_id
        WHERE v.edition_id=test_id
    );
    DELETE FROM public.form_sections WHERE form_version_id IN (
        SELECT id FROM public.form_versions WHERE edition_id=test_id
    );
    DELETE FROM public.form_versions WHERE edition_id=test_id;
    DELETE FROM public.edition_content_blocks WHERE edition_id=test_id;
    DELETE FROM public.edition_highlights WHERE edition_id=test_id;
    DELETE FROM public.payment_settings WHERE edition_id=test_id;
    DELETE FROM public.export_runs WHERE edition_id=test_id;
    DELETE FROM public.edition_domains WHERE edition_id=test_id;
    DELETE FROM public.hackathon_editions WHERE id=test_id;
END
$migration$;
COMMIT;

-- Verification: one official template with its full version history.
SELECT e.edition_code, e.title, f.version_number, f.name, f.status
FROM public.hackathon_editions e
JOIN public.form_versions f ON f.edition_id=e.id
WHERE e.edition_code='MIIH_UPCOMING'
ORDER BY f.version_number DESC;

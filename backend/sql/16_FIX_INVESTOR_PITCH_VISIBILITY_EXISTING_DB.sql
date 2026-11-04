-- FOR AN EXISTING DATABASE ONLY: investor-pitch question visibility.
-- Safe, additive and idempotent. Does not create/drop tables, publish forms,
-- change payments, or change existing submitted answers.
-- Q25 (investor_pitch_interest) is always visible.
-- Q20-Q24 and Q26 are relevant only if Q25 is Yes.
-- Required because miih_submission_errors() uses visibility_rules to skip
-- inapplicable required questions during final submission.
-- First review the affected rows using the SELECT below; then run the UPDATE.
BEGIN;

-- Inspect the questions to be updated (both live and internal-test editions).
SELECT e.edition_code, v.version_number, v.status, q.id AS question_id,
       q.legacy_question_number, q.field_key, q.answer_scope, q.visibility_rules
FROM public.form_questions q
JOIN public.form_sections s ON s.id=q.section_id
JOIN public.form_versions v ON v.id=s.form_version_id
JOIN public.hackathon_editions e ON e.id=v.edition_id
WHERE e.edition_code IN ('MIIH_UPCOMING', 'MIIH_TEST_48H')
  AND q.field_key <> 'investor_pitch_interest'
  AND (q.legacy_question_number IN (20,21,22,23,24,26) OR q.answer_scope='PITCH')
ORDER BY e.edition_code, v.version_number, q.legacy_question_number;

UPDATE public.form_questions q
SET visibility_rules = COALESCE(q.visibility_rules, '{}'::jsonb)
                       || '{"only_if_pitch_interest":true}'::jsonb
FROM public.form_sections s
JOIN public.form_versions v ON v.id=s.form_version_id
JOIN public.hackathon_editions e ON e.id=v.edition_id
WHERE q.section_id=s.id
  AND e.edition_code IN ('MIIH_UPCOMING', 'MIIH_TEST_48H')
  AND q.field_key <> 'investor_pitch_interest'
  AND (q.legacy_question_number IN (20,21,22,23,24,26) OR q.answer_scope='PITCH')
  AND q.visibility_rules->>'only_if_pitch_interest' IS DISTINCT FROM 'true';

COMMIT;

-- Rollback instructions: Restore the original visibility_rules JSON from a
-- pre-migration database backup for affected question IDs if needed. Do not
-- blindly remove flags: some questions had these flags before this update.

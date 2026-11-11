-- Deactivate the removed Chennai travel question in editable draft forms.
-- Published and archived forms are immutable; the backend ignores this exact
-- legacy question when validating drafts pinned to an older published version.
BEGIN;

SELECT e.edition_code, v.version_number, v.status, q.id AS question_id,
q.question_label, q.is_required, q.is_active
FROM public.form_questions q
JOIN public.form_sections s ON s.id=q.section_id
JOIN public.form_versions v ON v.id=s.form_version_id
JOIN public.hackathon_editions e ON e.id=v.edition_id
WHERE e.edition_code IN ('MIIH_UPCOMING', 'MIIH_TEST_48H')
  AND lower(regexp_replace(trim(q.question_label), '[[:space:]]+', ' ', 'g'))
      = 'will you be travelling to chennai for the final arena?';

UPDATE public.form_questions q
SET is_active = FALSE, is_required = FALSE
FROM public.form_sections s
JOIN public.form_versions v ON v.id=s.form_version_id
JOIN public.hackathon_editions e ON e.id=v.edition_id
WHERE q.section_id=s.id
  AND e.edition_code IN ('MIIH_UPCOMING', 'MIIH_TEST_48H')
  AND v.status='DRAFT'
  AND lower(regexp_replace(trim(q.question_label), '[[:space:]]+', ' ', 'g'))
      = 'will you be travelling to chennai for the final arena?'
  AND (q.is_active OR q.is_required);

COMMIT;

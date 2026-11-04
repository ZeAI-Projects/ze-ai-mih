-- Prepare a NEW editable registration form version for MIIH_UPCOMING.
-- Does NOT change or delete existing published form versions or submitted responses.
-- Admin must review the new DRAFT and publish it from Registration Form editor.
-- Do not publish it while there are old in-progress drafts; ask users to finish first.
BEGIN;
DO $$
DECLARE eid uuid; source_version uuid; draft_version uuid;
BEGIN
  SELECT id INTO eid FROM public.hackathon_editions WHERE edition_code='MIIH_UPCOMING';
  IF eid IS NULL THEN RAISE EXCEPTION 'MIIH_UPCOMING not found'; END IF;
  SELECT id INTO draft_version FROM public.form_versions
     WHERE edition_id=eid AND name='MIIH participant-form refresh (approved changes)'
     ORDER BY version_number DESC LIMIT 1;
  IF draft_version IS NOT NULL THEN
    RAISE NOTICE 'Prepared form already exists; edit/review it through Admin → Registration Form.';
    RETURN;
  END IF;
  SELECT id INTO source_version FROM public.form_versions WHERE edition_id=eid
     ORDER BY (status='PUBLISHED') DESC,version_number DESC LIMIT 1;
  IF source_version IS NULL THEN RAISE EXCEPTION 'Source registration form not found'; END IF;
  INSERT INTO public.form_versions(edition_id,version_number,status,name)
  VALUES(eid,(SELECT COALESCE(MAX(version_number),0)+1 FROM public.form_versions WHERE edition_id=eid),
         'DRAFT','MIIH participant-form refresh (approved changes)')
  RETURNING id INTO draft_version;

  INSERT INTO public.form_sections(form_version_id,section_key,title,description,display_order,is_active)
  SELECT draft_version,s.section_key,s.title,s.description,s.display_order,
         s.is_active AND s.section_key<>'participant_category'
  FROM public.form_sections s WHERE s.form_version_id=source_version;

  INSERT INTO public.form_questions
     (section_id,field_key,legacy_question_number,question_label,description,placeholder,
      input_type,answer_scope,storage_binding,is_required,is_active,display_order,
      validation_rules,visibility_rules,default_value)
  SELECT ds.id,q.field_key,q.legacy_question_number,
     CASE WHEN q.field_key='investor_pitch_interest'
          THEN 'Are you interested in an investor pitch?'
          ELSE regexp_replace(q.question_label,'^Q[0-9]+[.:-] *','','i') END,
     q.description,q.placeholder,q.input_type,q.answer_scope,q.storage_binding,
     CASE WHEN q.field_key='investor_pitch_interest' THEN TRUE ELSE q.is_required END,
     q.is_active AND q.field_key NOT IN ('participant_category','source_team_id'),
     q.display_order,q.validation_rules,q.visibility_rules,q.default_value
  FROM public.form_questions q
  JOIN public.form_sections ss ON ss.id=q.section_id
  JOIN public.form_sections ds ON ds.form_version_id=draft_version AND ds.section_key=ss.section_key
  WHERE ss.form_version_id=source_version;

  INSERT INTO public.form_question_options(question_id,option_value,option_label,display_order,is_active)
  SELECT dq.id,o.option_value,o.option_label,o.display_order,o.is_active
  FROM public.form_question_options o
  JOIN public.form_questions sq ON sq.id=o.question_id
  JOIN public.form_sections ss ON ss.id=sq.section_id
  JOIN public.form_sections ds ON ds.form_version_id=draft_version AND ds.section_key=ss.section_key
  JOIN public.form_questions dq ON dq.section_id=ds.id AND dq.field_key=sq.field_key
  WHERE ss.form_version_id=source_version;
END $$;
SELECT e.edition_code,f.id,f.version_number,f.status,f.name
FROM public.form_versions f JOIN public.hackathon_editions e ON e.id=f.edition_id
WHERE e.edition_code='MIIH_UPCOMING' ORDER BY f.version_number DESC LIMIT 5;
COMMIT;

-- Rollback: if this version remains DRAFT, remove its child data and the version.
-- Never delete an existing published form version or one used by team_registrations.
-- Prefer using Admin interface to archive unused drafts; take backup first.

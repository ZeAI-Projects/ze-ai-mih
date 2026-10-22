-- Prepare leader-completed DRAFT forms for existing real and internal-test editions.
-- Review and publish through Admin; this script never opens registration or enables payments.
-- Does NOT change or delete existing published form versions or submitted responses.
-- Admin must review the new DRAFT and publish it from Registration Form editor.
-- Do not publish it while there are old in-progress drafts; ask users to finish first.
BEGIN;
DO $$
DECLARE eid uuid; source_version uuid; draft_version uuid;
BEGIN
  FOR eid IN SELECT id FROM public.hackathon_editions WHERE edition_code IN ('MIIH_UPCOMING','MIIH_TEST_48H') ORDER BY id FOR UPDATE LOOP
  SELECT id INTO draft_version FROM public.form_versions
     WHERE edition_id=eid AND name='MIIH leader-completed registration v3'
     ORDER BY version_number DESC LIMIT 1;
  IF draft_version IS NOT NULL THEN
    RAISE NOTICE 'Prepared form already exists; edit/review it through Admin → Registration Form.';
    CONTINUE;
  END IF;
  SELECT id INTO source_version FROM public.form_versions WHERE edition_id=eid
     ORDER BY (status='PUBLISHED') DESC,version_number DESC LIMIT 1;
  IF source_version IS NULL THEN RAISE EXCEPTION 'Source registration form not found'; END IF;
  INSERT INTO public.form_versions(edition_id,version_number,status,name)
  VALUES(eid,(SELECT COALESCE(MAX(version_number),0)+1 FROM public.form_versions WHERE edition_id=eid),
         'DRAFT','MIIH leader-completed registration v3')
  RETURNING id INTO draft_version;

  INSERT INTO public.form_sections(form_version_id,section_key,title,description,display_order,is_active)
  SELECT draft_version,s.section_key,s.title,s.description,s.display_order,
         s.is_active AND s.section_key<>'participant_category'
  FROM public.form_sections s WHERE s.form_version_id=source_version;

  INSERT INTO public.form_questions
     (section_id,field_key,legacy_question_number,question_label,description,placeholder,
      input_type,answer_scope,storage_binding,is_required,is_active,display_order,
      validation_rules,visibility_rules,default_value)
  SELECT ds.id,CASE q.field_key WHEN 'terms_consent' THEN 'leader_team_attestation' WHEN 'media_consent' THEN 'leader_media_consent' WHEN 'communication_consent' THEN 'team_communication_preference' ELSE q.field_key END,q.legacy_question_number,
     CASE WHEN q.field_key='terms_consent' THEN 'I accept the team registration terms and confirm my teammates authorized me to submit their details.' WHEN q.field_key='media_consent' THEN 'I, the team leader, consent to photography and media use for myself.' WHEN q.field_key='communication_consent' THEN 'May the organizer contact the team leader about this registration?' WHEN q.field_key='investor_pitch_interest'
          THEN 'Are you interested in an investor pitch?'
          ELSE regexp_replace(q.question_label,'^Q[0-9]+[.:-] *','','i') END,
     CASE WHEN q.field_key='terms_consent' THEN 'The registering leader confirms they have informed their teammates and obtained authorization to submit their details. This is not an individual teammate consent record.' ELSE q.description END,
     q.placeholder,q.input_type,
     CASE WHEN q.field_key IN ('team_name','team_domain','investor_pitch_interest','project_name','problem_statement','project_description','project_idea','proposed_solution','technology_stack','startup_stage','project_stage','communication_consent') THEN 'TEAM'
          WHEN q.field_key IN ('terms_consent','media_consent') THEN 'LEADER' ELSE q.answer_scope END,
     CASE WHEN q.field_key IN ('terms_consent','media_consent','communication_consent') THEN 'form_answers.answer_json' ELSE q.storage_binding END,
     CASE WHEN q.field_key='investor_pitch_interest' THEN TRUE ELSE q.is_required END,
     q.is_active AND q.field_key NOT IN ('participant_category','source_team_id') AND NOT (q.field_key IN ('payment_transaction_id','payment_proof') AND EXISTS (SELECT 1 FROM public.hackathon_editions e WHERE e.id=eid AND e.edition_code='MIIH_TEST_48H')),
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
  JOIN public.form_questions dq ON dq.section_id=ds.id AND dq.field_key=CASE sq.field_key WHEN 'terms_consent' THEN 'leader_team_attestation' WHEN 'media_consent' THEN 'leader_media_consent' WHEN 'communication_consent' THEN 'team_communication_preference' ELSE sq.field_key END
  WHERE ss.form_version_id=source_version;
  END LOOP;
END $$;
SELECT e.edition_code,f.id,f.version_number,f.status,f.name
FROM public.form_versions f JOIN public.hackathon_editions e ON e.id=f.edition_id
WHERE e.edition_code IN ('MIIH_UPCOMING','MIIH_TEST_48H') ORDER BY f.version_number DESC LIMIT 5;
COMMIT;

-- Rollback: if this version remains DRAFT, remove its child data and the version.
-- Never delete an existing published form version or one used by team_registrations.
-- Prefer using Admin interface to archive unused drafts; take backup first.

-- Rollback: leave the prepared versions as unpublished DRAFTs. If already published,
-- archive the v3 version and restore the previously published version in one transaction,
-- after reviewing in-progress registrations. Retain all versions and answers for audit.

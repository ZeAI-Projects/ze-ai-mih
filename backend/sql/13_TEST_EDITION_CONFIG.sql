-- INTERNAL ONLY. Configures a 48-hour Razorpay-free test event.
-- Use after 12_TEAM_ID.sql and after the original schema + seed migrations.
-- The backend MUST include protected test routes before executing this script.
-- Test registration is accessible only using a verified SUPER_ADMIN bearer token.
-- Public editions excludes MIIH_TEST_*; real payments are never enabled here.
BEGIN;

INSERT INTO public.hackathon_editions
  (edition_code,title,tagline,description,year,status,is_published,
   starts_at,ends_at,registration_opens_at,registration_closes_at,
   min_team_size,max_team_size,default_team_size,venue,location,event_mode)
VALUES
  ('MIIH_TEST_48H','Made in India — Internal QA','Staff-only registration validation',
   'Private staff testing. Not a public event.',EXTRACT(YEAR FROM now())::smallint,
   'OPEN',TRUE,now(),now()+interval '48 hours',now(),now()+interval '48 hours',
   4,4,4,'Online test','Internal','ONLINE')
ON CONFLICT (edition_code) DO UPDATE SET
  status='OPEN',is_published=TRUE,registration_opens_at=now(),
  registration_closes_at=now()+interval '48 hours',starts_at=now(),
  ends_at=now()+interval '48 hours';

INSERT INTO public.edition_domains(edition_id,domain_id,is_enabled,display_order)
SELECT e.id,d.id,TRUE,d.display_order
FROM public.hackathon_editions e CROSS JOIN public.domains d
WHERE e.edition_code='MIIH_TEST_48H' AND d.is_active
ON CONFLICT (edition_id,domain_id) DO UPDATE SET is_enabled=TRUE;

DO $$
DECLARE src uuid; dest uuid; eid uuid;
BEGIN
  SELECT id INTO eid FROM public.hackathon_editions WHERE edition_code='MIIH_TEST_48H';
  SELECT f.id INTO src FROM public.form_versions f
    JOIN public.hackathon_editions e ON e.id=f.edition_id
    WHERE e.edition_code='MIIH_UPCOMING'
    ORDER BY (f.status='PUBLISHED') DESC,f.version_number DESC LIMIT 1;
  IF src IS NULL THEN RAISE EXCEPTION 'Original registration form not found'; END IF;
  SELECT id INTO dest FROM public.form_versions WHERE edition_id=eid AND status='PUBLISHED';
  IF dest IS NULL THEN
    INSERT INTO public.form_versions(edition_id,version_number,status,name)
    VALUES(eid,(SELECT COALESCE(MAX(version_number),0)+1 FROM public.form_versions WHERE edition_id=eid),
           'DRAFT','Internal QA registration (payment-free)')
    RETURNING id INTO dest;

    INSERT INTO public.form_sections(form_version_id,section_key,title,description,display_order,is_active)
    SELECT dest,s.section_key,s.title,s.description,s.display_order,
           s.is_active AND s.section_key NOT IN ('participant_category','payment')
    FROM public.form_sections s WHERE s.form_version_id=src;

    INSERT INTO public.form_questions
      (section_id,field_key,legacy_question_number,question_label,description,placeholder,
       input_type,answer_scope,storage_binding,is_required,is_active,display_order,
       validation_rules,visibility_rules,default_value)
    SELECT ds.id,q.field_key,q.legacy_question_number,
      CASE WHEN q.field_key='investor_pitch_interest' THEN 'Are you interested in an investor pitch?'
           ELSE regexp_replace(q.question_label,'^Q[0-9]+[.:-] *','','i') END,
      q.description,q.placeholder,q.input_type,q.answer_scope,q.storage_binding,
      CASE WHEN q.field_key='investor_pitch_interest' THEN TRUE ELSE q.is_required END,
      q.is_active AND q.field_key NOT IN ('participant_category','source_team_id','payment_transaction_id','payment_proof'),
      q.display_order,q.validation_rules,q.visibility_rules,q.default_value
    FROM public.form_questions q
    JOIN public.form_sections ss ON ss.id=q.section_id
    JOIN public.form_sections ds ON ds.form_version_id=dest AND ds.section_key=ss.section_key
    WHERE ss.form_version_id=src;

    INSERT INTO public.form_question_options(question_id,option_value,option_label,display_order,is_active)
    SELECT dq.id,o.option_value,o.option_label,o.display_order,o.is_active
    FROM public.form_question_options o
    JOIN public.form_questions sq ON sq.id=o.question_id
    JOIN public.form_sections ss ON ss.id=sq.section_id
    JOIN public.form_sections ds ON ds.form_version_id=dest AND ds.section_key=ss.section_key
    JOIN public.form_questions dq ON dq.section_id=ds.id AND dq.field_key=sq.field_key
    WHERE ss.form_version_id=src;

    UPDATE public.form_versions SET status='PUBLISHED',published_at=now() WHERE id=dest;
  ELSE
    IF EXISTS (SELECT 1 FROM public.form_questions q JOIN public.form_sections sec ON sec.id=q.section_id
               WHERE sec.form_version_id=dest AND sec.is_active AND q.is_active
                 AND q.field_key IN ('participant_category','source_team_id','payment_transaction_id','payment_proof')) THEN
      RAISE EXCEPTION 'Published test form still requires obsolete/payment questions. Create and publish a corrected test form before using this SQL.';
    END IF;
    RAISE NOTICE 'Existing compatible published test form retained.';
  END IF;
END $$;

-- Editable sample event blocks and a sample milestone.
INSERT INTO public.edition_content_blocks
  (edition_id,block_key,block_type,title,body,display_order,is_visible)
SELECT e.id,v.block_key,v.block_type,v.title,v.body,v.ord,TRUE
FROM public.hackathon_editions e
CROSS JOIN (VALUES
  ('introduction','DETAIL','Internal kickoff','Two days of staff-only registration and review tests.',1),
  ('participation','FAQ','Who can register?','Only authorized staff testing the application.',2),
  ('preparation','INSTRUCTION','Before testing','Complete all required questions with non-sensitive synthetic data.',3)
) AS v(block_key,block_type,title,body,ord)
WHERE e.edition_code='MIIH_TEST_48H'
ON CONFLICT (edition_id,block_key) DO NOTHING;

INSERT INTO public.edition_highlights
  (edition_id,title,description,highlight_date,display_order,is_visible)
SELECT e.id,'Internal test kickoff','Sample editable event milestone',CURRENT_DATE,1,TRUE
FROM public.hackathon_editions e
WHERE e.edition_code='MIIH_TEST_48H'
  AND NOT EXISTS(SELECT 1 FROM public.edition_highlights h
    WHERE h.edition_id=e.id AND h.title='Internal test kickoff');

-- New active payment-free setting version. No Razorpay link or transaction required.
UPDATE public.payment_settings SET is_active=FALSE
WHERE edition_id IN (SELECT id FROM public.hackathon_editions WHERE edition_code='MIIH_TEST_48H')
AND is_active=TRUE;
INSERT INTO public.payment_settings
  (edition_id,config_version,razorpay_payment_url,button_label,instructions,
   fee_amount,currency,payment_required,proof_required,is_active)
SELECT e.id,COALESCE((SELECT MAX(p.config_version) FROM public.payment_settings p
    WHERE p.edition_id=e.id),0)+1,
  NULL,'No payment needed','Private Super Admin QA. Never counted as real revenue.',
  0,'INR',FALSE,FALSE,TRUE
FROM public.hackathon_editions e WHERE e.edition_code='MIIH_TEST_48H';

SELECT e.edition_code,e.status,e.is_published,e.starts_at,e.ends_at,
 (SELECT count(*) FROM public.edition_domains d WHERE d.edition_id=e.id AND d.is_enabled) AS domains,
 (SELECT count(*) FROM public.form_versions f WHERE f.edition_id=e.id AND f.status='PUBLISHED') AS forms
FROM public.hackathon_editions e WHERE e.edition_code='MIIH_TEST_48H';
COMMIT;

-- Rollback: first close the private edition; retain test registrations for audit.
-- UPDATE public.hackathon_editions SET status='CLOSED',is_published=FALSE
-- WHERE edition_code='MIIH_TEST_48H';
-- UPDATE public.payment_settings SET is_active=FALSE WHERE edition_id =
-- (SELECT id FROM public.hackathon_editions WHERE edition_code='MIIH_TEST_48H');

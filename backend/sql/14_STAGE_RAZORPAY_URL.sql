-- Stage official Razorpay Payment Page for the UPCOMING event.
-- Does NOT activate payment collection until the fee is confirmed by Super Admin.
-- Safe to run after base migrations. Back up first.
BEGIN;
DO $$
DECLARE e_id uuid; fee numeric(12,2);
BEGIN
  SELECT id INTO e_id FROM public.hackathon_editions WHERE edition_code='MIIH_UPCOMING';
  IF e_id IS NULL THEN RAISE EXCEPTION 'MIIH_UPCOMING edition not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.payment_settings
       WHERE edition_id=e_id AND razorpay_payment_url='https://pages.razorpay.com/pl_Tq7ND79LNPZBUt/view') THEN
    RAISE NOTICE 'Razorpay link already stored. No changes made.';
  ELSE
    SELECT COALESCE(p.fee_amount,0) INTO fee FROM public.payment_settings p
       WHERE p.edition_id=e_id ORDER BY p.config_version DESC LIMIT 1;
    INSERT INTO public.payment_settings
      (edition_id,config_version,razorpay_payment_url,button_label,instructions,
       fee_amount,currency,payment_required,proof_required,is_active)
    VALUES(e_id,(SELECT COALESCE(MAX(config_version),0)+1 FROM public.payment_settings WHERE edition_id=e_id),
       'https://pages.razorpay.com/pl_Tq7ND79LNPZBUt/view','Secure your spot — Pay Now',
       'After payment, enter your transaction ID and upload proof for manual verification.',
       COALESCE(fee,0),'INR',TRUE,TRUE,FALSE);
  END IF;
END $$;
COMMIT;
-- Rollback staged *inactive and unused* configuration only, after checking dependencies:
-- DELETE FROM public.payment_settings p WHERE p.razorpay_payment_url =
-- 'https://pages.razorpay.com/pl_Tq7ND79LNPZBUt/view' AND NOT p.is_active
-- AND NOT EXISTS (SELECT 1 FROM public.team_registrations r WHERE r.payment_setting_id=p.id);

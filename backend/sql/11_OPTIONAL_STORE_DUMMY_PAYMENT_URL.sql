-- OPTIONAL, safe one-time data update for a NEW project.
-- Keeps the Razorpay button disabled. Does NOT activate payments or publish the event.
-- This URL is not an actual payment page; never direct registrants to it.
BEGIN;
UPDATE public.payment_settings p
SET razorpay_payment_url='https://example.com/miih-payment-placeholder',
    button_label='Secure Your Spot - Pay Now'
FROM public.hackathon_editions e
WHERE p.edition_id=e.id
  AND e.edition_code='MIIH_UPCOMING'
  AND p.razorpay_payment_url IS NULL
  AND p.is_active=FALSE
  AND NOT EXISTS(SELECT 1 FROM public.team_registrations r WHERE r.payment_setting_id=p.id);
COMMIT;
SELECT e.edition_code,p.button_label,p.razorpay_payment_url,p.is_active
FROM public.payment_settings p
JOIN public.hackathon_editions e ON e.id=p.edition_id
WHERE e.edition_code='MIIH_UPCOMING';

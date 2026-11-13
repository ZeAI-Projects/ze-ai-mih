-- Store versioned Razorpay pricing rules for team-size ranges.
-- Review and back up the existing Supabase schema before applying.
BEGIN;

ALTER TABLE public.payment_settings
  ADD COLUMN IF NOT EXISTS team_size_pricing JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_settings_team_size_pricing_array'
      AND conrelid = 'public.payment_settings'::regclass
  ) THEN
    ALTER TABLE public.payment_settings
      ADD CONSTRAINT payment_settings_team_size_pricing_array
      CHECK (jsonb_typeof(team_size_pricing) = 'array');
  END IF;
END $$;

COMMIT;

-- Roll back only after confirming the application no longer reads this field:
-- ALTER TABLE public.payment_settings DROP COLUMN team_size_pricing;

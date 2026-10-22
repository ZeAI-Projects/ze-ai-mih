-- Existing database only. Retains all export history and all registration data.
-- Allows the History and Statistics reports already offered by the admin panel.
BEGIN;
ALTER TABLE public.export_runs DROP CONSTRAINT IF EXISTS export_runs_dataset_check;
ALTER TABLE public.export_runs ADD CONSTRAINT export_runs_dataset_check
  CHECK (dataset IN ('TEAMS','MEMBERS','PAYMENTS','ANSWERS','STATISTICS','EDITION_HISTORY'));
COMMIT;

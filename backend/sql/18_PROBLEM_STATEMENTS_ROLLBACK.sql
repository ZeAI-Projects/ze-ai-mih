-- DESTRUCTIVE for challenge content ONLY. Requires explicit owner approval.
BEGIN;
DROP TABLE IF EXISTS public.problem_statements;
DROP TABLE IF EXISTS public.problem_statement_tracks;
DROP FUNCTION IF EXISTS public.miih_problem_statements_touch_updated_at();
COMMIT;

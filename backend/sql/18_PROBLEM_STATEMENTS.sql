-- Additive migration. Run only with owner approval after schema preflight.
BEGIN;
CREATE TABLE IF NOT EXISTS public.problem_statement_tracks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    display_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.problem_statements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    edition_id uuid NOT NULL REFERENCES public.hackathon_editions(id) ON DELETE RESTRICT,
    domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE RESTRICT,
    track_id uuid NOT NULL REFERENCES public.problem_statement_tracks(id) ON DELETE RESTRICT,
    statement_code text NOT NULL,
    title text NOT NULL,
    summary text NOT NULL DEFAULT '',
    description text,
    expected_outcome text,
    difficulty text,
    tags jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tags) = 'array'),
    status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (edition_id, track_id, domain_id, statement_code)
);
CREATE INDEX IF NOT EXISTS idx_miih_problem_statements_filter
    ON public.problem_statements(edition_id, status, track_id, domain_id, display_order);
CREATE INDEX IF NOT EXISTS idx_miih_problem_statements_domain
    ON public.problem_statements(domain_id);
CREATE OR REPLACE FUNCTION public.miih_problem_statements_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS miih_problem_statement_tracks_touch ON public.problem_statement_tracks;
CREATE TRIGGER miih_problem_statement_tracks_touch BEFORE UPDATE ON public.problem_statement_tracks
FOR EACH ROW EXECUTE FUNCTION public.miih_problem_statements_touch_updated_at();
DROP TRIGGER IF EXISTS miih_problem_statements_touch ON public.problem_statements;
CREATE TRIGGER miih_problem_statements_touch BEFORE UPDATE ON public.problem_statements
FOR EACH ROW EXECUTE FUNCTION public.miih_problem_statements_touch_updated_at();
INSERT INTO public.problem_statement_tracks(code,name,description,display_order)
VALUES
 ('RISING_BUILDERS','Rising Builders','School students to first-year college students',1),
 ('NEXT_LEVEL_BUILDERS','Next-Level Builders','Second-year college students through startup teams',2)
ON CONFLICT(code) DO UPDATE SET
 name = excluded.name,
 description = excluded.description,
 display_order = excluded.display_order;
ALTER TABLE public.problem_statement_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problem_statements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS miih_public_read_active_tracks ON public.problem_statement_tracks;
CREATE POLICY miih_public_read_active_tracks ON public.problem_statement_tracks
FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS miih_public_read_published_statements ON public.problem_statements;
CREATE POLICY miih_public_read_published_statements ON public.problem_statements
FOR SELECT TO anon, authenticated USING (status = 'PUBLISHED');
GRANT SELECT ON public.problem_statement_tracks, public.problem_statements TO anon, authenticated;
COMMIT;

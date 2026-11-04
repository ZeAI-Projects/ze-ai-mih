-- Apply only if ZeAI will upload video files directly via the CMS admin editor.
-- Migration changes Storage settings, not the 28 PostgreSQL application tables.
-- Note: Supabase organization/project global maximum upload size may also apply.
BEGIN;
UPDATE storage.buckets
SET file_size_limit=52428800,
    allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','application/pdf','video/mp4','video/webm']::text[]
WHERE id='miih-event-public';
COMMIT;
SELECT id,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id='miih-event-public';

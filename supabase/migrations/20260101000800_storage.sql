-- ─────────────────────────────────────────────────────────
-- Migration 9 — Storage bucket for social media (photos + videos)
--
-- Replaces base64-in-the-row media with real object storage. Photos and
-- short videos posted in the Social feed go into a public 'social' bucket;
-- only the URL is stored in posts.media_url.
--
-- Public read (the feed shows everyone's media), authenticated write,
-- and uploaders can manage their own objects. 50 MB cap; images + common
-- video types only.
--
-- If `db push` errors here on permissions for storage.objects policies,
-- create the bucket + policies once in Dashboard → Storage instead.
-- ─────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'social', 'social', true, 52428800,
  array['image/jpeg','image/png','image/webp','image/gif',
        'video/mp4','video/quicktime','video/webm']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "social media read"   on storage.objects;
drop policy if exists "social media insert" on storage.objects;
drop policy if exists "social media update" on storage.objects;
drop policy if exists "social media delete" on storage.objects;

create policy "social media read" on storage.objects
  for select using (bucket_id = 'social');
create policy "social media insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'social');
create policy "social media update" on storage.objects
  for update to authenticated using (bucket_id = 'social' and owner = auth.uid());
create policy "social media delete" on storage.objects
  for delete to authenticated using (bucket_id = 'social' and owner = auth.uid());

-- Public bucket for heavy static files that shouldn't live in the git repo /
-- Vercel deploy (first user: the 32 MB ffmpeg.wasm core of the public
-- /VARMariEder build, under static-assets/var-mari/).
--
-- Read-only for everyone; there are deliberately NO insert/update/delete
-- policies — the owner uploads files through the Supabase Dashboard
-- (service role), so no client can write here.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'static-assets','static-assets',true,
  52428800, -- 50 MB (ffmpeg-core.wasm is ~32 MB)
  array['application/wasm','text/javascript','application/javascript','application/octet-stream']
)
on conflict(id) do nothing;

-- Public buckets are already served via /storage/v1/object/public/ without a
-- policy; this explicit read policy is scoped to this bucket only.
drop policy if exists static_assets_public_read on storage.objects;
create policy static_assets_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'static-assets');

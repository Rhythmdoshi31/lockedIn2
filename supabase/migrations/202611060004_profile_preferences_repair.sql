-- Profile editing and notification preferences used directly on the Profile page.
-- This is idempotent so projects that did or did not apply the earlier settings migration converge safely.
alter table public.profiles
  add column if not exists avatar_path text,
  add column if not exists notify_product_updates boolean not null default true,
  add column if not exists notify_feature_announcements boolean not null default true,
  add column if not exists notify_promotional_emails boolean not null default false;

-- The separate default-résumé feature was removed. This drops only the association,
-- never a résumé row or Storage object.
alter table public.profiles drop column if exists default_resume_id;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict(id) do update
set public = false,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "avatar objects select" on storage.objects;
drop policy if exists "avatar objects insert" on storage.objects;
drop policy if exists "avatar objects update" on storage.objects;
drop policy if exists "avatar objects delete" on storage.objects;

create policy "avatar objects select"
on storage.objects for select
using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "avatar objects insert"
on storage.objects for insert
with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "avatar objects update"
on storage.objects for update
using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "avatar objects delete"
on storage.objects for delete
using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create or replace function public.purge_user_webhook_events(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.webhook_events
  where payload #>> '{data,metadata,lockedin_user_id}' = p_user::text;
$$;

revoke all on function public.purge_user_webhook_events(uuid) from public, anon, authenticated;

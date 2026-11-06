-- Account settings, notification preferences, default résumé and private avatars.
alter table public.profiles
  add column if not exists avatar_path text,
  add column if not exists default_resume_id uuid references public.resumes(id) on delete set null,
  add column if not exists notify_product_updates boolean not null default true,
  add column if not exists notify_feature_announcements boolean not null default true,
  add column if not exists notify_promotional_emails boolean not null default false;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict(id) do update
set public = false,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

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

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.email is distinct from new.email then
    update public.profiles set email = new.email, updated_at = now() where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
after update of email on auth.users
for each row execute procedure public.sync_profile_email();

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

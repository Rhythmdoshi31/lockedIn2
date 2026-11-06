-- Hold signup benefits until an email/password user has verified their address.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, email, full_name, avatar_url, free_credits)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    case when new.email_confirmed_at is not null then 3 else 0 end
  ) on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.grant_verified_signup_credits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.profiles
    set free_credits = greatest(free_credits, 3), updated_at = now()
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_verified on auth.users;
create trigger on_auth_user_email_verified
after update of email_confirmed_at on auth.users
for each row execute procedure public.grant_verified_signup_credits();

-- Accounts created before this migration cannot use these credits until verified.
update public.profiles as profile
set free_credits = 0, updated_at = now()
from auth.users as auth_user
where profile.id = auth_user.id
  and auth_user.email_confirmed_at is null;

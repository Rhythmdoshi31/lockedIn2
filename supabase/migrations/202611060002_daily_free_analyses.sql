-- Replace registered users' lifetime free credits with a non-accumulating UTC daily allowance.
-- Anonymous lifetime usage and purchased credit balances are intentionally unchanged.
alter table public.profiles
  add column if not exists daily_free_used integer not null default 0
    check (daily_free_used between 0 and 3),
  add column if not exists daily_free_usage_date date not null
    default ((timezone('UTC', now()))::date);

alter table public.profiles alter column free_credits set default 0;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(
    id, email, full_name, avatar_url, free_credits,
    daily_free_used, daily_free_usage_date
  )
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    0,
    0,
    (timezone('UTC', now()))::date
  ) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_verified on auth.users;
drop function if exists public.grant_verified_signup_credits();

create or replace function public.consume_registered_credit(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  account public.profiles%rowtype;
  utc_today date := (timezone('UTC', now()))::date;
begin
  select * into account
  from public.profiles
  where id = p_user
  for update;

  if not found then
    return false;
  end if;

  if account.plan <> 'premium' then
    if account.daily_free_usage_date <> utc_today then
      account.daily_free_used := 0;
    end if;

    if account.daily_free_used < 3 then
      update public.profiles
      set daily_free_used = account.daily_free_used + 1,
          daily_free_usage_date = utc_today,
          updated_at = now()
      where id = p_user;

      insert into public.credit_ledger(user_id, amount, kind, description)
      values (p_user, -1, 'analysis_daily_free', 'Successful daily free analysis');
      return true;
    end if;
  end if;

  if account.paid_credits > 0 then
    update public.profiles
    set paid_credits = paid_credits - 1,
        updated_at = now()
    where id = p_user;

    insert into public.credit_ledger(user_id, amount, kind, description)
    values (p_user, -1, 'analysis_paid', 'Successful paid analysis');
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.consume_registered_credit(uuid) from public, anon, authenticated;

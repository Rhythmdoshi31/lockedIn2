-- LockedIn accounts, usage, storage, analyses and billing.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  plan text not null default 'free' check (plan in ('free','premium')),
  free_credits integer not null default 3 check (free_credits >= 0),
  paid_credits integer not null default 0 check (paid_credits >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.anonymous_usage (
  anonymous_id uuid primary key, used_count integer not null default 0 check (used_count between 0 and 3),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.resumes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null, storage_path text not null unique, mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 10485760), created_at timestamptz not null default now()
);
create table public.job_descriptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  source_url text not null, job_title text not null, company_name text, created_at timestamptz not null default now()
);
create table public.analyses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  resume_id uuid references public.resumes(id) on delete set null,
  job_description_id uuid references public.job_descriptions(id) on delete set null,
  job_title text not null, company_name text, match_score integer not null check (match_score between 0 and 100),
  result jsonb not null, created_at timestamptz not null default now()
);
create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount <> 0), kind text not null,
  reference_id text, description text not null, created_at timestamptz not null default now(),
  unique(kind, reference_id)
);
create table public.payments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  provider_payment_id text not null unique, provider_event_id text, product_id text not null,
  amount integer, currency text, status text not null, created_at timestamptz not null default now()
);
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  provider_subscription_id text not null unique, product_id text not null, status text not null,
  cancel_at_next_billing_date boolean not null default false, next_billing_date timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.webhook_events (
  id text primary key, event_type text not null, payload jsonb not null,
  processed_at timestamptz, error text, created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,email,full_name,avatar_url)
values(new.id,new.email,new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'avatar_url') on conflict(id) do nothing; return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.consume_registered_credit(p_user uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare ok boolean := false;
begin
 update profiles set free_credits=free_credits-1,updated_at=now() where id=p_user and free_credits>0 returning true into ok;
 if coalesce(ok,false) then insert into credit_ledger(user_id,amount,kind,description) values(p_user,-1,'analysis_free','Successful analysis'); return true; end if;
 update profiles set paid_credits=paid_credits-1,updated_at=now() where id=p_user and paid_credits>0 returning true into ok;
 if coalesce(ok,false) then insert into credit_ledger(user_id,amount,kind,description) values(p_user,-1,'analysis_paid','Successful analysis'); return true; end if;
 return false;
end $$;
create or replace function public.consume_anonymous_credit(p_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare n integer;
begin insert into anonymous_usage(anonymous_id) values(p_id) on conflict do nothing;
 update anonymous_usage set used_count=used_count+1,updated_at=now() where anonymous_id=p_id and used_count<3 returning used_count into n;
 return n is not null;
end $$;
create or replace function public.grant_paid_credits(p_user uuid,p_amount integer,p_kind text,p_reference text,p_description text) returns boolean language plpgsql security definer set search_path=public as $$
begin
 insert into credit_ledger(user_id,amount,kind,reference_id,description) values(p_user,p_amount,p_kind,p_reference,p_description);
 update profiles set paid_credits=paid_credits+p_amount,updated_at=now() where id=p_user; return true;
exception when unique_violation then return false; end $$;

alter table profiles enable row level security; alter table resumes enable row level security;
alter table job_descriptions enable row level security; alter table analyses enable row level security;
alter table credit_ledger enable row level security; alter table payments enable row level security; alter table subscriptions enable row level security;
create policy "own profile" on profiles for select using(auth.uid()=id);
create policy "own resumes" on resumes for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "own jobs" on job_descriptions for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "own analyses" on analyses for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "own ledger" on credit_ledger for select using(auth.uid()=user_id);
create policy "own payments" on payments for select using(auth.uid()=user_id);
create policy "own subscriptions" on subscriptions for select using(auth.uid()=user_id);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('resumes','resumes',false,10485760,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']) on conflict(id) do update set public=false,file_size_limit=10485760;
create policy "resume objects select" on storage.objects for select using(bucket_id='resumes' and auth.uid()::text=(storage.foldername(name))[1]);
create policy "resume objects insert" on storage.objects for insert with check(bucket_id='resumes' and auth.uid()::text=(storage.foldername(name))[1]);
create policy "resume objects delete" on storage.objects for delete using(bucket_id='resumes' and auth.uid()::text=(storage.foldername(name))[1]);
revoke all on function public.consume_registered_credit(uuid) from public,anon,authenticated;
revoke all on function public.consume_anonymous_credit(uuid) from public,anon,authenticated;
revoke all on function public.grant_paid_credits(uuid,integer,text,text,text) from public,anon,authenticated;

-- Make analysis completion, report persistence and usage deduction one idempotent transaction.
create table if not exists public.analysis_requests (
  request_id uuid primary key,
  owner_key text not null,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.analysis_requests enable row level security;
alter table public.analyses add column if not exists request_id uuid;
create unique index if not exists analyses_user_request_id_key
  on public.analyses(user_id, request_id) where request_id is not null;

create or replace function public.claim_analysis_request(p_request_id uuid, p_owner_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare existing public.analysis_requests%rowtype;
begin
  insert into analysis_requests(request_id, owner_key) values (p_request_id, p_owner_key)
  on conflict (request_id) do nothing;
  if found then return jsonb_build_object('status', 'claimed'); end if;

  select * into existing from analysis_requests where request_id=p_request_id for update;
  if existing.owner_key <> p_owner_key then return jsonb_build_object('status', 'rejected'); end if;
  if existing.status='completed' then return jsonb_build_object('status', 'completed', 'result', existing.result); end if;
  if existing.status='processing' and existing.updated_at > now() - interval '5 minutes' then
    return jsonb_build_object('status', 'processing');
  end if;
  update analysis_requests set status='processing', updated_at=now() where request_id=p_request_id;
  return jsonb_build_object('status', 'claimed');
end $$;

create or replace function public.fail_analysis_request(p_request_id uuid, p_owner_key text)
returns void language plpgsql security definer set search_path=public as $$
begin
  update analysis_requests set status='failed', updated_at=now()
  where request_id=p_request_id and owner_key=p_owner_key and status='processing';
end $$;

create or replace function public.finalize_registered_analysis(
  p_request_id uuid, p_owner_key text, p_user uuid, p_resume_id uuid,
  p_source_url text, p_job_title text, p_company_name text, p_score integer, p_result jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare account profiles%rowtype; job_id uuid; analysis_id uuid; utc_today date := (timezone('UTC',now()))::date;
begin
  perform 1 from analysis_requests where request_id=p_request_id and owner_key=p_owner_key and status='processing' for update;
  if not found then
    return jsonb_build_object('status','duplicate','result',(select result from analysis_requests where request_id=p_request_id and owner_key=p_owner_key));
  end if;
  select * into account from profiles where id=p_user for update;
  if not found then return jsonb_build_object('status','unavailable'); end if;

  insert into job_descriptions(user_id,source_url,job_title,company_name)
  values(p_user,p_source_url,p_job_title,p_company_name) returning id into job_id;
  insert into analyses(user_id,resume_id,job_description_id,job_title,company_name,match_score,result,request_id)
  values(p_user,p_resume_id,job_id,p_job_title,p_company_name,p_score,p_result,p_request_id) returning id into analysis_id;

  if account.plan <> 'premium' and (account.daily_free_usage_date <> utc_today or account.daily_free_used < 3) then
    update profiles set daily_free_used=case when account.daily_free_usage_date=utc_today then account.daily_free_used+1 else 1 end,
      daily_free_usage_date=utc_today,updated_at=now() where id=p_user;
    insert into credit_ledger(user_id,amount,kind,reference_id,description)
    values(p_user,-1,'analysis_daily_free',p_request_id::text,'Successful daily free analysis');
  elsif account.paid_credits > 0 then
    update profiles set paid_credits=paid_credits-1,updated_at=now() where id=p_user;
    insert into credit_ledger(user_id,amount,kind,reference_id,description)
    values(p_user,-1,'analysis_paid',p_request_id::text,'Successful paid analysis');
  else
    raise exception 'usage_unavailable';
  end if;
  update analysis_requests set status='completed',result=p_result,updated_at=now() where request_id=p_request_id;
  return jsonb_build_object('status','completed','analysisId',analysis_id,'result',p_result);
end $$;

create or replace function public.finalize_anonymous_analysis(p_request_id uuid,p_owner_key text,p_anonymous_id uuid,p_result jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare used integer;
begin
  perform 1 from analysis_requests where request_id=p_request_id and owner_key=p_owner_key and status='processing' for update;
  if not found then return jsonb_build_object('status','duplicate','result',(select result from analysis_requests where request_id=p_request_id and owner_key=p_owner_key)); end if;
  insert into anonymous_usage(anonymous_id) values(p_anonymous_id) on conflict do nothing;
  update anonymous_usage set used_count=used_count+1,updated_at=now()
  where anonymous_id=p_anonymous_id and used_count<3 returning used_count into used;
  if used is null then raise exception 'usage_unavailable'; end if;
  update analysis_requests set status='completed',result=p_result,updated_at=now() where request_id=p_request_id;
  return jsonb_build_object('status','completed','result',p_result);
end $$;

revoke all on function public.claim_analysis_request(uuid,text) from public,anon,authenticated;
revoke all on function public.fail_analysis_request(uuid,text) from public,anon,authenticated;
revoke all on function public.finalize_registered_analysis(uuid,text,uuid,uuid,text,text,text,integer,jsonb) from public,anon,authenticated;
revoke all on function public.finalize_anonymous_analysis(uuid,text,uuid,jsonb) from public,anon,authenticated;

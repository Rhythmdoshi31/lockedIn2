-- Durable, privacy-preserving rate limits for the expensive analysis endpoint.
create table if not exists public.analysis_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now()
);

alter table public.analysis_rate_limits enable row level security;

-- User-owned content remains readable/insertable/deletable by its owner, but no
-- browser role can rewrite an existing stored résumé, job record or report.
drop policy if exists "own resumes" on public.resumes;
drop policy if exists "own jobs" on public.job_descriptions;
drop policy if exists "own analyses" on public.analyses;

create policy "own resumes select" on public.resumes for select using (auth.uid() = user_id);
create policy "own resumes insert" on public.resumes for insert with check (auth.uid() = user_id);
create policy "own resumes delete" on public.resumes for delete using (auth.uid() = user_id);
create policy "own jobs select" on public.job_descriptions for select using (auth.uid() = user_id);
create policy "own jobs insert" on public.job_descriptions for insert with check (auth.uid() = user_id);
create policy "own jobs delete" on public.job_descriptions for delete using (auth.uid() = user_id);
create policy "own analyses select" on public.analyses for select using (auth.uid() = user_id);
create policy "own analyses insert" on public.analyses for insert with check (auth.uid() = user_id);
create policy "own analyses delete" on public.analyses for delete using (auth.uid() = user_id);

create or replace function public.check_analysis_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  if length(p_key) <> 64 or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid_rate_limit_input';
  end if;

  insert into public.analysis_rate_limits(rate_key, window_started_at, request_count, updated_at)
  values (p_key, now(), 1, now())
  on conflict (rate_key) do update set
    request_count = case
      when public.analysis_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then 1
      else public.analysis_rate_limits.request_count + 1
    end,
    window_started_at = case
      when public.analysis_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then now()
      else public.analysis_rate_limits.window_started_at
    end,
    updated_at = now()
  returning request_count <= p_limit into allowed;

  return allowed;
end;
$$;

revoke all on function public.check_analysis_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.check_analysis_rate_limit(text, integer, integer)
  to service_role;

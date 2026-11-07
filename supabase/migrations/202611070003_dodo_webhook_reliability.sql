-- Process verified Dodo webhook events atomically and in provider timestamp order.
alter table public.payments
  add column if not exists provider_event_at timestamptz,
  add column if not exists error_code text,
  add column if not exists error_message text;

alter table public.subscriptions
  add column if not exists provider_event_at timestamptz,
  add column if not exists last_event_type text;

create unique index if not exists credit_ledger_dodo_payment_reference_key
  on public.credit_ledger(reference_id)
  where kind in ('starter_purchase','premium_billing') and reference_id is not null;

create or replace function public.process_dodo_payment_webhook(
  p_event_id text,
  p_event_type text,
  p_event_at timestamptz,
  p_payload jsonb,
  p_user uuid,
  p_plan text,
  p_payment_id text,
  p_product_id text,
  p_amount integer,
  p_currency text,
  p_status text,
  p_credits integer,
  p_subscription_id text,
  p_entitlement_ends_at timestamptz,
  p_error_code text,
  p_error_message text
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  event_row public.webhook_events%rowtype;
  ledger_id uuid;
  existing_payment public.payments%rowtype;
  payment_applied integer := 0;
begin
  if p_event_type not in ('payment.succeeded','payment.failed') then raise exception 'unsupported_payment_event'; end if;
  if p_plan not in ('starter','premium') then raise exception 'invalid_plan'; end if;
  if (p_event_type='payment.succeeded' and ((p_plan='starter' and p_credits<>10) or (p_plan='premium' and p_credits<>80)))
    or (p_event_type='payment.failed' and p_credits<>0) then
    raise exception 'invalid_credit_amount';
  end if;
  if (p_status='succeeded') <> (p_event_type='payment.succeeded') then raise exception 'payment_status_mismatch'; end if;

  insert into public.webhook_events(id,event_type,payload,error)
  values(p_event_id,p_event_type,p_payload,null) on conflict(id) do nothing;
  select * into event_row from public.webhook_events where id=p_event_id for update;
  if event_row.event_type<>p_event_type then raise exception 'webhook_event_identity_mismatch'; end if;
  if event_row.processed_at is not null then return jsonb_build_object('status','duplicate'); end if;
  update public.webhook_events set event_type=p_event_type,payload=p_payload,error=null where id=p_event_id;

  perform 1 from public.profiles where id=p_user for update;
  if not found then raise exception 'profile_not_found'; end if;

  select * into existing_payment from public.payments where provider_payment_id=p_payment_id for update;
  if found and (existing_payment.user_id<>p_user or existing_payment.product_id<>p_product_id) then
    raise exception 'payment_identity_mismatch';
  end if;

  insert into public.payments(
    user_id,provider_payment_id,provider_event_id,product_id,amount,currency,status,
    provider_event_at,error_code,error_message
  ) values (
    p_user,p_payment_id,p_event_id,p_product_id,p_amount,p_currency,p_status,
    p_event_at,p_error_code,p_error_message
  ) on conflict(provider_payment_id) do update set
    provider_event_id=excluded.provider_event_id,
    status=excluded.status,
    amount=excluded.amount,
    currency=excluded.currency,
    provider_event_at=excluded.provider_event_at,
    error_code=excluded.error_code,
    error_message=excluded.error_message
  where public.payments.user_id=excluded.user_id
    and public.payments.product_id=excluded.product_id
    and (
      public.payments.provider_event_at is null
      or excluded.provider_event_at > public.payments.provider_event_at
      or (excluded.provider_event_at = public.payments.provider_event_at and excluded.status='succeeded' and public.payments.status<>'succeeded')
    )
    and (public.payments.status<>'succeeded' or excluded.status='succeeded');
  get diagnostics payment_applied = row_count;

  if p_event_type='payment.succeeded' and payment_applied=1 then
    insert into public.credit_ledger(user_id,amount,kind,reference_id,description)
    values(
      p_user,p_credits,case when p_plan='premium' then 'premium_billing' else 'starter_purchase' end,
      p_payment_id,case when p_plan='premium' then 'Premium billing cycle — 80 credits' else 'Starter purchase — 10 credits' end
    ) on conflict do nothing returning id into ledger_id;
    if ledger_id is not null then
      update public.profiles set paid_credits=paid_credits+p_credits,updated_at=now() where id=p_user;
    end if;

    if p_plan='premium' and p_subscription_id is not null then
      insert into public.subscriptions(
        user_id,provider_subscription_id,product_id,status,cancel_at_next_billing_date,
        next_billing_date,provider_event_at,last_event_type
      ) values (
        p_user,p_subscription_id,p_product_id,'active',false,p_entitlement_ends_at,p_event_at,p_event_type
      ) on conflict(provider_subscription_id) do update set
        user_id=excluded.user_id,product_id=excluded.product_id,status='active',
        next_billing_date=coalesce(excluded.next_billing_date,public.subscriptions.next_billing_date),
        provider_event_at=excluded.provider_event_at,last_event_type=excluded.last_event_type,
        updated_at=now()
      where public.subscriptions.user_id=excluded.user_id
        and (public.subscriptions.provider_event_at is null or excluded.provider_event_at >= public.subscriptions.provider_event_at);
      update public.profiles set plan=case when exists(
        select 1 from public.subscriptions s
        where s.user_id=p_user and s.status='active'
          and (s.next_billing_date is null or s.next_billing_date>now())
      ) then 'premium' else 'free' end,updated_at=now() where id=p_user;
    end if;
  end if;

  update public.webhook_events set processed_at=now(),error=null where id=p_event_id;
  return jsonb_build_object('status','processed','creditsGranted',ledger_id is not null);
end $$;

create or replace function public.process_dodo_subscription_webhook(
  p_event_id text,
  p_event_type text,
  p_event_at timestamptz,
  p_payload jsonb,
  p_user uuid,
  p_subscription_id text,
  p_product_id text,
  p_status text,
  p_cancel_at_next_billing_date boolean,
  p_next_billing_date timestamptz
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare event_row public.webhook_events%rowtype; existing_subscription public.subscriptions%rowtype; applied_count integer := 0;
begin
  if p_event_type not in (
    'subscription.active','subscription.renewed','subscription.cancelled',
    'subscription.on_hold','subscription.failed','subscription.expired'
  ) then raise exception 'unsupported_subscription_event'; end if;
  if p_status not in ('pending','active','on_hold','paused','cancelled','failed','expired','past_due') then
    raise exception 'invalid_subscription_status';
  end if;

  insert into public.webhook_events(id,event_type,payload,error)
  values(p_event_id,p_event_type,p_payload,null) on conflict(id) do nothing;
  select * into event_row from public.webhook_events where id=p_event_id for update;
  if event_row.event_type<>p_event_type then raise exception 'webhook_event_identity_mismatch'; end if;
  if event_row.processed_at is not null then return jsonb_build_object('status','duplicate'); end if;
  update public.webhook_events set event_type=p_event_type,payload=p_payload,error=null where id=p_event_id;

  perform 1 from public.profiles where id=p_user for update;
  if not found then raise exception 'profile_not_found'; end if;

  select * into existing_subscription from public.subscriptions where provider_subscription_id=p_subscription_id for update;
  if found and (existing_subscription.user_id<>p_user or existing_subscription.product_id<>p_product_id) then
    raise exception 'subscription_identity_mismatch';
  end if;

  insert into public.subscriptions(
    user_id,provider_subscription_id,product_id,status,cancel_at_next_billing_date,
    next_billing_date,provider_event_at,last_event_type
  ) values (
    p_user,p_subscription_id,p_product_id,p_status,p_cancel_at_next_billing_date,
    p_next_billing_date,p_event_at,p_event_type
  ) on conflict(provider_subscription_id) do update set
    user_id=excluded.user_id,product_id=excluded.product_id,status=excluded.status,
    cancel_at_next_billing_date=excluded.cancel_at_next_billing_date,
    next_billing_date=excluded.next_billing_date,provider_event_at=excluded.provider_event_at,
    last_event_type=excluded.last_event_type,updated_at=now()
  where public.subscriptions.user_id=excluded.user_id
    and (
      public.subscriptions.provider_event_at is null
      or excluded.provider_event_at > public.subscriptions.provider_event_at
      or (
        excluded.provider_event_at = public.subscriptions.provider_event_at
        and excluded.status in ('on_hold','cancelled','failed','expired')
        and public.subscriptions.status not in ('on_hold','cancelled','failed','expired')
      )
    );
  get diagnostics applied_count = row_count;

  if applied_count=1 then
    update public.profiles set plan=case when exists(
      select 1 from public.subscriptions s
      where s.user_id=p_user and s.status='active'
        and (s.next_billing_date is null or s.next_billing_date>now())
    ) then 'premium' else 'free' end,updated_at=now() where id=p_user;
  end if;

  update public.webhook_events set processed_at=now(),error=null where id=p_event_id;
  return jsonb_build_object('status','processed','stateApplied',applied_count=1);
end $$;

revoke all on function public.process_dodo_payment_webhook(text,text,timestamptz,jsonb,uuid,text,text,text,integer,text,text,integer,text,timestamptz,text,text) from public,anon,authenticated;
revoke all on function public.process_dodo_subscription_webhook(text,text,timestamptz,jsonb,uuid,text,text,text,boolean,timestamptz) from public,anon,authenticated;
grant execute on function public.process_dodo_payment_webhook(text,text,timestamptz,jsonb,uuid,text,text,text,integer,text,text,integer,text,timestamptz,text,text) to service_role;
grant execute on function public.process_dodo_subscription_webhook(text,text,timestamptz,jsonb,uuid,text,text,text,boolean,timestamptz) to service_role;
grant execute on function public.grant_paid_credits(uuid,integer,text,text,text) to service_role;

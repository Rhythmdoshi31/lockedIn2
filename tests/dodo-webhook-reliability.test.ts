import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { creditsForPayment, shouldApplyProviderEvent, webhookIdentity } from "../src/lib/dodo-webhook-policy.ts";

const userId="123e4567-e89b-42d3-a456-426614174000";

test("Starter and Premium successful payments grant exactly 10 and 80 credits",()=>{
  assert.equal(creditsForPayment("starter",true),10);
  assert.equal(creditsForPayment("premium",true),80);
  assert.equal(creditsForPayment("starter",false),0);
  assert.equal(creditsForPayment("premium",false),0);
});

test("webhook metadata accepts only a UUID and explicit Starter or Premium plan",()=>{
  assert.deepEqual(webhookIdentity({lockedin_user_id:userId,lockedin_plan:"starter"}),{userId,plan:"starter"});
  assert.equal(webhookIdentity({lockedin_user_id:userId,lockedin_plan:"unknown"}),null);
  assert.equal(webhookIdentity({lockedin_user_id:"not-a-uuid",lockedin_plan:"premium"}),null);
});

test("older provider events cannot replace newer subscription state",()=>{
  assert.equal(shouldApplyProviderEvent("2026-11-07T12:00:00.000Z","2026-11-07T11:59:59.000Z"),false);
  assert.equal(shouldApplyProviderEvent("2026-11-07T12:00:00.000Z","2026-11-07T12:00:00.000Z"),false);
  assert.equal(shouldApplyProviderEvent("2026-11-07T12:00:00.000Z","2026-11-07T12:00:01.000Z"),true);
});

test("atomic RPC SQL claims duplicates, grants once, and completes last",async()=>{
  const sql=await readFile(new URL("../supabase/migrations/202611070003_dodo_webhook_reliability.sql",import.meta.url),"utf8");
  assert.match(sql,/select \* into event_row[\s\S]*for update/);
  assert.match(sql,/if event_row\.processed_at is not null then return jsonb_build_object\('status','duplicate'\)/);
  assert.match(sql,/credit_ledger_dodo_payment_reference_key/);
  assert.match(sql,/on conflict do nothing returning id into ledger_id/);
  assert.match(sql,/if ledger_id is not null then[\s\S]*paid_credits=paid_credits\+p_credits/);
  assert.match(sql,/update public\.webhook_events set processed_at=now\(\),error=null/);
  assert.ok(sql.indexOf("paid_credits=paid_credits+p_credits")<sql.indexOf("processed_at=now()"));
});

test("failed payments persist with zero credits and RPC errors remain retryable",async()=>{
  const sql=await readFile(new URL("../supabase/migrations/202611070003_dodo_webhook_reliability.sql",import.meta.url),"utf8");
  const route=await readFile(new URL("../src/app/api/webhooks/dodo/route.ts",import.meta.url),"utf8");
  assert.match(sql,/p_event_type='payment.failed' and p_credits<>0/);
  assert.match(route,/if\(error\)throw error/);
  assert.match(route,/status:500/);
  assert.match(route,/webhooks\.unwrap/);
  assert.doesNotMatch(route,/unsafeUnwrap\(raw/);
});

test("subscription entitlement uses authoritative status, period end, and event timestamp",async()=>{
  const sql=await readFile(new URL("../supabase/migrations/202611070003_dodo_webhook_reliability.sql",import.meta.url),"utf8");
  assert.match(sql,/excluded\.provider_event_at > public\.subscriptions\.provider_event_at/);
  assert.match(sql,/s\.status='active'/);
  assert.match(sql,/s\.next_billing_date is null or s\.next_billing_date>now\(\)/);
  assert.match(sql,/cancel_at_next_billing_date=excluded\.cancel_at_next_billing_date/);
});

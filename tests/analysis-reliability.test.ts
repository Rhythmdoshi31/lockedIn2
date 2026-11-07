import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { estimateInputTokens, isTemporaryTransportError, recoveryAction, type GeminiFailureKind } from "../src/lib/gemini-reliability.ts";

function simulateModels(outcomes: Array<GeminiFailureKind | "success">) {
  let model = 0; let attempts = 0; let recoveryUsed = false;
  for (const outcome of outcomes) {
    attempts += 1;
    if (outcome === "success") return {status:"success",model,attempts};
    const action = recoveryAction({failure:outcome,temporaryAttempt:attempts,maxTemporaryAttempts:3,responseRecoveryUsed:recoveryUsed,hasFallback:model===0});
    if (action === "recover") recoveryUsed = true;
    if (action === "fallback") { model += 1; attempts = 0; recoveryUsed = false; }
    if (action === "fail") return {status:"failed",model,attempts};
  }
  return {status:"incomplete",model,attempts};
}

test("primary success completes on the first request", () => {
  assert.deepEqual(simulateModels(["success"]),{status:"success",model:0,attempts:1});
});

test("temporary failures retry with a bound then fall back", () => {
  assert.equal(recoveryAction({failure:"temporary",temporaryAttempt:1,maxTemporaryAttempts:3,responseRecoveryUsed:false,hasFallback:true}),"retry");
  assert.equal(recoveryAction({failure:"temporary",temporaryAttempt:3,maxTemporaryAttempts:3,responseRecoveryUsed:false,hasFallback:true}),"fallback");
  assert.equal(recoveryAction({failure:"temporary",temporaryAttempt:3,maxTemporaryAttempts:3,responseRecoveryUsed:false,hasFallback:false}),"fail");
});

test("retry success, fallback success, and both-model failure follow policy", () => {
  assert.deepEqual(simulateModels(["temporary","success"]),{status:"success",model:0,attempts:2});
  assert.deepEqual(simulateModels(["temporary","temporary","temporary","success"]),{status:"success",model:1,attempts:1});
  assert.deepEqual(simulateModels(["temporary","temporary","temporary","temporary","temporary","temporary"]),{status:"failed",model:1,attempts:3});
});

test("malformed responses get exactly one same-model recovery", () => {
  assert.equal(recoveryAction({failure:"malformed",temporaryAttempt:1,maxTemporaryAttempts:3,responseRecoveryUsed:false,hasFallback:true}),"recover");
  assert.equal(recoveryAction({failure:"malformed",temporaryAttempt:1,maxTemporaryAttempts:3,responseRecoveryUsed:true,hasFallback:true}),"fail");
});

test("timeouts, networks, rate limits and all 5xx responses are temporary", () => {
  assert.equal(isTemporaryTransportError(new Error("fetch failed"),null),true);
  assert.equal(isTemporaryTransportError(new DOMException("timed out","TimeoutError"),null),true);
  assert.equal(isTemporaryTransportError(new Error("rate limited"),429),true);
  assert.equal(isTemporaryTransportError(new Error("bad gateway"),502),true);
  assert.equal(isTemporaryTransportError(new Error("unauthorized"),401),false);
  assert.equal(isTemporaryTransportError(new Error("invalid argument"),400),false);
});

test("input token estimates expose over-budget text without truncation", () => {
  assert.equal(estimateInputTokens("a".repeat(180_000)),60_000);
  assert.equal(estimateInputTokens("a".repeat(180_001)),60_001);
});

test("database finalization saves before one idempotent deduction", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202611070001_analysis_idempotency.sql", import.meta.url),"utf8");
  assert.match(sql,/insert into analyses[\s\S]*if account\.plan/);
  assert.match(sql,/reference_id[\s\S]*p_request_id::text/);
  assert.match(sql,/request_id uuid primary key/);
  assert.match(sql,/status='completed'/);
});

test("usage compatibility migration restores required daily columns and server-only RPC access", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202611070002_analysis_usage_compatibility.sql", import.meta.url),"utf8");
  assert.match(sql,/add column if not exists daily_free_used/);
  assert.match(sql,/add column if not exists daily_free_usage_date/);
  assert.match(sql,/grant execute[\s\S]*to service_role/);
  assert.match(sql,/revoke all[\s\S]*from public,anon,authenticated/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { neutralAnalysisApiMessage, publicAnalysisErrorMessage } from "../src/lib/analysis-public-error.ts";

test("provider-identifying internal AI errors map to neutral public messages", () => {
  assert.equal(publicAnalysisErrorMessage("INVALID_AI_RESPONSE"), "The analysis engine returned an incomplete result. Please try again.");
  assert.equal(publicAnalysisErrorMessage("AI_REQUEST_FAILED"), "The analysis engine is temporarily unavailable. Please try again shortly.");
  assert.equal(publicAnalysisErrorMessage("AI_RESPONSE_BLOCKED"), "The analysis could not be completed for this document.");
  assert.equal(publicAnalysisErrorMessage("INVALID_AI_CONFIGURATION"), "The analysis service is temporarily unavailable.");
  assert.equal(neutralAnalysisApiMessage("INVALID_AI_RESPONSE", "Gemini returned invalid structured data."), "The analysis engine returned an incomplete result. Please try again.");
  assert.equal(neutralAnalysisApiMessage("AI_REQUEST_FAILED", "The configured model identifier is unavailable."), "The analysis engine is temporarily unavailable. Please try again shortly.");
});

test("analysis API preserves code and request ID while never returning internal AnalysisError messages", async () => {
  const source = await readFile(new URL("../src/app/api/analyze/route.ts", import.meta.url), "utf8");
  const analysisErrorBlock = source.slice(source.indexOf("if (error instanceof AnalysisError)"), source.indexOf("pipelineLog({", source.indexOf("if (error instanceof AnalysisError)")));
  assert.match(analysisErrorBlock, /errorResponse\(requestId, error\.code, publicAnalysisErrorMessage\(error\.code\)/);
  assert.doesNotMatch(analysisErrorBlock, /error\.message/);
  assert.match(source, /\{ error: \{ code, message, requestId \} \}/);
});

test("browser diagnostics do not log raw server or provider error messages", async () => {
  const source = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /neutralAnalysisApiMessage\(parsedError\.data\.error\.code, parsedError\.data\.error\.message\)/);
  assert.doesNotMatch(source, /event: "analysis_flow"[\s\S]{0,240}error: requestError/);
  assert.match(source, /serverRequestId:/);
});

test("customer-facing application does not name an AI provider or model", async () => {
  const privacy = await readFile(new URL("../src/app/privacy/page.tsx", import.meta.url), "utf8");
  assert.match(privacy, /third-party AI processing provider/);
  assert.doesNotMatch(privacy, /Gemini|OpenAI|Claude|\bGPT\b|gemini-[\w.-]+/i);
});

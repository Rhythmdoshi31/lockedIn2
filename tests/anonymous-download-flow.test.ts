import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  continuePendingAnalysis,
  createPendingAnalysis,
  parsePendingAnalysis,
  pendingAuthenticationPath,
  serializePendingAnalysis,
} from "../src/lib/pending-analysis.ts";
import type { AnalysisResult } from "../src/schemas/analysis.ts";

const result: AnalysisResult = {
  summaryTitle: "A complete report",
  personalizedAssessment: "A complete evidence-based assessment.",
  gaps: [],
  matchingSkills: ["TypeScript"],
  competitiveStrengths: [1, 2, 3].map((index) => ({ capability: `Strength ${index}`, technologies: ["TypeScript"], resumeEvidence: "Demonstrated evidence.", relevance: "Relevant to the role." })),
  rubric: { skills: 40, experience: 25, education: 8, roleAlignment: 12 },
  rubricExplanations: {
    skills: { explanation: "Strong skills." },
    experience: { explanation: "Relevant experience." },
    education: { explanation: "Education aligns." },
    roleAlignment: { explanation: "Role aligns." },
  },
  keywords: { alreadyDemonstrated: [], insufficientlyDemonstrated: [], notFound: [] },
  actionPlan: [1, 2, 3].map((priority) => ({ priority, type: "resume_wording" as const, action: `Action ${priority}`, rationale: "Improves clarity." })),
  finalAssessment: { strongestArea: "Technical delivery.", biggestGap: "More quantified outcomes.", nextActions: ["Add metrics.", "Clarify scope.", "Proofread."] },
  score: 85,
  jobTitle: "Software Engineer",
  companyName: "Example Company",
  requirementsAnalyzed: 5,
  resumeEnhancements: [{ type: "bullet", section: "Experience", original: "Built software.", improved: "Built reliable software.", explanation: "Adds specificity." }],
};

const requestId = "123e4567-e89b-42d3-a456-426614174000";

for (const format of ["pdf", "docx"] as const) {
  test(`preserves, persists, and resumes the ${format.toUpperCase()} download after authentication`, async () => {
    const beforeLogin = createPendingAnalysis({ requestId, result, jobUrl: "https://example.com/jobs/1", resumeName: "resume.pdf", downloadFormat: format });
    const browserStorage = serializePendingAnalysis(beforeLogin);

    // A login refresh and an email-verification round trip only serialize browser state;
    // neither step can remove or truncate the report or its requested format.
    const afterRefresh = parsePendingAnalysis(browserStorage, () => crypto.randomUUID());
    const afterVerification = parsePendingAnalysis(serializePendingAnalysis(afterRefresh!), () => crypto.randomUUID());
    assert.deepEqual(afterVerification?.result, result);
    assert.equal(afterVerification?.downloadFormat, format);

    const calls: string[] = [];
    const status = await continuePendingAnalysis(afterVerification!, {
      persist: async () => { calls.push("persist"); return true; },
      download: async (_, requestedFormat) => { calls.push(`download:${requestedFormat}`); return true; },
    });
    assert.equal(status, "completed");
    assert.deepEqual(calls, ["persist", `download:${format}`]);
  });
}

test("failed persistence retains the pending report and never starts a download", async () => {
  const pending = createPendingAnalysis({ requestId, result, jobUrl: "https://example.com/jobs/1", resumeName: null, downloadFormat: "pdf" });
  let downloads = 0;
  const status = await continuePendingAnalysis(pending, {
    persist: async () => false,
    download: async () => { downloads += 1; return true; },
  });
  assert.equal(status, "persistence_failed");
  assert.equal(downloads, 0);
  assert.equal(parsePendingAnalysis(serializePendingAnalysis(pending), () => crypto.randomUUID())?.result.summaryTitle, result.summaryTitle);
});

test("failed download reports a recoverable state after successful persistence", async () => {
  const pending = createPendingAnalysis({ requestId, result, jobUrl: "https://example.com/jobs/1", resumeName: "resume.docx", downloadFormat: "docx" });
  const calls: string[] = [];
  const status = await continuePendingAnalysis(pending, {
    persist: async () => { calls.push("persist"); return true; },
    download: async () => { calls.push("download"); return false; },
  });
  assert.equal(status, "download_failed");
  assert.deepEqual(calls, ["persist", "download"]);
  assert.equal(parsePendingAnalysis(serializePendingAnalysis(pending), () => crypto.randomUUID())?.downloadFormat, "docx");
});

test("authentication redirect contains only control state, never private report data", () => {
  const path = pendingAuthenticationPath();
  assert.match(path, /^\/auth\?/);
  assert.match(path, /saveReport%3D1/);
  assert.doesNotMatch(path, /complete report|Software Engineer|resume\.pdf/i);
});

test("anonymous report persistence is idempotent by user and request ID", async () => {
  const source = await readFile(new URL("../src/app/api/analyses/route.ts", import.meta.url), "utf8");
  assert.match(source, /\.eq\("user_id", user\.id\)\.eq\("request_id", requestId\)\.maybeSingle\(\)/);
  assert.match(source, /request_id: requestId/);
  assert.match(source, /error\.code === "23505"/);
  const home = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(home, /pendingTransferStarted\.current/);
  assert.match(home, /status === "completed"[\s\S]*removeItem\(PENDING_ANALYSIS_KEY\)/);
});

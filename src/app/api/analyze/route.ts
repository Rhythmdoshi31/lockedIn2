import { NextResponse } from "next/server";

import { AnalysisError, analyzeResume } from "@/lib/gemini";
import { JobScrapeError, scrapeJobDescription } from "@/lib/job-scraper";
import { pipelineLog } from "@/lib/pipeline-log";
import { extractResumeText, ResumeParseError } from "@/lib/resume-parser";

export const runtime = "nodejs";
export const maxDuration = 120;

function requestIdFrom(request: Request): string {
  const suppliedRequestId = request.headers.get("x-request-id");
  return suppliedRequestId && /^[a-zA-Z0-9_-]{8,80}$/.test(suppliedRequestId)
    ? suppliedRequestId
    : crypto.randomUUID();
}

function errorResponse(
  requestId: string,
  code: string,
  message: string,
  status: number,
  startedAt: number,
) {
  pipelineLog({
    requestId,
    stage: "api.response",
    event: "analysis_response",
    status: "failed",
    durationMs: Math.round(performance.now() - startedAt),
    details: { code, httpStatus: status },
  });
  return NextResponse.json(
    { error: { code, message, requestId } },
    { status, headers: { "x-request-id": requestId } },
  );
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const requestStartedAt = performance.now();
  pipelineLog({
    requestId,
    stage: "api.request",
    event: "analysis_request",
    status: "started",
    details: { contentLength: Number(request.headers.get("content-length")) || null },
  });

  const contextKey = process.env.CONTEXT_KEY;
  const geminiKey = process.env.GEMINI_KEY;

  if (!contextKey || !geminiKey) {
    pipelineLog({
      requestId,
      stage: "api.configuration",
      event: "environment_validation",
      status: "failed",
      details: { contextConfigured: Boolean(contextKey), geminiConfigured: Boolean(geminiKey) },
    });
    return errorResponse(
      requestId,
      "SERVER_CONFIGURATION",
      "The analysis service is missing its server configuration.",
      500,
      requestStartedAt,
    );
  }

  try {
    const formStartedAt = performance.now();
    const formData = await request.formData();
    const file = formData.get("resume");
    const jobUrl = formData.get("jobUrl");
    pipelineLog({
      requestId,
      stage: "api.validation",
      event: "multipart_parsing",
      status: "succeeded",
      durationMs: Math.round(performance.now() - formStartedAt),
      details: { hasResume: file instanceof File, hasJobUrl: typeof jobUrl === "string" },
    });

    if (!(file instanceof File)) {
      pipelineLog({
        requestId,
        stage: "api.validation",
        event: "resume_presence_check",
        status: "rejected",
      });
      return errorResponse(
        requestId,
        "MISSING_RESUME",
        "No résumé reached the server. Select the file again and retry.",
        400,
        requestStartedAt,
      );
    }
    if (typeof jobUrl !== "string" || jobUrl.length > 2_048) {
      pipelineLog({
        requestId,
        stage: "api.validation",
        event: "job_url_presence_check",
        status: "rejected",
      });
      return errorResponse(
        requestId,
        "INVALID_JOB_URL",
        "The job posting URL is missing or too long.",
        400,
        requestStartedAt,
      );
    }

    pipelineLog({
      requestId,
      stage: "api.validation",
      event: "request_validation",
      status: "succeeded",
      details: { fileSizeBytes: file.size, mimeType: file.type || "unknown" },
    });
    const resumeText = await extractResumeText(file, requestId);
    const jobText = await scrapeJobDescription(jobUrl, contextKey, requestId);
    const result = await analyzeResume(resumeText, jobText, geminiKey, requestId);

    pipelineLog({
      requestId,
      stage: "api.response",
      event: "analysis_response",
      status: "succeeded",
      durationMs: Math.round(performance.now() - requestStartedAt),
      details: { httpStatus: 200, score: result.score },
    });
    return NextResponse.json(result, { headers: { "x-request-id": requestId } });
  } catch (error) {
    if (error instanceof ResumeParseError) {
      return errorResponse(requestId, error.code, error.message, 400, requestStartedAt);
    }
    if (error instanceof JobScrapeError) {
      return errorResponse(requestId, error.code, error.message, 422, requestStartedAt);
    }
    if (error instanceof AnalysisError) {
      return errorResponse(requestId, error.code, error.message, 502, requestStartedAt);
    }

    pipelineLog({
      requestId,
      stage: "api.unexpected",
      event: "unhandled_pipeline_error",
      status: "failed",
      error,
    });
    return errorResponse(
      requestId,
      "ANALYSIS_FAILED",
      "An unexpected server error interrupted the analysis. Please try again.",
      500,
      requestStartedAt,
    );
  }
}

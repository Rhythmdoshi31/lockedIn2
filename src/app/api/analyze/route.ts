import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { AnalysisError, analyzeResume } from "@/lib/gemini";
import { JobScrapeError, scrapeJobDescription } from "@/lib/job-scraper";
import { pipelineLog } from "@/lib/pipeline-log";
import { extractResumeText, ResumeParseError } from "@/lib/resume-parser";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
  const cookieStore = await cookies();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let admin: ReturnType<typeof createAdminClient> | null = null;
  try { admin = createAdminClient(); } catch { /* configuration is handled below */ }

  let anonymousId = cookieStore.get("lockedin_anonymous_id")?.value;
  if (!user && (!anonymousId || !/^[0-9a-f-]{36}$/i.test(anonymousId))) anonymousId = crypto.randomUUID();

  if (admin) {
    if (user) {
      const { data: profile } = await admin.from("profiles").select("free_credits,paid_credits").eq("id", user.id).single();
      if (!profile || profile.free_credits + profile.paid_credits <= 0) {
        return errorResponse(requestId, "PRICING_REQUIRED", "Your free analyses are used. Choose a plan to continue.", 402, requestStartedAt);
      }
    } else if (anonymousId) {
      const { data: usage } = await admin.from("anonymous_usage").select("used_count").eq("anonymous_id", anonymousId).maybeSingle();
      if ((usage?.used_count ?? 0) >= 3) {
        const response = errorResponse(requestId, "SIGNUP_REQUIRED", "Create an account for 3 additional analyses.", 403, requestStartedAt);
        response.cookies.set("lockedin_anonymous_id", anonymousId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 31_536_000, path: "/" });
        response.cookies.set("lockedin_anon_used", "3", { sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 31_536_000, path: "/" });
        return response;
      }
    }
  }

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
    const suppliedResumeId = formData.get("resumeId");
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
    if (admin) {
      if (user) {
        let storedResumeId: string | null = null;
        if(typeof suppliedResumeId==="string"&&/^[0-9a-f-]{36}$/i.test(suppliedResumeId)){const {data:owned}=await admin.from("resumes").select("id").eq("id",suppliedResumeId).eq("user_id",user.id).maybeSingle();storedResumeId=owned?.id??null;}
        if(!storedResumeId){
          const extension = file.name.split(".").pop()?.toLowerCase() || "bin"; const newResumeId=crypto.randomUUID(); const path=`${user.id}/${newResumeId}.${extension}`; const bytes=Buffer.from(await file.arrayBuffer()); const uploaded=await admin.storage.from("resumes").upload(path,bytes,{contentType:file.type,upsert:false});
          if(!uploaded.error){const {data:resumeRow}=await admin.from("resumes").insert({id:newResumeId,user_id:user.id,file_name:file.name,storage_path:path,mime_type:file.type,size_bytes:file.size}).select("id").single();storedResumeId=resumeRow?.id??null;}
        }
        const { data: job } = await admin.from("job_descriptions").insert({ user_id: user.id, source_url: jobUrl, job_title: result.jobTitle, company_name: result.companyName || null }).select("id").single();
        await admin.from("analyses").insert({ user_id: user.id, resume_id: storedResumeId, job_description_id: job?.id ?? null, job_title: result.jobTitle, company_name: result.companyName || null, match_score: result.score, result });
        const { data: consumed } = await admin.rpc("consume_registered_credit", { p_user: user.id });
        if (!consumed) return errorResponse(requestId, "PRICING_REQUIRED", "Your available analyses were used by another request. Choose a plan to continue.", 402, requestStartedAt);
      } else if (anonymousId) {
        const { data: consumed } = await admin.rpc("consume_anonymous_credit", { p_id: anonymousId });
        if (!consumed) return errorResponse(requestId, "SIGNUP_REQUIRED", "Create an account for 3 additional analyses.", 403, requestStartedAt);
      }
    }
    const response = NextResponse.json(result, { headers: { "x-request-id": requestId } });
    if (!user && anonymousId) {
      const used = Math.min(3, Number(cookieStore.get("lockedin_anon_used")?.value || 0) + 1);
      response.cookies.set("lockedin_anonymous_id", anonymousId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 31_536_000, path: "/" });
      response.cookies.set("lockedin_anon_used", String(used), { sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 31_536_000, path: "/" });
    }
    return response;
  } catch (error) {
    if (error instanceof ResumeParseError) {
      return errorResponse(requestId, error.code, error.message, 400, requestStartedAt);
    }
    if (error instanceof JobScrapeError) {
      return errorResponse(requestId, error.code, error.message, 422, requestStartedAt);
    }
    if (error instanceof AnalysisError) {
      const status = ["DIRECT_JOB_URL_REQUIRED", "INCOMPLETE_JOB_DESCRIPTION"].includes(error.code)
        ? 422
        : error.code === "INVALID_AI_CONFIGURATION"
          ? 500
          : 502;
      return errorResponse(requestId, error.code, error.message, status, requestStartedAt);
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

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { analysisRateLimits } from "@/lib/analysis-rate-limit";
import { publicAnalysisErrorMessage } from "@/lib/analysis-public-error";
import { AnalysisError, analyzeResume } from "@/lib/gemini";
import { JobScrapeError, scrapeJobDescription } from "@/lib/job-scraper";
import { pipelineLog } from "@/lib/pipeline-log";
import { extractResumeText, ResumeParseError } from "@/lib/resume-parser";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 240;
const DAILY_FREE_LIMIT = 3;
const MAX_MULTIPART_BYTES = 11 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function utcDate() { return new Date().toISOString().slice(0, 10); }

function requestIdFrom(request: Request): string {
  const suppliedRequestId = request.headers.get("x-request-id");
  return suppliedRequestId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(suppliedRequestId)
    ? suppliedRequestId
    : crypto.randomUUID();
}

function errorResponse(
  requestId: string,
  code: string,
  message: string,
  status: number,
  startedAt: number,
  headers?: Record<string, string>,
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
    { status, headers: { "x-request-id": requestId, ...headers } },
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
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    pipelineLog({
      requestId,
      stage: "auth.user",
      event: "authenticated_user_lookup",
      status: "failed",
      error: authError,
    });
  }
  let admin: ReturnType<typeof createAdminClient> | null = null;
  try { admin = createAdminClient(); } catch { /* configuration is handled below */ }

  let anonymousId = cookieStore.get("lockedin_anonymous_id")?.value;
  if (!user && (!anonymousId || !UUID_PATTERN.test(anonymousId))) anonymousId = requestId;
  const ownerKey = user ? `user:${user.id}` : `anon:${anonymousId}`;
  let requestClaimed = false;

  if (!admin) return errorResponse(requestId, "SERVER_CONFIGURATION", "Usage limits are temporarily unavailable.", 500, requestStartedAt);

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
      publicAnalysisErrorMessage("SERVER_CONFIGURATION"),
      500,
      requestStartedAt,
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BYTES) {
    return errorResponse(
      requestId,
      "REQUEST_TOO_LARGE",
      "The analysis request is too large. Choose a résumé up to 10 MB.",
      413,
      requestStartedAt,
    );
  }

  const { data: existingRequest } = await admin.from("analysis_requests")
    .select("owner_key")
    .eq("request_id", requestId)
    .maybeSingle();
  const limits = existingRequest?.owner_key === ownerKey
    ? []
    : analysisRateLimits(request, user?.id ?? null, process.env.SUPABASE_SECRET_KEY!);

  for (const limit of limits) {
    const { data: allowed, error: rateLimitError } = await admin.rpc("check_analysis_rate_limit", {
      p_key: limit.key,
      p_limit: limit.limit,
      p_window_seconds: limit.windowSeconds,
    });
    if (rateLimitError) {
      pipelineLog({
        requestId,
        stage: "usage.rate_limit",
        event: "analysis_rate_limit",
        status: "failed",
        details: { errorCode: rateLimitError.code ?? "RATE_LIMIT_UNAVAILABLE" },
        error: rateLimitError,
      });
      return errorResponse(
        requestId,
        "SERVER_CONFIGURATION",
        "Analysis request limits are temporarily unavailable.",
        500,
        requestStartedAt,
      );
    }
    if (!allowed) {
      return errorResponse(
        requestId,
        "RATE_LIMITED",
        "Too many analysis requests were submitted. Please wait before trying again.",
        429,
        requestStartedAt,
        { "Retry-After": String(limit.windowSeconds) },
      );
    }
  }

  try {
    const formStartedAt = performance.now();
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return errorResponse(
        requestId,
        "INVALID_MULTIPART_BODY",
        "The uploaded form could not be read. Select the résumé again and retry.",
        400,
        requestStartedAt,
      );
    }
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

    const { data: claim, error: claimError } = await admin.rpc("claim_analysis_request", { p_request_id: requestId, p_owner_key: ownerKey });
    if (claimError) return errorResponse(requestId, "SERVER_CONFIGURATION", "Duplicate-request protection is not configured. Apply the latest database migration.", 500, requestStartedAt);
    const claimResult = claim as { status?: string; result?: unknown } | null;
    if (claimResult?.status === "completed" && claimResult.result) {
      const replay = NextResponse.json(claimResult.result, { headers: { "x-request-id": requestId, "x-idempotent-replay": "true" } });
      if (!user && anonymousId) {
        const {data: usage}=await admin.from("anonymous_usage").select("used_count").eq("anonymous_id",anonymousId).maybeSingle();
        replay.cookies.set("lockedin_anonymous_id",anonymousId,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:31_536_000,path:"/"});
        replay.cookies.set("lockedin_anon_used",String(usage?.used_count??0),{sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:31_536_000,path:"/"});
      }
      return replay;
    }
    if (claimResult?.status !== "claimed") {
      return errorResponse(requestId, "ANALYSIS_IN_PROGRESS", "This analysis request is already processing. Wait a moment before retrying.", 409, requestStartedAt);
    }
    requestClaimed = true;

    if (user) {
      const { data: profile, error: profileError } = await admin.from("profiles").select("daily_free_used,daily_free_usage_date,paid_credits,plan").eq("id", user.id).single();
      if (profileError || !profile) {
        pipelineLog({
          requestId,
          stage: "usage.profile_lookup",
          event: "account_usage_verification",
          status: "failed",
          details: {
            authenticatedUser: true,
            adminClient: true,
            errorCode: profileError?.code ?? "PROFILE_NOT_FOUND",
          },
          error: profileError ?? new Error("Authenticated user has no profile row."),
        });
        throw new AnalysisError("Account usage could not be verified.", "USAGE_UNAVAILABLE");
      }
      const usedToday = profile.daily_free_usage_date === utcDate() ? profile.daily_free_used : 0;
      const dailyRemaining = profile.plan === "premium" ? 0 : Math.max(0, DAILY_FREE_LIMIT - usedToday);
      if (dailyRemaining + profile.paid_credits <= 0) throw new AnalysisError(profile.plan === "premium" ? "Your available credits are used. Choose a plan to continue." : "Your free analyses for today are used. Choose a plan to continue now.", "PRICING_REQUIRED");
    } else if (anonymousId) {
      const { data: usage } = await admin.from("anonymous_usage").select("used_count").eq("anonymous_id", anonymousId).maybeSingle();
      if ((usage?.used_count ?? 0) >= 3) throw new AnalysisError("Create an account for 3 daily free analyses.", "SIGNUP_REQUIRED");
    }

    const resumeText = await extractResumeText(file, requestId);
    const jobText = await scrapeJobDescription(jobUrl, contextKey, requestId);
    const result = await analyzeResume(resumeText, jobText, geminiKey, requestId);

    if (user) {
        let storedResumeId: string | null = null;
        if(typeof suppliedResumeId==="string"&&UUID_PATTERN.test(suppliedResumeId)){const {data:owned}=await admin.from("resumes").select("id").eq("id",suppliedResumeId).eq("user_id",user.id).maybeSingle();storedResumeId=owned?.id??null;}
        if(!storedResumeId){
          const extension = file.name.split(".").pop()?.toLowerCase() || "bin"; const newResumeId=crypto.randomUUID(); const path=`${user.id}/${newResumeId}.${extension}`; const bytes=Buffer.from(await file.arrayBuffer()); const uploaded=await admin.storage.from("resumes").upload(path,bytes,{contentType:file.type,upsert:false});
          if(uploaded.error) throw new AnalysisError("The validated report could not be saved with its résumé. No credit was used.","REPORT_SAVE_FAILED");
          const {data:resumeRow,error:resumeError}=await admin.from("resumes").insert({id:newResumeId,user_id:user.id,file_name:file.name,storage_path:path,mime_type:file.type,size_bytes:file.size}).select("id").single();
          if(resumeError||!resumeRow){await admin.storage.from("resumes").remove([path]);throw new AnalysisError("The validated report could not be saved with its résumé. No credit was used.","REPORT_SAVE_FAILED");}
          storedResumeId=resumeRow.id;
        }
        const {data:finalized,error:finalizeError}=await admin.rpc("finalize_registered_analysis",{p_request_id:requestId,p_owner_key:ownerKey,p_user:user.id,p_resume_id:storedResumeId,p_source_url:jobUrl,p_job_title:result.jobTitle,p_company_name:result.companyName||null,p_score:result.score,p_result:result});
        if(finalizeError||(finalized as {status?:string}|null)?.status!=="completed")throw new AnalysisError("The validated report could not be saved and no credit was used. Please try again.","REPORT_SAVE_FAILED");
      } else if (anonymousId) {
        const {data:finalized,error:finalizeError}=await admin.rpc("finalize_anonymous_analysis",{p_request_id:requestId,p_owner_key:ownerKey,p_anonymous_id:anonymousId,p_result:result});
        if(finalizeError||(finalized as {status?:string}|null)?.status!=="completed")throw new AnalysisError("The validated report could not be completed and no usage was deducted. Please try again.","REPORT_SAVE_FAILED");
      }
    requestClaimed = false;
    pipelineLog({
      requestId,
      stage: "api.response",
      event: "analysis_response",
      status: "succeeded",
      durationMs: Math.round(performance.now() - requestStartedAt),
      details: { httpStatus: 200, score: result.score },
    });
    const response = NextResponse.json(result, { headers: { "x-request-id": requestId } });
    if (!user && anonymousId) {
      const used = Math.min(3, Number(cookieStore.get("lockedin_anon_used")?.value || 0) + 1);
      response.cookies.set("lockedin_anonymous_id", anonymousId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 31_536_000, path: "/" });
      response.cookies.set("lockedin_anon_used", String(used), { sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 31_536_000, path: "/" });
    }
    return response;
  } catch (error) {
    if (requestClaimed) await admin.rpc("fail_analysis_request", { p_request_id: requestId, p_owner_key: ownerKey });
    if (error instanceof ResumeParseError) {
      return errorResponse(requestId, error.code, error.message, 400, requestStartedAt);
    }
    if (error instanceof JobScrapeError) {
      return errorResponse(requestId, error.code, error.message, 422, requestStartedAt);
    }
    if (error instanceof AnalysisError) {
      if (error.code === "PRICING_REQUIRED") return errorResponse(requestId, error.code, publicAnalysisErrorMessage(error.code), 402, requestStartedAt);
      if (error.code === "SIGNUP_REQUIRED") return errorResponse(requestId, error.code, publicAnalysisErrorMessage(error.code), 403, requestStartedAt);
      const status = ["DIRECT_JOB_URL_REQUIRED", "INCOMPLETE_JOB_DESCRIPTION"].includes(error.code)
        ? 422
        : error.code === "INVALID_AI_CONFIGURATION"
          ? 500
          : 502;
      return errorResponse(requestId, error.code, publicAnalysisErrorMessage(error.code), status, requestStartedAt);
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

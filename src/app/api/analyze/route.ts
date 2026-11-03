import { NextResponse } from "next/server";

import { AnalysisError, analyzeResume } from "@/lib/gemini";
import { JobScrapeError, scrapeJobDescription } from "@/lib/job-scraper";
import { extractResumeText, ResumeParseError } from "@/lib/resume-parser";

export const runtime = "nodejs";
export const maxDuration = 120;

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const contextKey = process.env.CONTEXT_KEY;
  const geminiKey = process.env.GEMINI_KEY;

  if (!contextKey || !geminiKey) {
    return errorResponse("SERVER_CONFIGURATION", "The analysis service is not configured.", 500);
  }

  try {
    const formData = await request.formData();
    const file = formData.get("resume");
    const jobUrl = formData.get("jobUrl");

    if (!(file instanceof File)) {
      return errorResponse("MISSING_RESUME", "Choose a PDF or DOCX résumé.", 400);
    }
    if (typeof jobUrl !== "string" || jobUrl.length > 2_048) {
      return errorResponse("INVALID_JOB_URL", "Enter a valid job posting URL.", 400);
    }

    const resumeText = await extractResumeText(file);
    const jobText = await scrapeJobDescription(jobUrl, contextKey);
    const result = await analyzeResume(resumeText, jobText, geminiKey);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ResumeParseError) {
      return errorResponse(error.code, error.message, 400);
    }
    if (error instanceof JobScrapeError) {
      return errorResponse(error.code, error.message, 422);
    }
    if (error instanceof AnalysisError) {
      return errorResponse(error.code, error.message, 502);
    }

    console.error("Unexpected analysis error:", error instanceof Error ? error.message : "Unknown error");
    return errorResponse("ANALYSIS_FAILED", "The analysis could not be completed. Please try again.", 500);
  }
}

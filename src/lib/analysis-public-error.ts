const INCOMPLETE_RESPONSE_CODES = new Set([
  "INVALID_AI_RESPONSE",
  "AI_RESPONSE_INCOMPLETE",
  "EMPTY_AI_RESPONSE",
]);

const TEMPORARY_FAILURE_CODES = new Set([
  "AI_REQUEST_FAILED",
  "AI_TIMEOUT",
]);

const CONFIGURATION_FAILURE_CODES = new Set([
  "INVALID_AI_CONFIGURATION",
  "SERVER_CONFIGURATION",
]);

export function publicAnalysisErrorMessage(code: string): string {
  if (INCOMPLETE_RESPONSE_CODES.has(code)) {
    return "The analysis engine returned an incomplete result. Please try again.";
  }
  if (TEMPORARY_FAILURE_CODES.has(code)) {
    return "The analysis engine is temporarily unavailable. Please try again shortly.";
  }
  if (code === "AI_RESPONSE_BLOCKED") {
    return "The analysis could not be completed for this document.";
  }
  if (CONFIGURATION_FAILURE_CODES.has(code)) {
    return "The analysis service is temporarily unavailable.";
  }
  if (code === "AI_INPUT_TOO_LARGE") {
    return "The résumé and job description exceed the analysis input limit. Nothing was truncated and no credit was used.";
  }
  if (code === "DIRECT_JOB_URL_REQUIRED") {
    return "This appears to be a job-search results page. Open the specific role and paste its direct job posting URL.";
  }
  if (code === "INCOMPLETE_JOB_DESCRIPTION") {
    return "The page does not contain a complete job description. Paste the direct URL for the specific role.";
  }
  if (code === "PRICING_REQUIRED") {
    return "No analysis usage is currently available. Choose a plan to continue.";
  }
  if (code === "SIGNUP_REQUIRED") {
    return "Create an account for three free analyses every day.";
  }
  if (code === "USAGE_UNAVAILABLE") {
    return "Account usage could not be verified. Please try again shortly.";
  }
  if (code === "REPORT_SAVE_FAILED") {
    return "The completed analysis could not be saved. No credit was used. Please try again.";
  }
  return "The analysis could not be completed. Please try again.";
}

export function neutralAnalysisApiMessage(code: string, message: string): string {
  const isAiFailure = code.startsWith("AI_") || code.startsWith("INVALID_AI_") || code === "EMPTY_AI_RESPONSE";
  return isAiFailure ? publicAnalysisErrorMessage(code) : message;
}

export type GeminiFailureKind = "temporary" | "unavailable" | "malformed" | "permanent";
export type GeminiRecoveryAction = "retry" | "recover" | "fallback" | "fail";

export function recoveryAction(input: {
  failure: GeminiFailureKind;
  temporaryAttempt: number;
  maxTemporaryAttempts: number;
  responseRecoveryUsed: boolean;
  hasFallback: boolean;
}): GeminiRecoveryAction {
  if (input.failure === "malformed") return input.responseRecoveryUsed ? "fail" : "recover";
  if (input.failure === "permanent") return "fail";
  if (input.failure === "temporary" && input.temporaryAttempt < input.maxTemporaryAttempts) return "retry";
  return input.hasFallback ? "fallback" : "fail";
}

export function isTemporaryTransportError(error: unknown, status: number | null): boolean {
  if (status === 429 || (status !== null && status >= 500 && status <= 599)) return true;
  if (!(error instanceof Error)) return false;
  return error.name === "AbortError" || error.name === "TimeoutError" ||
    /(?:network|fetch failed|timed? ?out|timeout|econnreset|econnrefused|enotfound|socket hang up)/i.test(error.message);
}

export function estimateInputTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

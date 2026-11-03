type LogLevel = "info" | "warn" | "error";

interface PipelineLogEntry {
  requestId: string;
  stage: string;
  event: string;
  status: "started" | "succeeded" | "failed" | "rejected";
  durationMs?: number;
  details?: Record<string, boolean | number | string | null>;
  error?: unknown;
  level?: LogLevel;
}

function safeError(error: unknown): { errorName: string; errorMessage: string } | undefined {
  if (!error) return undefined;

  if (error instanceof Error) {
    const errorMessage = error.message
      .replace(/https?:\/\/\S+/gi, "[redacted-url]")
      .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[redacted-email]")
      .replace(/\b(?:AIza|sk-)[A-Za-z0-9_-]{12,}\b/g, "[redacted-token]")
      .replace(/\bBearer\s+\S+/gi, "Bearer [redacted-token]")
      .replace(/[\r\n\t]+/g, " ")
      .slice(0, 300);
    return {
      errorName: error.name,
      errorMessage,
    };
  }

  return { errorName: "UnknownError", errorMessage: "An unknown error occurred." };
}

export function pipelineLog({
  requestId,
  stage,
  event,
  status,
  durationMs,
  details,
  error,
  level = status === "failed" ? "error" : status === "rejected" ? "warn" : "info",
}: PipelineLogEntry): void {
  const sanitizedError = safeError(error);
  const entry = {
    timestamp: new Date().toISOString(),
    service: "lockedin",
    requestId,
    stage,
    event,
    status,
    ...(durationMs === undefined ? {} : { durationMs }),
    ...(details ? { details } : {}),
    ...(sanitizedError ? { error: sanitizedError } : {}),
  };

  console[level](JSON.stringify(entry));
}

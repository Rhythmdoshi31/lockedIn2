import { analysisResultSchema, type AnalysisResult } from "../schemas/analysis.ts";

export const PENDING_ANALYSIS_KEY = "lockedin.pendingAnalysis";
export const PENDING_ANALYSIS_RETURN_PATH = "/?saveReport=1";

export type PendingDownloadFormat = "pdf" | "docx";

export interface PendingAnalysis {
  version: 1;
  requestId: string;
  result: AnalysisResult;
  jobUrl: string;
  resumeName: string | null;
  downloadFormat: PendingDownloadFormat | null;
}

function validRequestId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function parsePendingAnalysis(raw: string | null, createRequestId: () => string): PendingAnalysis | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const result = analysisResultSchema.safeParse(value.result);
    if (!result.success || typeof value.jobUrl !== "string" || value.jobUrl.length > 2_048) return null;
    const downloadFormat = value.downloadFormat === "pdf" || value.downloadFormat === "docx" ? value.downloadFormat : null;
    return {
      version: 1,
      requestId: validRequestId(value.requestId) ? value.requestId : createRequestId(),
      result: result.data,
      jobUrl: value.jobUrl,
      resumeName: typeof value.resumeName === "string" ? value.resumeName.slice(0, 180) : null,
      downloadFormat,
    };
  } catch {
    return null;
  }
}

export function serializePendingAnalysis(pending: PendingAnalysis): string {
  return JSON.stringify(pending);
}

export function createPendingAnalysis(input: Omit<PendingAnalysis, "version" | "downloadFormat"> & { downloadFormat?: PendingDownloadFormat | null }): PendingAnalysis {
  return { version: 1, downloadFormat: input.downloadFormat ?? null, ...input };
}

export function pendingAuthenticationPath(): string {
  const params = new URLSearchParams({ next: PENDING_ANALYSIS_RETURN_PATH, reason: "download" });
  return `/auth?${params.toString()}`;
}

export async function continuePendingAnalysis(
  pending: PendingAnalysis,
  actions: {
    persist: (pending: PendingAnalysis) => Promise<boolean>;
    download: (pending: PendingAnalysis, format: PendingDownloadFormat) => Promise<boolean>;
  },
): Promise<"completed" | "persistence_failed" | "download_failed"> {
  if (!(await actions.persist(pending))) return "persistence_failed";
  if (pending.downloadFormat && !(await actions.download(pending, pending.downloadFormat))) return "download_failed";
  return "completed";
}

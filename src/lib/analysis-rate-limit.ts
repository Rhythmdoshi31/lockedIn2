import { createHmac } from "node:crypto";

export interface AnalysisRateLimit {
  key: string;
  limit: number;
  windowSeconds: number;
}

function clientAddress(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function opaqueKey(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function analysisRateLimits(
  request: Request,
  userId: string | null,
  secret: string,
): AnalysisRateLimit[] {
  if (userId) {
    return [{ key: opaqueKey(`user:${userId}:short`, secret), limit: 10, windowSeconds: 600 }];
  }

  const address = clientAddress(request);
  return [
    { key: opaqueKey(`anonymous:${address}:hour`, secret), limit: 4, windowSeconds: 3_600 },
    { key: opaqueKey(`anonymous:${address}:day`, secret), limit: 6, windowSeconds: 86_400 },
  ];
}

import { isIP } from "node:net";

import ContextDev from "context.dev";

import { pipelineLog } from "@/lib/pipeline-log";

const MAXIMUM_JOB_TEXT_LENGTH = 60_000;
const MINIMUM_JOB_WORDS = 120;
const LINKEDIN_JOB_ID_PATTERN = /^\d{6,20}$/;

interface LinkedInJobTarget {
  jobId: string;
  source: "direct" | "search_results";
  scrapeUrl: string;
}

interface ScrapedPageIdentity {
  url: string;
  metadata: {
    canonicalUrl?: string;
    jsonLd?: Array<Record<string, unknown>>;
    openGraph?: Record<string, string | string[]>;
  };
}

function isLinkedInHostname(hostname: string): boolean {
  return hostname === "linkedin.com" || hostname.endsWith(".linkedin.com");
}

export class JobScrapeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "JobScrapeError";
  }
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;

  const [first, second] = parts;
  return (
    first === 10 ||
    first === 127 ||
    first === 0 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

export function validatePublicJobUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new JobScrapeError("Enter a valid job posting URL.", "INVALID_JOB_URL");
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new JobScrapeError("Enter a public HTTP or HTTPS job posting URL.", "INVALID_JOB_URL");
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const blockedHostname =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal");

  const ipVersion = isIP(hostname);
  const blockedIpv6 =
    ipVersion === 6 &&
    (hostname === "::1" ||
      hostname === "::" ||
      hostname.startsWith("fc") ||
      hostname.startsWith("fd") ||
      /^fe[89ab]/.test(hostname));

  if (blockedHostname || (ipVersion === 4 && isPrivateIpv4(hostname)) || blockedIpv6) {
    throw new JobScrapeError("Private or local network URLs are not supported.", "INVALID_JOB_URL");
  }

  return url;
}

function isSearchResultsUrl(url: URL): boolean {
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  const pathname = url.pathname.toLowerCase();
  const hasSearchQuery = ["q", "query", "keywords", "keyword"].some((key) => url.searchParams.has(key));

  if (/^(google\.|bing\.com$|search\.yahoo\.com$|duckduckgo\.com$)/.test(hostname)) {
    return pathname.includes("search") || hasSearchQuery;
  }
  if (isLinkedInHostname(hostname) && pathname.startsWith("/jobs/search")) return true;
  if (hostname.endsWith("indeed.com") && pathname === "/jobs" && hasSearchQuery) return true;
  if (hostname.endsWith("glassdoor.com") && /\/job\/jobs|\/job-search/.test(pathname)) return true;
  return /\/(?:jobs?|careers?)\/search(?:\/|$)/.test(pathname);
}

function validatedLinkedInJobId(value: string | null): string | null {
  if (!value || !LINKEDIN_JOB_ID_PATTERN.test(value)) return null;
  return /^0+$/.test(value) ? null : value;
}

function linkedinJobTarget(url: URL): LinkedInJobTarget | null {
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!isLinkedInHostname(hostname)) return null;

  const pathname = url.pathname.toLowerCase();
  const directMatch = pathname.match(/\/jobs\/view\/(?:[^/?]*-)?(\d{6,20})(?:\/|$)/);
  const directJobId = validatedLinkedInJobId(directMatch?.[1] ?? null);
  if (directJobId) {
    return {
      jobId: directJobId,
      source: "direct",
      scrapeUrl: `https://www.linkedin.com/jobs/view/${directJobId}`,
    };
  }

  if (pathname.startsWith("/jobs/search")) {
    const currentJobId = validatedLinkedInJobId(url.searchParams.get("currentJobId"));
    if (!currentJobId) {
      throw new JobScrapeError(
        "This LinkedIn search URL does not contain a valid currentJobId. Open the specific job and copy its URL again.",
        "INVALID_LINKEDIN_JOB_ID",
      );
    }
    return {
      jobId: currentJobId,
      source: "search_results",
      scrapeUrl: `https://www.linkedin.com/jobs/view/${currentJobId}`,
    };
  }

  return null;
}

function responseMatchesLinkedInJob(page: ScrapedPageIdentity, jobId: string): boolean {
  const identitySources = [
    page.url,
    page.metadata.canonicalUrl,
    JSON.stringify(page.metadata.openGraph ?? {}),
    JSON.stringify(page.metadata.jsonLd ?? []),
  ].filter((value): value is string => Boolean(value));
  const escapedJobId = jobId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const jobIdPattern = new RegExp(`(^|\\D)${escapedJobId}(\\D|$)`);
  return identitySources.some((source) => jobIdPattern.test(source));
}

function validateExtractedJobText(
  text: string,
  partialResponse: boolean,
  verifiedLinkedInJob: boolean,
): void {
  const normalized = text.toLowerCase();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const searchResultSignals = [
    "job search results",
    "jobs found",
    "jobs matching",
    "search jobs",
    "create job alert",
  ].filter((signal) => normalized.includes(signal)).length;
  const descriptionSignals = [
    "responsibilities",
    "requirements",
    "qualifications",
    "about the role",
    "what you'll do",
    "what you will do",
    "preferred qualifications",
    "minimum qualifications",
    "must have",
    "required experience",
    "required skills",
    "we are looking for",
    "you will be responsible",
  ].filter((signal) => normalized.includes(signal)).length;

  if (!verifiedLinkedInJob && searchResultSignals >= 2) {
    throw new JobScrapeError(
      "This appears to be a job-search results page. Open the specific role and paste its direct job posting URL.",
      "DIRECT_JOB_URL_REQUIRED",
    );
  }
  if (wordCount < MINIMUM_JOB_WORDS || descriptionSignals === 0) {
    throw new JobScrapeError(
      "The page did not include a complete job description. Paste the direct URL for the specific role, with its responsibilities and requirements visible.",
      "INCOMPLETE_JOB_DESCRIPTION",
    );
  }
  if (partialResponse && wordCount < MINIMUM_JOB_WORDS * 2) {
    throw new JobScrapeError(
      "Only part of this job description could be read. Paste a direct, publicly accessible URL for the specific role.",
      "INCOMPLETE_JOB_DESCRIPTION",
    );
  }
}

export async function scrapeJobDescription(
  value: string,
  apiKey: string,
  requestId: string,
): Promise<string> {
  const startedAt = performance.now();
  let url: URL;
  let linkedInTarget: LinkedInJobTarget | null = null;
  try {
    url = validatePublicJobUrl(value);
    linkedInTarget = linkedinJobTarget(url);
    if (!linkedInTarget && isSearchResultsUrl(url)) {
      throw new JobScrapeError(
        "This is a job-search results URL. Open the specific role and paste its direct job posting URL.",
        "DIRECT_JOB_URL_REQUIRED",
      );
    }
    pipelineLog({
      requestId,
      stage: "context.validation",
      event: "job_url_validation",
      status: "succeeded",
      details: {
        protocol: url.protocol,
        urlType: linkedInTarget ? `linkedin_${linkedInTarget.source}` : "direct",
        linkedinJobId: linkedInTarget?.jobId ?? null,
      },
    });
  } catch (error) {
    pipelineLog({
      requestId,
      stage: "context.validation",
      event: "job_url_validation",
      status: "rejected",
      error,
    });
    throw error;
  }

  const client = new ContextDev({ apiKey, timeout: 70_000, maxRetries: 1 });

  try {
    pipelineLog({
      requestId,
      stage: "context.scrape",
      event: "job_scrape",
      status: "started",
      details: {
        urlType: linkedInTarget ? `linkedin_${linkedInTarget.source}` : "direct",
        linkedinJobId: linkedInTarget?.jobId ?? null,
      },
    });
    const page = await client.web.scrape({
      url: linkedInTarget?.scrapeUrl ?? url.toString(),
      formats: { markdown: true },
      markdownParams: { includeImages: false, includeLinks: false },
      sharedParams: {
        dismissCookies: true,
        dismissPopups: true,
        mainContentOnly: true,
      },
      timeoutOpts: { milliseconds: 60_000, behavior: "return-partial" },
    });

    if (!page.markdown.success || !page.markdown.data) {
      throw new JobScrapeError(
        linkedInTarget
          ? "LinkedIn did not return a readable description for this job ID. The posting may be expired, private, or require authentication."
          : "Context.dev could not extract readable content from this job posting.",
        linkedInTarget ? "LINKEDIN_JOB_SCRAPE_FAILED" : "JOB_SCRAPE_FAILED",
      );
    }

    if (linkedInTarget && !responseMatchesLinkedInJob(page, linkedInTarget.jobId)) {
      pipelineLog({
        requestId,
        stage: "context.linkedin_identity",
        event: "linkedin_job_identity_check",
        status: "rejected",
        details: {
          linkedinJobId: linkedInTarget.jobId,
          source: linkedInTarget.source,
          hasCanonicalUrl: Boolean(page.metadata.canonicalUrl),
          hasStructuredData: Boolean(page.metadata.jsonLd?.length),
        },
      });
      throw new JobScrapeError(
        "LinkedIn returned content for a different or unidentified job. Open job ID " +
          `${linkedInTarget.jobId} directly and try again.`,
        "LINKEDIN_JOB_MISMATCH",
      );
    }
    if (linkedInTarget) {
      pipelineLog({
        requestId,
        stage: "context.linkedin_identity",
        event: "linkedin_job_identity_check",
        status: "succeeded",
        details: { linkedinJobId: linkedInTarget.jobId, source: linkedInTarget.source },
      });
    }

    const text = page.markdown.data
      .replace(/\u0000/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, MAXIMUM_JOB_TEXT_LENGTH);

    const contentValidationStartedAt = performance.now();
    try {
      validateExtractedJobText(text, page.isPartial === true, Boolean(linkedInTarget));
    } catch (error) {
      pipelineLog({
        requestId,
        stage: "context.content_validation",
        event: "job_description_validation",
        status: "rejected",
        durationMs: Math.round(performance.now() - contentValidationStartedAt),
        details: {
          extractedCharacters: text.length,
          extractedWords: text.split(/\s+/).filter(Boolean).length,
          partialResponse: page.isPartial === true,
        },
        error,
      });
      throw error;
    }
    pipelineLog({
      requestId,
      stage: "context.content_validation",
      event: "job_description_validation",
      status: "succeeded",
      durationMs: Math.round(performance.now() - contentValidationStartedAt),
      details: {
        extractedCharacters: text.length,
        extractedWords: text.split(/\s+/).filter(Boolean).length,
        partialResponse: page.isPartial === true,
      },
    });

    pipelineLog({
      requestId,
      stage: "context.scrape",
      event: "job_scrape",
      status: "succeeded",
      durationMs: Math.round(performance.now() - startedAt),
      details: {
        extractedCharacters: text.length,
        partialResponse: page.isPartial === true,
        providerRequestId: page.request_id,
        linkedinJobId: linkedInTarget?.jobId ?? null,
      },
    });
    return text;
  } catch (error) {
    pipelineLog({
      requestId,
      stage: "context.scrape",
      event: "job_scrape",
      status: error instanceof JobScrapeError ? "rejected" : "failed",
      durationMs: Math.round(performance.now() - startedAt),
      error,
    });
    if (error instanceof JobScrapeError) throw error;
    throw new JobScrapeError(
      linkedInTarget
        ? "Context.dev could not access this LinkedIn job. It may be expired, private, rate-limited, or blocked by LinkedIn. Try the direct /jobs/view/ URL."
        : "Context.dev could not access the job posting. Confirm that the URL is public and still available.",
      linkedInTarget ? "LINKEDIN_JOB_SCRAPE_FAILED" : "JOB_SCRAPE_FAILED",
    );
  }
}

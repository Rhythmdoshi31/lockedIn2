import { isIP } from "node:net";

import ContextDev from "context.dev";

const MAXIMUM_JOB_TEXT_LENGTH = 60_000;

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

export async function scrapeJobDescription(value: string, apiKey: string): Promise<string> {
  const url = validatePublicJobUrl(value);
  const client = new ContextDev({ apiKey, timeout: 70_000, maxRetries: 1 });

  try {
    const page = await client.web.scrape({
      url: url.toString(),
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
        page.markdown.message ?? "The job posting could not be read.",
        "JOB_SCRAPE_FAILED",
      );
    }

    const text = page.markdown.data
      .replace(/\u0000/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, MAXIMUM_JOB_TEXT_LENGTH);

    if (text.length < 100) {
      throw new JobScrapeError("The job posting did not contain enough readable content.", "EMPTY_JOB_TEXT");
    }

    return text;
  } catch (error) {
    if (error instanceof JobScrapeError) throw error;
    throw new JobScrapeError(
      "The job posting could not be accessed. Check the URL and try again.",
      "JOB_SCRAPE_FAILED",
    );
  }
}

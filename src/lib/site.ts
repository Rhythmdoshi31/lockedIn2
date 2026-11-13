const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://locked-in2.vercel.app";

export const SITE_URL = new URL(configuredSiteUrl).origin;

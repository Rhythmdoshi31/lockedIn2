import type { Metadata } from "next";
import { AccountProvider } from "@/components/account-provider";
import { GlobalHeader } from "@/components/global-header";
import { SiteFooter } from "@/components/site-footer";
import { SITE_URL } from "@/lib/site";

import "./globals.css";

const title = "Locked In — AI Resume Analysis for Better Applications";
const description =
  "Compare your résumé with a job description to uncover evidence-backed strengths, gaps and practical improvements before you apply.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: title,
    template: "%s | Locked In",
  },
  description,
  alternates: { canonical: "/" },
  verification: { google: "googlecc823c841f692f67.html" },
  icons: {
    icon: [{ url: "/32x32.ico", sizes: "32x32", type: "image/x-icon" }],
    apple: [{ url: "/180x180.webp", sizes: "180x180", type: "image/webp" }],
    other: [{ rel: "icon", url: "/512x512.webp", sizes: "512x512", type: "image/webp" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "Locked In",
    type: "website",
    images: [{ url: "/1200x630.webp", width: 1200, height: 630, alt: "Locked In résumé analysis" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/1200x630.webp"],
  },
};

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "Locked In",
    url: SITE_URL,
    logo: `${SITE_URL}/512x512.webp`,
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#software-application`,
    name: "Locked In",
    url: SITE_URL,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description,
    publisher: { "@id": `${SITE_URL}/#organization` },
  },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        />
        <AccountProvider><GlobalHeader />{children}<SiteFooter /></AccountProvider>
      </body>
    </html>
  );
}

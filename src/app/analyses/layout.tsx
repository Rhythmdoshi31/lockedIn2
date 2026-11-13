import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Analyses",
  description: "Review your private Locked In résumé analysis history.",
  alternates: { canonical: "/analyses" },
  robots: { index: false, follow: false },
};

export default function AnalysesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}

import type { ReactNode } from "react";
import { PageChrome } from "@/components/page-chrome";

export function LegalPage({ eyebrow, title, intro, children }: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <PageChrome>
      <article className="content-panel legal-panel">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="legal-updated">Last updated 13 November 2026</p>
        <p className="page-intro">{intro}</p>
        <div className="legal-copy">{children}</div>
      </article>
    </PageChrome>
  );
}

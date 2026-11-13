"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="site-shell interior-shell">
      <section className="content-panel">
        <p className="eyebrow">Something went wrong</p>
        <h1>We couldn’t open this page.</h1>
        <p className="page-intro">Your account data has not been changed. Try the request again, or return to the home page.</p>
        <button className="primary-link" type="button" onClick={reset}>Try again</button>
        <Link className="auth-switch" href="/">Return home</Link>
      </section>
    </main>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthNav } from "@/components/auth-nav";
import { BackButton } from "@/components/back-button";

export function GlobalHeader() {
  const pathname = usePathname();
  return <header className="site-header global-header">
    <div className="header-leading">
      <Link className="wordmark" href="/" aria-label="LockedIn home"><span className="wordmark-mark" aria-hidden="true">L</span>LockedIn</Link>
      {pathname !== "/" && <BackButton />}
    </div>
    {pathname !== "/auth" && <AuthNav />}
  </header>;
}

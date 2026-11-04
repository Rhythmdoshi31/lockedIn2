"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthNav } from "@/components/auth-nav";

export function GlobalHeader() {
  const pathname = usePathname();
  return <header className="site-header global-header">
    <div>{pathname !== "/auth" && <AuthNav />}</div>
    <Link className="wordmark" href="/" aria-label="LockedIn home"><span className="wordmark-mark" aria-hidden="true">L</span>LockedIn</Link>
  </header>;
}

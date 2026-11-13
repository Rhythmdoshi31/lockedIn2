"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthNav } from "@/components/auth-nav";
import { BackButton } from "@/components/back-button";

export function GlobalHeader() {
  const pathname = usePathname();
  return <header className="site-header global-header">
    <div className="header-leading">
      <Link className="wordmark" href="/" aria-label="Locked In home"><Image className="wordmark-logo" src="/192x192.webp" alt="" width={32} height={32} priority />LockedIn</Link>
      {pathname !== "/" && <BackButton />}
    </div>
    {pathname !== "/auth" && <AuthNav />}
  </header>;
}

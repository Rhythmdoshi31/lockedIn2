import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { AuthNav } from "@/components/auth-nav";

export function PageChrome({ children, showNav = true }: { children: ReactNode; showNav?: boolean }) {
  return <main className="site-shell interior-shell">
    <svg className="geometric-line-art" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><pattern id="interior-grid" width="180" height="104" patternUnits="userSpaceOnUse"><path d="M0 52 90 0l90 52-90 52Z"/><path d="M90 0v104M0 52l90 52 90-52"/></pattern></defs><rect width="100%" height="100%" fill="url(#interior-grid)"/></svg>
    <div className="artwork" aria-hidden="true"><Image src="/grained-image-Photoroom.png" alt="" width={1264} height={843} priority /></div>
    <header className="site-header"><Link className="wordmark" href="/"><span className="wordmark-mark" aria-hidden="true">L</span>LockedIn</Link>{showNav && <AuthNav />}</header>
    {children}
  </main>;
}

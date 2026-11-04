"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface AccountSummary { authenticated: boolean; credits: number; premium: boolean; avatarUrl?: string | null; }

export function AuthNav() {
  const [account, setAccount] = useState<AccountSummary | null>(null);
  useEffect(() => { fetch("/api/account", { cache: "no-store" }).then((r) => r.json()).then(setAccount).catch(() => setAccount(null)); }, []);
  return (
    <nav className="account-nav" aria-label="Account">
      {account && !account.premium && <span className="credit-count">{account.credits} free {account.credits === 1 ? "analysis" : "analyses"} left</span>}
      {account?.authenticated ? <>
        <Link href="/analyses">My Analyses</Link>
        <Link className="profile-link" href="/profile" aria-label="Profile">
          {account.avatarUrl ? <img src={account.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <span aria-hidden="true">◯</span>}
        </Link>
      </> : <Link className="login-link" href="/auth">Log in</Link>}
    </nav>
  );
}

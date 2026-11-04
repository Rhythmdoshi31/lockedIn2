"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface AccountSummary { authenticated: boolean; credits: number; premium: boolean; avatarUrl?: string | null; }

export function AuthNav() {
  const [account, setAccount] = useState<AccountSummary | null>(null);
  useEffect(() => {
    const refresh = () => fetch("/api/account", { cache: "no-store" }).then((r) => r.json()).then(setAccount).catch(() => setAccount(null));
    refresh();
    window.addEventListener("lockedin:account-changed", refresh);
    return () => window.removeEventListener("lockedin:account-changed", refresh);
  }, []);
  return (
    <nav className="account-nav" aria-label="Account">
      {account && !account.premium && <span className="credit-count">{account.credits} free {account.credits === 1 ? "analysis" : "analyses"} left</span>}
      {account?.authenticated ? <>
        <Link className={account.premium ? "plan-button premium-status" : "plan-button"} href={account.premium ? "/profile" : "/pricing"}>{account.premium ? "Premium" : "Subscribe"}</Link>
        <Link className="nav-button" href="/analyses">My Analyses</Link>
        <Link className="nav-button profile-button" href="/profile">
          <span className="profile-avatar" aria-hidden="true">{account.avatarUrl ? <img src={account.avatarUrl} alt="" referrerPolicy="no-referrer" /> : "◯"}</span>
          Profile
        </Link>
      </> : <Link className="login-link" href="/auth">Log in</Link>}
    </nav>
  );
}

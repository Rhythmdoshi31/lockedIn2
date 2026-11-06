"use client";

import Link from "next/link";
import { useAccount } from "@/components/account-provider";
import { UserAvatar } from "@/components/user-avatar";

export function AuthNav() {
  const { account } = useAccount();
  return (
    <nav className="account-nav" aria-label="Account">
      {account && !account.premium && <span className="credit-count"><span className="credit-count-full">{account.authenticated ? `${account.dailyRemaining ?? 0}/3 free analyses left today` : `${account.credits} free ${account.credits === 1 ? "analysis" : "analyses"} left`}</span><span className="credit-count-compact">{account.authenticated ? `${account.dailyRemaining ?? 0}/3 free today` : `${account.credits}/3 free`}</span></span>}
      {account?.authenticated ? <>
        <Link className={account.premium ? "plan-button premium-status" : "plan-button"} href={account.premium ? "/profile" : "/pricing"}>{account.premium ? "Premium" : "Subscribe"}</Link>
        <Link className="nav-button" href="/analyses">My Analyses</Link>
        <Link className="nav-button profile-button" href="/profile">
          <span className="profile-avatar"><UserAvatar seed={account.userId || "lockedin"} src={account.avatarUrl} /></span>
          Profile
        </Link>
      </> : <Link className="login-link" href="/auth">Log in</Link>}
    </nav>
  );
}

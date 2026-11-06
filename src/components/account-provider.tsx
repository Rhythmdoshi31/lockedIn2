"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export interface AccountSummary {
  authenticated: boolean;
  credits: number;
  dailyRemaining?: number;
  paidCredits?: number;
  usageAvailable?: boolean;
  premium: boolean;
  userId?: string | null;
  avatarUrl?: string | null;
}

interface AccountContextValue {
  account: AccountSummary | null;
  refreshAccount: () => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const requestRef = useRef<Promise<AccountSummary> | null>(null);

  const refreshAccount = useCallback(async () => {
    if (!requestRef.current) {
      requestRef.current = fetch("/api/account", { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error("Account state could not be loaded.");
          return response.json() as Promise<AccountSummary>;
        })
        .finally(() => { requestRef.current = null; });
    }
    try { setAccount(await requestRef.current); } catch { /* Retain the last known account state. */ }
  }, []);

  useEffect(() => {
    refreshAccount();
    window.addEventListener("lockedin:account-changed", refreshAccount);
    return () => window.removeEventListener("lockedin:account-changed", refreshAccount);
  }, [refreshAccount]);

  return <AccountContext.Provider value={{ account, refreshAccount }}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) throw new Error("useAccount must be used inside AccountProvider.");
  return context;
}

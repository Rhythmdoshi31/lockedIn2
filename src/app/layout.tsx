import type { Metadata } from "next";
import { AccountProvider } from "@/components/account-provider";
import { GlobalHeader } from "@/components/global-header";

import "./globals.css";

export const metadata: Metadata = {
  title: "LockedIn — Stay locked in. Get hired.",
  description:
    "Find what is missing from your résumé before you apply and understand exactly where you stand.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body><AccountProvider><GlobalHeader />{children}</AccountProvider></body>
    </html>
  );
}

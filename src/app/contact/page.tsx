import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Contact",
  description: "Available support and self-service options for Locked In accounts, analyses and payments.",
  alternates: { canonical: "/contact" },
  openGraph: { title: "Contact Locked In", description: "Available support and self-service options for Locked In accounts, analyses and payments.", url: "/contact", type: "website", siteName: "Locked In", images: [{ url: "/1200x630.webp", width: 1200, height: 630 }] },
};

export default function ContactPage() {
  return <LegalPage eyebrow="Support" title="Contact" intro="Use the account tools below for the fastest available resolution. A public support inbox has not yet been configured.">
    <section><h2>Account and privacy</h2><p>Use <Link href="/profile">Profile</Link> to update account information, change a password, manage optional email preferences, remove a profile picture or request account deletion.</p></section>
    <section><h2>Saved reports and résumés</h2><p>Signed-in users can review or delete reports from <Link href="/analyses">My Analyses</Link>. Saved résumé access remains private to the account.</p></section>
    <section><h2>Subscriptions and payments</h2><p>Profile shows available subscription and receipt information and provides cancellation for an active Premium subscription. Keep the provider receipt and payment reference when reporting a payment problem.</p></section>
    <section><h2>Direct support</h2><p>A direct support address or ticket channel must be configured before public launch. Until then, do not send personal documents, passwords or payment details to unofficial accounts claiming to represent Locked In.</p></section>
  </LegalPage>;
}

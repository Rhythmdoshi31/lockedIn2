import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "Information about Locked In payment, cancellation and refund handling.",
  alternates: { canonical: "/refund-policy" },
  openGraph: { title: "Locked In Refund Policy", description: "Information about Locked In payment, cancellation and refund handling.", url: "/refund-policy", type: "website", siteName: "Locked In", images: [{ url: "/1200x630.webp", width: 1200, height: 630 }] },
};

export default function RefundPolicyPage() {
  return <LegalPage eyebrow="Payments and cancellations" title="Refund Policy" intro="Locked In sells one-time analysis credits and a recurring Premium subscription through Dodo Payments.">
    <section><h2>Before purchasing</h2><p>Review the plan, price and credit allocation shown at checkout before completing payment. The payment provider displays the final billing currency and available payment methods.</p></section>
    <section><h2>Subscription cancellation</h2><p>Premium can be cancelled from Profile. Cancellation is scheduled for the end of the current entitlement period rather than removing paid access immediately. Credits already granted to the account remain available.</p></section>
    <section><h2>Refund requests</h2><p>Locked In does not currently provide an automatic refund button. Eligibility depends on the transaction status, whether digital credits or analyses have been used, applicable law and the payment provider’s processing rules. A cancellation does not by itself reverse a completed payment.</p></section>
    <section><h2>Payment problems</h2><p>If a payment appears incorrect, retain the receipt and payment reference, then review the available options on the <Link href="/contact">Contact page</Link>. Never share full payment-card details or authentication credentials.</p></section>
  </LegalPage>;
}

import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Locked In handles account information, résumés, job descriptions, reports and payment records.",
  alternates: { canonical: "/privacy" },
  openGraph: { title: "Locked In Privacy Policy", description: "How Locked In handles account information, résumés, job descriptions, reports and payment records.", url: "/privacy", type: "website", siteName: "Locked In", images: [{ url: "/1200x630.webp", width: 1200, height: 630 }] },
};

export default function PrivacyPage() {
  return <LegalPage eyebrow="Your information" title="Privacy Policy" intro="This policy describes the information Locked In processes to compare a résumé with a job description and provide account, report and billing features.">
    <section><h2>Information you provide</h2><p>Locked In processes the résumé files and job-posting URLs you submit. If you create an account, it also stores your email address, optional name and profile picture, saved résumés, analysis reports, notification preferences and account settings.</p></section>
    <section><h2>How information is used</h2><p>Your résumé and the extracted job description are used to produce the requested analysis. Account information is used to authenticate you, save private reports and résumés, enforce usage limits, deliver essential account messages and maintain your preferences.</p></section>
    <section><h2>Service providers</h2><p>Locked In uses Supabase for authentication, database records and private file storage; Gemini for structured résumé analysis; Context.dev to retrieve public job descriptions; and Dodo Payments for checkout, payment and subscription processing. Payment-card details are handled by the payment provider and are not stored by Locked In.</p></section>
    <section><h2>Local and technical data</h2><p>The browser can retain a selected résumé in IndexedDB and lightweight form state in local storage. Authentication and anonymous usage controls use cookies. Server logs record request identifiers, stages, durations, error categories and technical metadata, but are designed not to record résumé text or API credentials.</p></section>
    <section><h2>Access and deletion</h2><p>Signed-in users can review their saved analyses and account information from Profile. Account deletion removes the account’s application records and stored files after active subscriptions and remaining purchased credits have been resolved. Some operational records may be retained where necessary for security, payment reconciliation or legal obligations.</p></section>
    <section><h2>Security</h2><p>Saved résumés and reports are private to the authenticated account. Access is enforced through server-side authentication and Supabase Row Level Security. No internet service can guarantee absolute security, so avoid uploading information that is not needed for the analysis.</p></section>
    <section><h2>Questions</h2><p>Use the Contact page for the currently available support and self-service options. Do not send passwords, full payment-card details or unnecessary résumé contents in a support request.</p></section>
  </LegalPage>;
}

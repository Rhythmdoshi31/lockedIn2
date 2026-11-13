import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing use of Locked In résumé analysis, accounts, credits and subscriptions.",
  alternates: { canonical: "/terms" },
  openGraph: { title: "Locked In Terms of Service", description: "Terms governing use of Locked In résumé analysis, accounts, credits and subscriptions.", url: "/terms", type: "website", siteName: "Locked In", images: [{ url: "/1200x630.webp", width: 1200, height: 630 }] },
};

export default function TermsPage() {
  return <LegalPage eyebrow="Using Locked In" title="Terms of Service" intro="These terms explain the conditions for using Locked In’s résumé comparison, report, account and payment features.">
    <section><h2>The service</h2><p>Locked In compares résumé evidence with information available in a supplied job posting and produces automated feedback. It is an application-support tool, not a recruiter, employer, legal adviser or guarantee of an interview or employment outcome.</p></section>
    <section><h2>Your responsibilities</h2><p>You must have the right to upload the documents and URLs you submit. Do not upload another person’s private information without permission, attempt to access another user’s account, evade usage limits, disrupt the service or use generated suggestions to misrepresent skills or experience you do not have.</p></section>
    <section><h2>Accounts and security</h2><p>You are responsible for protecting your login credentials and for activity through your account. Email verification may be required before account benefits are available. Notify support through the Contact page if you believe your account has been compromised.</p></section>
    <section><h2>Analyses and generated content</h2><p>Automated results can be incomplete or inaccurate and should be reviewed before use. Job postings and résumés can omit context. You remain responsible for every application and for ensuring that statements submitted to an employer are truthful.</p></section>
    <section><h2>Plans and credits</h2><p>Current prices and allocations appear on the Pricing page. Starter is a one-time credit purchase and Premium is a recurring subscription. Purchased credits are recorded to the account and currently do not expire. Subscription cancellation is scheduled for the end of the current entitlement period; previously granted credits remain available.</p></section>
    <section><h2>Availability and changes</h2><p>The service can occasionally be unavailable because of maintenance, provider failures or events outside Locked In’s control. Features and these terms may be updated as the product changes. Material terms should be reviewed before making a purchase.</p></section>
    <section><h2>Ending use</h2><p>You may stop using the service at any time. Account deletion is available from Profile after active subscriptions and remaining paid credits have been resolved.</p></section>
  </LegalPage>;
}

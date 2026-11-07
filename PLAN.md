LockedIn — Development Plan

Phase 1: Project Setup

* [x] Initialize Next.js with TypeScript and Tailwind.
* [x] Install Motion and required dependencies.
* [x] Configure environment file handling.
* [x] Establish project structure.

Phase 2: Frontend

* [x] Build landing page.
* [x] Implement resume upload UI.
* [x] Implement job URL input.
* [x] Add responsive layouts and Motion transitions.
* [x] Build analysis results layout using mock data initially.

Phase 3: Resume Processing

* [x] Implement IndexedDB persistence.
* [x] Restore uploaded resume after refresh.
* [x] Support replacing and removing resumes.
* [x] Extract PDF and DOCX text.
* [x] Validate file type and extracted content.

Phase 4: Job Scraping

* [x] Integrate Context.dev.
* [x] Fetch job posting content from the supplied URL.
* [x] Clean and normalize extracted content.
* [x] Handle scraping errors.
* [x] Reject search-results URLs and incomplete job descriptions.
* [x] Resolve and verify LinkedIn `currentJobId` and `/jobs/view/{id}` URLs.

Phase 5: AI Analysis

* [x] Integrate Gemini using `@google/genai`.
* [x] Extract structured resume information.
* [x] Extract job requirements.
* [x] Compare skills and experience.
* [x] Calculate score using a documented rubric.
* [x] Validate structured AI responses.
* [x] Use configurable Gemini primary and fallback models.
* [x] Retry transient Gemini failures with bounded exponential backoff.
* [x] Extract and validate job requirements before résumé comparison.
* [x] Ground every prioritized gap in job and résumé evidence.
* [x] Use a Gemini-compatible generation schema while retaining full Zod validation.

Phase 6: Results

* [x] Connect backend analysis to frontend.
* [x] Display score, matching skills, gaps and recommendations.
* [x] Add loading, error and empty states.
* [x] Ensure responsive results layout.
* [x] Prioritize missing requirements and actionable improvements in results.
* [x] Refine the responsive editorial hero, controls and isometric background.
* [x] Add evidence-led strengths, enhancement studio, keyword guidance and action planning.

Phase 7: Final Verification

* [x] Reject and remove malformed resumes restored from IndexedDB.
* [x] Add privacy-safe structured logging across the analysis pipeline.
* [x] Verify `pdf-parse` API compatibility and use a documented `Buffer` input.
* Test PDF and DOCX uploads.
* Test persistence after refresh.
* Test valid and invalid job URLs.
* Test API failure scenarios.
* [x] Run lint and production build.
* [x] Fix issues and review final implementation.
* [x] Confirm provider keys remain server-only and local environment files are ignored.

Phase 8: Accounts, Persistence and Billing

* [x] Add Supabase SSR authentication with Google and email/password flows.
* [x] Add anonymous and registered usage limits with post-success credit deduction.
* [x] Add private résumé storage, stored résumé selection and ownership policies.
* [x] Persist complete analyses, job metadata and résumé associations.
* [x] Add My Analyses, report reopening/deletion and profile pages.
* [x] Replace text export with authenticated PDF and Word exports.
* [x] Add Starter and Premium pricing with Dodo Checkout Sessions.
* [x] Verify and idempotently process Dodo webhooks through a credit ledger.
* [x] Add subscription history, cancellation and non-expiring credit balances.
* [x] Add database migrations, RLS and private storage policies.
* [x] Run the production build and fix implementation errors.

Deployment follow-up

* Apply `supabase/migrations/202611040001_accounts_billing.sql` to the configured Supabase project.
* Create the Starter and Premium products in Dodo test mode and set their separate product IDs.
* Register the deployed `/api/webhooks/dodo` URL in Dodo and subscribe to payment and subscription events.
* Configure Supabase Auth site/redirect URLs and enable the Google provider.

Production analysis reliability

* [x] Record Gemini candidate count, finish reason, response length and token usage without logging user content.
* [x] Retry and fall back when Gemini truncates or returns invalid structured output.
* [x] Use operation-specific output budgets for the larger comparison and enhancement schemas.
* [x] Configure the documented `pdf-parse` server CanvasFactory for Vercel compatibility.
* [x] Verify PDF.js code is absent from browser bundles and run the production build.

Account experience refinement

* [x] Move authentication to the left-side editorial panel and fit desktop viewports.
* [x] Add consistent Back, account, analyses, profile and subscription navigation actions.
* [x] Refresh authoritative credit counts immediately after successful analyses.
* [x] Add privacy-safe indeterminate analysis-stage feedback.
* [x] Tighten analysis history, profile, subscription and payment layouts.
* [x] Improve pricing hierarchy and desktop/mobile viewport behavior.

Persistent navigation and report polish

* [x] Hoist account state and navigation into the persistent root layout.
* [x] Deduplicate account refreshes and retain data between App Router navigations.
* [x] Move page-level Back actions into interior content and right-align branding.
* [x] Add deterministic generated avatars for accounts without profile images.
* [x] Add branded PDF and Word headers, metadata, typography and footers.
* [x] Promote PDF and Word downloads with explicit file-action styling.
* [x] Add matching and missing skill disclosures with responsive detail views.
* [x] Replace the generic résumé mark with an editorial document icon.

Email verification experience

* [x] Replace the signup form with a dedicated confirmation state when verification is required.
* [x] Add resend feedback and a client-side cooldown.
* [x] Route verified users back to a clear login success state.
* [x] Defer signup credits until email confirmation while preserving confirmation-disabled and OAuth flows.

Daily registered allowance

* [x] Replace registered lifetime free credits with three UTC-daily analyses.
* [x] Keep anonymous lifetime usage and purchased balances independent.
* [x] Consume daily or paid usage atomically only after successful analysis.
* [x] Refresh and display the authoritative daily remainder after analysis.

Account settings

* [x] Add editable personal details and private validated avatar storage.
* [x] Add authenticated password changes and logout.
* [x] Persist optional email preferences while keeping essential messages enabled.
* [x] Add guarded account deletion with subscription, paid-credit and reauthentication checks.
* [x] Consolidate account controls into the existing Profile page.
* [x] Remove the separate settings page and default-résumé feature without deleting stored résumés.
* [x] Refine the Profile Information and Current Plan cards with compact, responsive account controls and usage hierarchy.

Authentication reliability

* [x] Keep authenticated navbar identity authoritative when optional profile enrichment is unavailable.
* [x] Prevent account-summary responses from being cached across users or sessions.

Working Rules

* Complete one phase at a time.
* Avoid unnecessary dependencies and abstractions.
* Do not rewrite working features without a reason.
* Update this plan as phases are completed.

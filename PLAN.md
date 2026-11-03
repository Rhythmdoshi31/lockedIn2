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

Phase 5: AI Analysis

* [x] Integrate Gemini using `@google/genai`.
* [x] Extract structured resume information.
* [x] Extract job requirements.
* [x] Compare skills and experience.
* [x] Calculate score using a documented rubric.
* [x] Validate structured AI responses.

Phase 6: Results

* [x] Connect backend analysis to frontend.
* [x] Display score, matching skills, gaps and recommendations.
* [x] Add loading, error and empty states.
* [x] Ensure responsive results layout.

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

Working Rules

* Complete one phase at a time.
* Avoid unnecessary dependencies and abstractions.
* Do not rewrite working features without a reason.
* Update this plan as phases are completed.

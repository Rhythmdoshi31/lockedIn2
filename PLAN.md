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

* Implement IndexedDB persistence.
* Restore uploaded resume after refresh.
* Support replacing and removing resumes.
* Extract PDF and DOCX text.
* Validate file type and extracted content.

Phase 4: Job Scraping

* Integrate Context.dev.
* Fetch job posting content from the supplied URL.
* Clean and normalize extracted content.
* Handle scraping errors.

Phase 5: AI Analysis

* Integrate selected LLM provider.
* Extract structured resume information.
* Extract job requirements.
* Compare skills and experience.
* Calculate score using a documented rubric.
* Validate structured AI responses.

Phase 6: Results

* Connect backend analysis to frontend.
* Display score, matching skills, gaps and recommendations.
* Add loading, error and empty states.
* Ensure responsive results layout.

Phase 7: Final Verification

* Test PDF and DOCX uploads.
* Test persistence after refresh.
* Test valid and invalid job URLs.
* Test API failure scenarios.
* Run lint and production build.
* Fix issues and review final implementation.

Working Rules

* Complete one phase at a time.
* Avoid unnecessary dependencies and abstractions.
* Do not rewrite working features without a reason.
* Update this plan as phases are completed.

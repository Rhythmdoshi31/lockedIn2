LockedIn — Technology Stack

Frontend

* Next.js (App Router)
* React
* TypeScript
* Tailwind CSS
* Motion for animations

Backend

* Next.js Route Handlers
* TypeScript

Resume Processing

* pdf-parse — PDF text extraction.
* mammoth — DOCX text extraction.

Job Description Extraction

* Context.dev API — scrape job posting URLs.

AI Analysis

* LLM provider: Gemini via `@google/genai`.
* Primary model: `gemini-3.5-flash-lite`, with configurable supported fallback models.
* Retry transient Gemini 429/503 responses with bounded exponential backoff.
* Structured JSON output for predictable analysis.
* Server-side API integration.

Local Storage

* IndexedDB — resume file persistence.
* localStorage — job URL and lightweight metadata.

Development Tools

* ESLint
* Git
* npm

Architecture Principles

* Keep the application as a single Next.js project.
* No separate backend service.
* No database for the MVP.
* Keep AI provider integration modular.
* Validate all external and AI-generated data.
* Keep implementation simple and maintainable.

Scoring Rubric

* Skills match — 45 points.
* Relevant experience — 30 points.
* Education and certifications — 10 points.
* Overall role alignment — 15 points.
* Gemini evaluates each category from résumé and job-posting evidence; the server calculates the final score from the validated category scores.

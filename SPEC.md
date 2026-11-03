LockedIn — Product Specification

Overview

LockedIn is a web application that compares a user’s resume against a job description and provides actionable feedback to improve their job application.

Core User Flow

1. User opens the landing page.
2. User uploads a resume (PDF or DOCX).
3. User enters a job posting URL.
4. User clicks Continue.
5. The interface smoothly transitions into a two-column analysis view.
6. The user sees the analysis results on the right while inputs remain accessible on the left.

Frontend Requirements

* Clean, modern, responsive UI.
* Resume upload supporting PDF and DOCX.
* Display uploaded filename with options to replace or remove it.
* Persist resume locally between refreshes.
* Job URL input.
* Smooth layout transitions using Motion.
* Desktop: inputs on the left, results on the right.
* Mobile: vertically stacked layout with normal page scrolling.
* Results panel should scroll independently on desktop when necessary.

Analysis Requirements

The backend should:

1. Extract text from the uploaded resume.
2. Scrape the job posting using Context.dev.
3. Clean and normalize the scraped content.
4. Use an LLM to extract structured resume information and job requirements.
5. Compare the two using a consistent scoring rubric.
6. Return structured results.

Scoring Rubric

* Skills match: 45%.
* Relevant experience and demonstrated outcomes: 30%.
* Education and certifications when required by the role: 10%.
* Overall responsibility, seniority and role alignment: 15%.

The server calculates the overall score from validated category scores. Missing evidence must not be treated as proof that a user possesses a skill.

Results

Display:

* Overall match score.
* Matching skills.
* Missing or unverified skills.
* Relevant experience and strengths.
* Gaps compared with job requirements.
* Recommendations to improve the resume.
* Section-by-section feedback where possible.

Do not recommend adding skills or experience the user does not actually possess.

Persistence

* Use IndexedDB for storing the resume file locally.
* Use localStorage for small metadata such as filename and job URL.
* No database or user authentication in the MVP.

Error Handling

Handle:

* Unsupported or oversized files.
* Empty or unreadable resume text.
* Scanned PDFs without extractable text.
* Invalid or inaccessible job URLs.
* Scraping failures.
* LLM failures or invalid responses.

Security

* Keep API keys on the server.
* Never expose secrets to the browser.
* Do not permanently store uploaded resumes on the server.
* Treat scraped job content as untrusted input.
* Validate LLM responses before returning results.

Out of Scope

* Authentication.
* User accounts.
* Payment/subscriptions.
* Saved analysis history.
* Database.
* Vector databases or RAG.
* Microservices.

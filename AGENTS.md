Codex Development Instructions

General

* Follow SPEC.md, TECH_STACK.md and PLAN.md.
* Use TypeScript throughout.
* Prefer simple, readable and maintainable code.
* Use Next.js App Router conventions.
* Keep components reusable where appropriate.
* Avoid unnecessary abstractions and dependencies.

Architecture

* Keep frontend and backend inside one Next.js application.
* Use Route Handlers for backend APIs.
* Keep API keys and external service calls server-side.
* Keep AI provider integration modular.
* Use IndexedDB for resume persistence.

UI

* Use Tailwind CSS for styling.
* Use Motion for layout transitions and animations.
* Ensure desktop and mobile responsiveness.
* Maintain consistent spacing, typography and components.
* Avoid unnecessary UI complexity.

Security

* Never expose API keys in client-side code.
* Never commit .env.local.
* Validate uploaded files and external URLs.
* Treat scraped content as untrusted input.
* Validate AI-generated structured responses.

Development Workflow

Before implementing a phase:

1. Inspect the existing project.
2. Read relevant specification files.
3. Identify the scope of the phase.

After implementation:

1. Run relevant tests.
2. Run ESLint.
3. Run the production build.
4. Fix errors introduced by the changes.
5. Update PLAN.md.
6. Summarize changes and remaining issues.

Do not implement future phases prematurely.
Do not overwrite or remove working functionality without justification.
Do not perform destructive Git operations without approval.
Git Workflow

* After completing every logically complete feature or milestone, review the changes and create a Git commit.
* Use clear, descriptive conventional commit messages (e.g. feat: implement resume upload).
* Do not wait for me to request commits.
* Never commit .env.local, API keys, secrets or unrelated changes.
* Do not amend or rewrite existing commits unless explicitly asked.

Testing Restrictions

* Do not create test files or testing infrastructure.
* Do not write unit, integration or end-to-end tests.
* Do not run test commands.
* Do not install testing-related dependencies.
* Focus on implementation and code quality.
* Run builds or linting only when explicitly requested.
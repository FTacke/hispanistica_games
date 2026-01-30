# Refactoring Phase 3-prep

## Scope
- Build a read-only baseline of the production-like release/import pipeline.
- Capture server-side environment keys (names only, values redacted).
- Collect read-only DB facts relevant to quiz content and releases.
- Document current release, import, and publish flow.

## Out of Scope
- No deploys, no configuration changes, no data mutations.
- No secrets or credentials in output.
- No schema changes or migrations.

## Required Server Data
- Environment variable keys relevant to content/import/release paths (values redacted).
- File system paths:
  - Release storage
  - Media/current symlink or equivalent
  - Content import locations
- Commands/services used for rsync, import, publish.
- Database counts (read-only) for:
  - `quiz_topics`, `quiz_questions`, `quiz_content_releases`, `quiz_runs`, `quiz_scores`
- Active release id (if available).
- Recent import error log snippets (no sensitive data).
- File permissions on release/media directories (stat/ls; no writes unless explicitly allowed).

## Validation
- Cross-check that release paths match app configuration.
- Ensure output is written to `docs/quiz/refactoring/quiz_refactoring_server.md`.
- Confirm all outputs redact secrets and user data.

## Output
- A single report: `docs/quiz/refactoring/quiz_refactoring_server.md`.
- Clear sections with command + excerpted output.

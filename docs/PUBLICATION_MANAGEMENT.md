# Publication Management — Milestone 4

## What "unlimited publications" actually means here

There is no cap anywhere in the schema, the API routes, or the UI — not
a high limit, an absent one. This was verified directly rather than
inferred from the absence of a `LIMIT`/quota check: a test run inserted
52 publications in a single transaction against the live schema with no
error (see the migration testing notes below). The only practical
ceiling is Postgres itself.

## The six settings areas, and where each one lives

| Area                        | Storage                                                                 | API                                                  | Notes                                                                                      |
| --------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Branding                    | `publications.branding` (jsonb)                                         | `PATCH /api/publications/:id/branding`               | Partial updates merge into the existing object                                             |
| Logo                        | Supabase Storage (`publication-logos` bucket) + `publications.logo_url` | `POST /api/publications/:id/logo`                    | 2MB cap, PNG/JPEG/SVG/WebP only, enforced both client-side and at the Storage bucket level |
| Editorial Guidelines        | `publications.editorial_guidelines` (text)                              | `PATCH /api/publications/:id/editorial-guidelines`   | Plain text; referenced by the AI Workspace (Milestone 5) when drafting                     |
| Publishing Schedule         | `publications.publishing_schedule` (jsonb)                              | `PATCH /api/publications/:id/schedule`               | Structured (frequency/days/time/timezone) — see below                                      |
| Email / PDF / Web Templates | `publication_templates` (Migration 003)                                 | `GET`/`PUT /api/publications/:id/templates/:channel` | One table, three rows per publication (one per channel), not three tables                  |
| AI Prompt Templates         | `prompt_templates.publication_id` (Migration 014)                       | `/api/publications/:id/ai-prompt-templates`          | Publication-scoped override of the platform-wide defaults from Milestone 5                 |

## Why publishing_schedule is a new column, not a replacement for cadence

`publications.cadence` (Migration 003) already existed as a free-text
label — "48-hour technology intelligence," "weekly." That's what readers
see. `publishing_schedule` (Migration 014) is new, structured, and
machine-readable — `{"frequency": "weekly", "days_of_week": ["tuesday"],
"time_of_day": "07:00", "timezone": "America/New_York"}` — and is what
the Milestone 10 scheduler will actually read to decide when to run a
publish job. Keeping both means changing the reader-facing label doesn't
require touching the scheduling logic, and vice versa.

Deliberately not enforced as a Postgres `CHECK` constraint or a second
enum type — the shape is validated once, at the application boundary
(`publishingScheduleSchema` in `src/lib/validation/publications.ts`), the
same trade-off already made for `theme` and `branding` in the original
schema design (see Database Schema Design doc, Section 6.2).

## AI Prompt Templates: publication-scoped, with a documented fallback

`prompt_templates.publication_id` is nullable. Null rows are the
platform-wide defaults from Milestone 5, still Super-Admin-managed.
Non-null rows are a specific publication's override for one `block_type`.

- A publication's own `editor_in_chief`/`editor` can manage that
  publication's overrides (new RLS policy,
  `prompt_templates_manage_publication_editor`) — verified live: an
  Editor-in-Chief of Publication A can create an override for Publication
  A; a Writer who is not a member of Publication A is rejected by RLS
  when attempting the same insert (not just denied in the UI).
- At most one _active_ override per `(publication_id, block_type)` — a
  partial unique index (`idx_prompt_templates_publication_block_type_
active`), verified live: a second active insert for the same block type
  on the same publication is rejected with a real constraint violation,
  surfaced by the API as a 409, not a 500.
- The actual fallback-to-default _resolution logic_ (given a
  `publication_id` and `block_type`, which template does the AI Workspace
  actually use) is Milestone 5 scope — this milestone establishes the
  data model and management UI the resolver will read from, not the
  resolver itself.

## A latent bug this milestone found

`is_platform_editorial()` (Migration 002) checked `role in (...,
'designer')`. Migration 013 (Milestone 2) recreated the `platform_role`
enum without `designer`, and correctly fixed the two functions that had
a _hard_ catalog dependency on the enum type
(`current_platform_role()`, `publication_role()`, both `RETURNS
platform_role`) — but `is_platform_editorial()` returns `boolean`, not
`platform_role`, so it has no such dependency, and nothing caught the
stale string literal at migration-apply time.

It surfaced the moment a query actually evaluated it: this milestone's
RLS tests for `prompt_templates` invoked
`prompt_templates_select_editorial`, which calls
`is_platform_editorial()`, which tried to cast the literal `'designer'`
to `platform_role` to perform the `in (...)` comparison — and that cast
fails because the label no longer exists in the type. Fixed in Migration
015 with the exact failing query preserved in that migration's comment,
and the full 15-migration chain re-verified from a clean database
afterward.

This is called out explicitly because it's a good example of why this
project runs every migration against a live Postgres instance instead of
only reading the SQL for correctness — a soft dependency like this one is
invisible to `CREATE TYPE`/`DROP TYPE` dependency checking and only shows
up when the affected code path actually runs.

## Testing

- **Migrations**: all 15 apply cleanly from a fresh database (extensions,
  roles, and Supabase's `auth`/`storage` schemas stubbed locally — see
  the schema design deliverable's testing notes for the stub approach).
- **RLS, live**: publication editor can create a scoped AI prompt
  template; non-member writer is rejected; duplicate active template for
  the same block type is rejected; 52 publications created with no cap.
- **Application**: 17 new tests (`src/__tests__/publications.test.ts`)
  covering every validation schema and the `canCreatePublicationRole`
  permission check — including catching and fixing two of my own test
  bugs where an assertion passed for an unintended reason (a 1-character
  `name` failing its own `min(2)` rule independently of the `slug`
  behavior the test claimed to isolate). Fixed by using a valid value for
  every field _except_ the one under test, in each case.
- **Full pipeline**: `typecheck` / `lint` / `test` / `build` all pass from
  a clean-slate `node_modules` reinstall, plus a live `npm start` sweep
  of every new route (protected pages redirect correctly, unauthenticated
  API calls return 401, nested dynamic routes like
  `/api/publications/:id/templates/:channel` resolve without crashing).

## What's deliberately not in this milestone

- **Rendering** the email/PDF/web templates into an actual sent email,
  generated PDF, or live web page — that's Milestone 10 (Publishing
  Pipeline). This milestone stores and validates the config; it doesn't
  consume it yet.
- **AI Prompt Template resolution logic** (publication override vs.
  platform default) — Milestone 5 (AI Workspace) scope, as noted above.
- **A visual template designer.** The Email/PDF/Web config editor is a
  validated raw-JSON textarea, not a WYSIWYG builder — appropriate for
  this milestone's scope (the data model and permissions), not a
  statement that raw JSON is the intended end-state UI.

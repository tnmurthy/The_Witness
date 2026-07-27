# The Witness

AI-Powered Knowledge Operating System. This repository is **Milestone 1: Project Foundation** from the Implementation Plan — the scaffold every later milestone builds on.

## What's in this milestone

- Next.js 15 (App Router) + React 19 + TypeScript (strict mode)
- Tailwind CSS + shadcn/ui, wired to The Witness's design tokens (navy/gold palette, editorial serif + UI sans type system, light/dark mode)
- Supabase configuration: browser client, server client, middleware session refresh, and the 12 SQL migrations from the Database Schema Design deliverable, arranged for the Supabase CLI
- Authentication scaffold: sign-in/sign-up pages and forms, protected `/dashboard` route group, session-aware middleware
- Shared layout: sidebar + top bar app shell, matching the Design System's Navigation and Dashboard Layout specs
- Error boundaries (both a reusable component-level `ErrorBoundary` and Next's file-based `error.tsx`/`not-found.tsx`)
- Structured JSON logging (`src/lib/logger.ts`)
- Environment variable validation (`src/lib/env.ts`, zod-based, fails fast with a clear message)
- CI: lint, typecheck, test, and build as separate GitHub Actions jobs

## Verified

This isn't a claim — it was actually run, in order, before this milestone was called done:

```
npm run typecheck   # tsc --noEmit — passes
npm run lint         # eslint . — passes
npm test             # vitest run — 6/6 tests passing
npm run build         # next build — succeeds, all 6 routes compile
npm start            # next start — verified live: health check, redirects,
                        and 404 handling all confirmed with real curl requests
```

Along the way this surfaced and fixed several real issues, not just typos:

- **A CVE in the initially-chosen Next.js version** (15.1.4) — bumped to 15.5.21 and re-audited.
- **`next/font/google` requires build-time network access to Google Fonts**, which isn't available in every build environment (this project's own sandboxed dev environment included). Switched to `@fontsource` packages, which ship the font files as npm package assets — `next build` now has zero external network dependency for fonts, which is also just a more robust choice for CI/offline builds generally.
- **`useSearchParams()` in the sign-in form** needed a `Suspense` boundary for Next.js to statically prerender the surrounding page — a real App Router requirement, not a style preference.
- Several TypeScript strict-mode errors (missing `override` modifiers, untyped Supabase cookie callbacks, a Tailwind config tuple-typing mismatch).
- **npm audit**: went from 21 vulnerabilities (1 critical) to 11 (all high-severity, all inside `eslint-config-next`'s own transitive dev-tooling dependency chain — not runtime-exposed, and not fully resolvable without jumping to Next.js 16, which is out of scope for this milestone). Documented here rather than hidden.

## Running locally

### 1. Install dependencies

```bash
npm install
```

### 2. Provisioning Supabase (one-time, manual)

This codebase cannot provision a live Supabase project for you — that's a real account/billing action outside what any codebase can automate. Two options:

**Option A — Supabase CLI, local Postgres (fastest for development):**

```bash
npx supabase start        # requires Docker; spins up local Postgres, Auth, Storage
npx supabase db reset     # applies all 12 migrations in supabase/migrations/
```

This prints a local `API URL` and `anon key` — use those in step 3.

**Option B — a real Supabase project (needed for staging/production):**

1. Create a project at [supabase.com](https://supabase.com).
2. `npx supabase link --project-ref <your-project-ref>`
3. `npx supabase db push` — applies all 12 migrations.
4. Copy the Project URL and `anon` `public` key from Project Settings → API.

### 3. Environment variables

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from step 2. Everything else in `.env.example` is optional for this milestone (AI provider keys are reserved for Milestone 5).

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll land on `/sign-in` (the root route redirects based on auth state). Sign up, confirm the email Supabase sends (or, for local dev via the CLI, check the Inbucket mail catcher at `http://localhost:54324`), then sign in to reach `/dashboard`.

### 5. Verify your own setup, same as this milestone was verified

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Project structure

```
src/
  app/
    (auth)/              sign-in, sign-up, forgot-password, reset-password
    (dashboard)/          protected routes — sidebar + topbar app shell
                           organizations/, admin/users/, settings/profile/
    api/
      health/              liveness endpoint
      organizations/       CRUD + invite
      admin/users/         list + role change (Super Admin only)
    auth/callback/         OAuth / magic-link / email-confirm / recovery code exchange
    layout.tsx             root layout: fonts, theme, toast provider
    error.tsx, not-found.tsx
  components/
    ui/                    shadcn/ui primitives (hand-authored — see note below)
    layout/                Sidebar, Topbar, AppShell, nav item definitions
    auth/                  sign-in/up, forgot/reset password, magic link, OAuth buttons, user menu
    organizations/          create + invite forms
    admin/                  users table with inline role change
    settings/               profile form
    providers/              ThemeProvider
    error/                  reusable ErrorBoundary
  lib/
    auth/                   roles.ts, permissions.ts (RBAC matrix), require-role.ts (route guard)
    supabase/               client.ts, server.ts, middleware.ts, admin.ts (service role)
    validation/             zod schemas: organizations, admin, profile
    env.ts                  zod-validated environment variables
    logger.ts               structured JSON logging
    utils.ts                shadcn's cn() helper
  styles/
    design-tokens.css        source of truth — colors, type, spacing, radii, shadows
    tailwind.tokens.ts       bridges design-tokens.css into Tailwind's theme.extend
  __tests__/                 Vitest unit + component tests (31 tests)
supabase/
  migrations/                 13 SQL migrations — 001–012 from the Database Schema Design
                               doc, 013 adds this milestone's finalized RBAC role set + audit triggers
  config.toml                  Supabase CLI configuration, incl. OAuth provider config
docs/
  AUTHENTICATION.md            all four auth methods, OAuth provider setup steps
  RBAC.md                      full role matrix, design rationale, audit logging
.github/workflows/ci.yml       lint / typecheck / test / build, as separate jobs
```

**Note on shadcn/ui components:** `npx shadcn add <component>` pulls from `ui.shadcn.com`, which wasn't reachable from this project's build sandbox. The components in `src/components/ui/` are hand-authored to match shadcn's standard output exactly (same Radix primitives, same `cva` variant patterns, same file shape) so `npx shadcn add <component>` will still work normally for any *new* component in a real development environment with full network access — it just won't try to overwrite the ones already here unless you pass `--overwrite`.

## Milestone 2: Authentication and User Management

Adds, on top of Milestone 1's scaffold:

- **Four sign-in methods**: email/password, magic link, password reset, and OAuth (Google, GitHub) — see `docs/AUTHENTICATION.md` for setup, including the OAuth provider configuration steps.
- **RBAC**: finalized 7-role `platform_role` set (Super Admin, Editor-in-Chief, Editor, Writer, Researcher, Subscriber, Premium Subscriber) plus Organization Admin, modeled as an organization-scoped role rather than a platform role — see `docs/RBAC.md` for the full matrix and the reasoning behind that split.
- **Audit logging**: automatic, trigger-based — every role change writes an `audit_logs` row without any application code having to remember to call a logging function.
- **Organizations**: create, list, view members, invite (invitation record only — outbound email delivery is Milestone 10 scope).
- **Admin: Users & Roles** screen (`/admin/users`, Super Admin only).
- **Profile settings** (`/settings/profile`).
- Extended protected-route coverage in `middleware.ts` (was `/dashboard` only; now also `/organizations`, `/admin`, `/settings`).

### Verified

Same bar as Milestone 1 — every claim below was actually run, not assumed:

```
npm run typecheck   # passes
npm run lint         # passes
npm test             # 31/31 tests passing (was 6 after Milestone 1)
npm run build         # succeeds — clean on the first attempt this time,
                        the Milestone 1 font/Suspense fixes carried forward
npm start            # verified live: OAuth buttons render, protected
                        routes (/organizations, /admin, /settings) correctly
                        redirect unauthenticated requests, /api/organizations
                        correctly returns 401 without a session
```

The database migration for this milestone (`013_rbac_and_audit.sql`) was the hard part, and was validated against a real PostgreSQL 16 instance, not just reviewed by eye. Postgres enums can't drop a value in place — recreating `platform_role` without `designer` surfaced a real catalog-dependency chain: two functions and eight RLS policies had hard dependencies on the old type that only showed up by actually running the migration and reading Postgres's own error messages, not by inspecting the SQL. All eight were identified via `pg_policies`/`pg_depend` queries (not guessed one error at a time) and correctly dropped and recreated. The audit triggers and the self-elevation guard were then exercised with real transactions: a `writer` attempting to set their own role to `super_admin` is genuinely rejected by RLS (not merely a UI restriction), while updating their own display name succeeds normally.

## What's deliberately not in this milestone

No domain content tables are wired to the UI yet (Publications, Issue Builder, etc. remain placeholders naming the milestone that fills them in). No outbound transactional email — organization invitations create a real `invitations` row but nothing sends the email yet (Milestone 10). No AI integration (Milestone 5). Publication-level role management (an Editor-in-Chief managing Editor/Writer/Researcher roles *within their own publication*) is data-model-ready (Migration 002's `publication_members` + RLS) but has no UI yet — that lands with Milestone 3/4.


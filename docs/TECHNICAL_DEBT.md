# Technical Debt Register — The Witness

Last updated: Sprint 4 (2026-08-04)

## P1 — Before v1.1

| ID     | Description                                                                    | Location                   | Impact | When             |
| ------ | ------------------------------------------------------------------------------ | -------------------------- | ------ | ---------------- |
| TD-001 | Articles reuses IssueBuilderShell via type cast — divergence hides type errors | articles/[id]/page.tsx     | Medium | v1.1             |
| TD-002 | @supabase/ssr type workaround suppresses upstream library error                | src/lib/supabase/server.ts | Low    | Upstream fix     |
| TD-003 | Embedding cron uses admin as any — embedding_jobs not in generated types       | cron/process-embeddings    | Low    | After type regen |
| TD-004 | No OpenAPI spec — 52 routes undocumented externally                            | All src/app/api routes     | Medium | v1.1             |
| TD-005 | style-src: unsafe-inline remains in CSP (Tailwind JIT)                         | middleware.ts              | Low    | v1.1             |

## P2 — Next planning cycle

| ID     | Description                                                                                                                          | Impact                 | When                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | ------------------------- |
| TD-006 | 4 block types (chart, technology_radar, book_recommendation, github_activity) have no email/public render — invisible to subscribers | Medium                 | v1.1                      |
| TD-007 | Two separate block-to-HTML implementations (email + web reader). Should be unified.                                                  | Medium                 | v1.1                      |
| TD-008 | Issues list page.tsx uses limit(50) server-side but API now has cursor pagination — frontend not wired                               | Low now, high at scale | v1.1                      |
| TD-009 | Graph retrieve route comment says embedding pipeline doesn't exist — now it does. Not updated.                                       | Low                    | After embeddings populate |
| TD-010 | No post-publish analytics (opens, clicks). Tables exist but event pipeline not wired.                                                | Medium                 | v1.1                      |

## P3 — Known, accepted

| ID     | Description                                                                   | When |
| ------ | ----------------------------------------------------------------------------- | ---- |
| TD-011 | No Vitest test isolation — module cache issues seen in sprint1-routes tests   | v2.0 |
| TD-012 | process.env read directly in lib files without centralized validation         | v1.1 |
| TD-013 | Article slugs use Date.now().toString(36) — non-human-readable                | v1.1 |
| TD-014 | E2E Issue Builder tests skip entirely if E2E_ISSUE_ID not set — needs fixture | v1.1 |
| TD-015 | Middleware on Node.js runtime not Edge — higher cold-start for CSP nonce      | v1.1 |

## Resolved

| ID      | Description                                              | Fixed         |
| ------- | -------------------------------------------------------- | ------------- |
| RES-001 | publications anon RLS — status=active with no auth check | Migration 021 |
| RES-002 | Unsubscribe crashed when NEXT_PUBLIC_SITE_URL unset      | Sprint 2      |
| RES-003 | RouteErrorFallback not exported from error-boundary      | Sprint 3      |
| RES-004 | wisdom_entries RLS test wrongly expected zero anon rows  | Sprint 1      |
| RES-005 | unsafe-eval/unsafe-inline in script-src CSP              | Sprint 2      |

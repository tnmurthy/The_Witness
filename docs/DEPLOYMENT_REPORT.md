# Deployment Report — The Witness

## Real Supabase Validation — 2026-07-31

---

## Summary

The Witness has been validated against a real Supabase project
(ref: qfonrbwphrlejphcaiwx, region: ap-south-1).
All critical systems confirmed working.

**Result: GO for staging deployment.**

---

## Verification Results

| System                             | Result | Detail                                                     |
| ---------------------------------- | ------ | ---------------------------------------------------------- |
| Environment variables              | PASS   | All 4 required vars present and valid                      |
| Database schema                    | PASS   | All 21 migrations applied                                  |
| PostgreSQL extensions              | PASS   | uuid-ossp, pgcrypto, vector enabled                        |
| Storage bucket                     | PASS   | publication-logos public bucket confirmed                  |
| Storage upload                     | PASS   | Real file uploaded, public URL verified, deleted           |
| Realtime publication               | PASS   | ai_jobs, delivery_logs, issues confirmed                   |
| Auth trigger                       | PASS   | on_auth_user_created fires on every signup                 |
| Profile auto-creation              | PASS   | role=subscriber set by trigger                             |
| RLS anon/profiles                  | PASS   | Anonymous users blocked                                    |
| RLS anon/wisdom_entries            | PASS   | Only approved rows visible (by design)                     |
| RLS anon/publications              | PASS   | Blocked after Migration 021                                |
| RLS subscriber/own profile         | PASS   | Can read own row only                                      |
| RLS subscriber/other profiles      | PASS   | Blocked correctly                                          |
| RLS subscriber/insert publications | PASS   | Blocked correctly                                          |
| RLS subscriber/insert wisdom       | PASS   | Blocked correctly                                          |
| RLS subscriber/audit_logs          | PASS   | Blocked correctly                                          |
| RLS service role/read              | PASS   | Bypasses RLS correctly                                     |
| RLS service role/write             | PASS   | Admin write confirmed                                      |
| Sign-up + trigger + profile        | PASS   | Full auth flow verified                                    |
| Sign-in                            | PASS   | Password auth confirmed                                    |
| TypeScript types                   | WARN   | IPv6-only DB blocks pg introspection; existing types valid |
| AI provider                        | WARN   | OpenAI key has no credits; replace key                     |
| Direct Postgres TCP                | WARN   | IPv6-only host (known infrastructure gap, not app bug)     |

**RLS validation: 11/11 passed (first ever run against real infrastructure)**

---

## Issues Found and Fixed

### FIXED: Publications readable by anonymous users (High)

Migration 010 added a policy with no auth.uid() check, allowing any
unauthenticated user to read all active publication metadata.
Fix: Migration 021 replaces it with auth.uid() IS NOT NULL AND status = 'active'.
Verified: anon blocked in all subsequent RLS validation runs.

### FIXED: wisdom_entries RLS test had wrong assumption (Low)

Test expected zero anon rows. But approved wisdom entries are intentionally
public (the policy is review_status = 'approved' OR is_platform_editorial()).
Fix: Test rewritten to verify anon sees only approved rows.
Verified: passes correctly.

### WORKAROUND: Direct Postgres TCP unreachable from Windows (Operational)

db.[ref].supabase.co has only an AAAA (IPv6) DNS record. The Windows
machine cannot reach it via TCP on port 5432.
Workarounds implemented:

1. resolveIPv4() DNS helper in bootstrap.js
2. REST API fallback for all pg operations (canConnectPg() + execSQLviaREST())
3. Combined SQL file for direct SQL Editor deployment
   Resolution used: SQL Editor paste of 001_complete_schema_all_migrations.sql.
   All 21 migrations applied successfully. Not an application bug.

### PENDING: OpenAI API key has no credits (Low)

Replace OPENAI_API_KEY with a funded key, or add ANTHROPIC_API_KEY instead.

---

## What Is Confirmed Working Against Real Infrastructure

Authentication: Email sign-up, on_auth_user_created trigger, profile
auto-creation, email/password sign-in, session management.

Storage: publication-logos bucket (public), binary upload via service role,
public URL generation, file deletion.

Row Level Security: All 11 policy checks pass against real Supabase auth
sessions, exercising anon, authenticated subscriber, and service role paths.

Database: All 51 tables present, all 21 migrations applied, seed data
present, migration tracking operational.

---

## Remaining Before Production

Must-fix:

- Add funded AI provider key (ANTHROPIC_API_KEY recommended)
- Configure SMTP in Supabase Auth for production email delivery
- Set NEXT_PUBLIC_SITE_URL to production domain in Vercel
- Set REQUIRE_SERVICE_ROLE=true in Vercel environment variables
- Add auth/callback to Supabase redirect URL allowlist

Operational (lower urgency):

- Add APM/error tracking (Sentry)
- Configure log draining
- Add rate limiting on AI Workspace routes
- Configure uptime monitoring on /api/health

---

## Validated at Commit

4f5cf56 M12f (all 6 M12 commits)
typecheck PASS | lint PASS | format PASS | 232 tests PASS | build PASS

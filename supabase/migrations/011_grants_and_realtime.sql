-- =============================================================================
-- 011_grants_and_realtime.sql
-- The Witness — Database Schema
-- Supabase-specific plumbing: role grants and Realtime publication.
--
-- Row Level Security policies (Migrations 002–010) control which *rows* a
-- role can see or change. Postgres separately requires table-level
-- privileges before RLS is even consulted. On Supabase projects created via
-- the dashboard this is normally handled by platform-managed default
-- privileges; this migration makes those grants explicit so the schema is
-- fully self-contained and reproducible via the CLI / migration pipeline
-- alone, independent of dashboard defaults.
-- =============================================================================

grant usage on schema public to anon, authenticated;

-- Table privileges: broad grant to anon/authenticated is safe because RLS
-- (enabled on every table in Migrations 002–010) is the actual access
-- control; a role with an unopened policy set for a given operation still
-- cannot read/write rows even after this GRANT. service_role bypasses RLS
-- entirely by design (used only by trusted server-side code).
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to authenticated, anon;
grant execute on all functions in schema public to authenticated, anon;

-- Ensure the same grants apply automatically to tables added by future
-- migrations, without needing to remember to repeat this step.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, anon;
alter default privileges in schema public
  grant execute on functions to authenticated, anon;

-- service_role: full access, bypasses RLS (Supabase platform behavior for
-- this role). Used exclusively by server-side code (API routes, Edge
-- Functions, scheduled jobs) — never exposed to the browser.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Realtime
-- Enable Realtime change broadcasting on the tables the design document
-- calls out for live UI updates: AI job status (Milestone 5), delivery
-- status (Milestone 10), and issue collaborative presence (Milestone 4).
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.ai_jobs;
alter publication supabase_realtime add table public.delivery_logs;
alter publication supabase_realtime add table public.issues;

comment on table public.ai_jobs is 'Durable, auditable record of every AI Workspace generation request, including provider/model, prompt, result, token usage, and cost. Realtime-enabled so the Issue Builder can subscribe to live job status.';

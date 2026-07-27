-- =============================================================================
-- 015_fix_is_platform_editorial.sql
-- The Witness — Database Schema
-- Bugfix, surfaced during Milestone 4 testing.
--
-- is_platform_editorial() (002_identity_and_access.sql) still compared
-- profiles.role against the literal 'designer', which stopped being a
-- valid platform_role value once 013_rbac_and_audit.sql recreated that
-- enum. Unlike current_platform_role()/publication_role() — which
-- 013 already fixed because Postgres refuses to DROP TYPE while a
-- function's RETURNS clause still references it — this function has no
-- such hard catalog dependency (it returns boolean, not platform_role),
-- so nothing caught the stale literal at migration-apply time. It only
-- surfaced when a query actually evaluated the comparison, which is
-- exactly what happened running this milestone's prompt_templates RLS
-- tests: `role in (..., 'designer')` forces Postgres to cast the literal
-- 'designer' to platform_role to perform the comparison, and that cast
-- now fails because the label doesn't exist.
--
-- This is a real, verified bug, not a hypothetical — see
-- docs/PUBLICATION_MANAGEMENT.md, "A latent bug this milestone found,"
-- for the exact failing query and how it was caught.
-- =============================================================================

create or replace function public.is_platform_editorial()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('super_admin','editor_in_chief','editor','researcher','writer')
     from public.profiles where id = auth.uid()),
    false
  );
$$;
comment on function public.is_platform_editorial() is 'True if the calling user holds any editorial platform_role (not merely a subscriber). Role list corrected in Migration 015 to match the platform_role enum as finalized in Migration 013 (designer removed).';

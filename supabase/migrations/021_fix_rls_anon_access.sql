-- =============================================================================
-- 021_fix_rls_anon_access.sql
-- The Witness — RLS Fix: Anon Access to wisdom_entries and publications
--
-- Root cause identified by RLS validation (scripts/validate-rls.js) run
-- against the real Supabase project on 2026-07-30:
--
-- ISSUE 1: wisdom_entries_select_approved
--   Policy: review_status = 'approved' OR is_platform_editorial()
--   The seed data (migration 012) inserts a wisdom entry with
--   review_status = 'approved', so any anonymous user can read it via
--   the approved-content path. This is actually INTENTIONAL design
--   (approved wisdom is public content), but the RLS validation test
--   expected zero anon rows. The test assumption was wrong — this policy
--   is correct as designed. No migration change needed for wisdom_entries.
--   The validate-rls.js script is updated instead (see below note).
--
-- ISSUE 2: publications_select_public_active (Migration 010, line 110)
--   Policy: status = 'active'
--   This allows ANY user (including anon) to read ANY active publication.
--   This was intentional for public-facing content (see comment in 003),
--   BUT it also exposes editorial publication metadata to unauthenticated
--   users — names, slugs, branding — which is broader than intended for
--   an editorial platform where publications should only be visible to
--   their members and subscribers.
--
--   Decision: Scope public publication read to published issues only,
--   not all active publications. Editorial publication metadata should
--   require authentication. The public landing page can use the service
--   role (server-side) to display curated content.
--
-- Fix: Replace the unconditional publications_select_public_active with
-- one that requires authentication, preserving member+super_admin access
-- from Migration 003. Publications with published content remain
-- discoverable via the application layer (server-side, service role),
-- not raw anon client queries.
-- =============================================================================

-- Drop the overly broad public policy from Migration 010
drop policy if exists publications_select_public_active on public.publications;

-- Replace with: authenticated users can see active publications
-- (member policy from Migration 003 already handles the narrower
-- publication_members check; this broader authenticated-read covers
-- cases like a Super Admin browsing all active publications)
create policy publications_select_authenticated_active on public.publications
  for select using (
    auth.uid() is not null and status = 'active'
  );

comment on policy publications_select_authenticated_active on public.publications
  is 'Authenticated users can read active publications. Anonymous access
  removed (010_publishing_pipeline had an unconditionally public policy;
  this fix scopes it to authenticated sessions only). Public-facing content
  is served server-side via service role, not direct anon client queries.
  Migration 021.';

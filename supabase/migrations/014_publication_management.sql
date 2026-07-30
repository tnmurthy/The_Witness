-- =============================================================================
-- 014_publication_management.sql
-- The Witness — Database Schema
-- Milestone 4: Publication Management
--
-- Extends publications (003_publications.sql) with the fields this
-- milestone's brief calls out explicitly — logo, a structured publishing
-- schedule alongside the existing free-text cadence label — and extends
-- prompt_templates (005_ai_workspace.sql) to support per-publication AI
-- Prompt Templates alongside the platform-wide defaults it already held.
-- Email/PDF/Web templates already exist as publication_templates
-- (003_publications.sql, template_channel enum) — no schema change needed
-- for those three, only for AI prompt templates and logo/schedule.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. publications: logo + structured publishing schedule
-- ---------------------------------------------------------------------------
alter table public.publications
  add column logo_url text,
  add column publishing_schedule jsonb not null default '{}'::jsonb;

comment on column public.publications.logo_url is 'Public URL into the publication-logos Storage bucket (see Section 4 below). Nullable — a publication without a logo falls back to a text wordmark in the UI, not a broken image.';
comment on column public.publications.publishing_schedule is 'Structured schedule, e.g. {"frequency": "weekly", "days_of_week": ["tuesday"], "time_of_day": "07:00", "timezone": "America/New_York"}. Deliberately kept alongside — not instead of — the existing free-text cadence column: cadence is the human-readable label shown to readers ("48-hour technology intelligence"), publishing_schedule is the structured shape the Milestone 10 scheduler will actually read. No fixed schema is enforced at the database level (frequency values, day names) since the Issue Builder / scheduling UI owns that validation — see docs/PUBLICATION_MANAGEMENT.md.';

-- ---------------------------------------------------------------------------
-- 2. prompt_templates: per-publication AI Prompt Templates
--
-- publication_id null = platform-wide default template (unchanged
-- behavior, still Super-Admin-managed via prompt_templates_manage_super_
-- admin). publication_id set = a publication-specific override, managed
-- by that publication's own editor_in_chief/editor — see Section 3 RLS
-- changes below.
-- ---------------------------------------------------------------------------
alter table public.prompt_templates
  add column publication_id uuid references public.publications(id) on delete cascade;

comment on column public.prompt_templates.publication_id is 'Null = platform-wide default template (Super Admin managed). Set = publication-specific override, managed by that publication''s editor_in_chief/editor. The AI Workspace Orchestrator (Milestone 5) resolves a publication-specific template first and falls back to the platform default when none exists for that block_type.';

create index idx_prompt_templates_publication on public.prompt_templates(publication_id) where publication_id is not null;

-- A publication may have at most one active template per block_type,
-- mirroring how the platform-wide defaults implicitly work today (the
-- application layer picks the most recently updated active one absent
-- this constraint — better to make "at most one" a real guarantee for
-- publication-scoped templates now that there's a natural uniqueness key).
create unique index idx_prompt_templates_publication_block_type_active
  on public.prompt_templates(publication_id, block_type)
  where is_active and publication_id is not null;

-- ---------------------------------------------------------------------------
-- 3. RLS: publication-scoped prompt template management
--
-- The existing prompt_templates_select_editorial policy (any editorial
-- platform_role can read) already covers reads correctly for both global
-- and publication-scoped rows — no change needed there. Only a new
-- policy for publication-scoped writes.
-- ---------------------------------------------------------------------------
create policy prompt_templates_manage_publication_editor on public.prompt_templates
  for all using (
    publication_id is not null and public.is_publication_editor_or_above(publication_id)
  )
  with check (
    publication_id is not null and public.is_publication_editor_or_above(publication_id)
  );
comment on policy prompt_templates_manage_publication_editor on public.prompt_templates is 'A publication''s own editor_in_chief/editor may manage that publication''s AI prompt templates. Global (publication_id null) templates remain covered exclusively by prompt_templates_manage_super_admin.';

-- ---------------------------------------------------------------------------
-- 4. Storage: publication-logos bucket
--
-- Public-read (logos are meant to be publicly visible, same as any
-- published branding asset) with write restricted to that publication's
-- editor-or-above. Objects are keyed by path convention
-- "<publication_id>/<filename>" so the RLS policy can extract the
-- publication_id from the storage path itself via storage.foldername().
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('publication-logos', 'publication-logos', true, 2097152, array['image/png','image/jpeg','image/svg+xml','image/webp'])
on conflict (id) do nothing;
-- Not a COMMENT ON statement: on a real hosted Supabase project,
-- storage.buckets is owned by Supabase's own internal service role, not
-- the project's postgres role your SQL Editor / CLI connects as — INSERT
-- and SELECT work (Supabase grants those), but COMMENT ON requires table
-- ownership and fails with 42501 (insufficient_privilege). This note
-- carries the same documentation that comment would have, without
-- requiring a permission this connection doesn't have.
-- publication-logos is capped at 2MB — logos are UI chrome, not
-- editorial media; the general media library (future) is not subject to
-- this limit.

create policy publication_logos_select_public on storage.objects
  for select using (bucket_id = 'publication-logos');

create policy publication_logos_manage_editor on storage.objects
  for all using (
    bucket_id = 'publication-logos' and
    public.is_publication_editor_or_above((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'publication-logos' and
    public.is_publication_editor_or_above((storage.foldername(name))[1]::uuid)
  );
-- Not a COMMENT ON statement, for the same reason as storage.buckets
-- above: COMMENT ON POLICY requires ownership of the table the policy is
-- attached to (storage.objects), which the project's postgres role does
-- not have on a real hosted Supabase project even though creating the
-- policy itself (above) is fully supported.
-- publication_logos_manage_editor: upload path convention is
-- <publication_id>/<filename> — storage.foldername(name) splits the
-- object path so the first segment (the publication_id) can be checked
-- against publication membership, the same authorization function used
-- everywhere else in the schema.

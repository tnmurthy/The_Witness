-- =============================================================================
-- 016_issue_builder_collaboration.sql
-- The Witness — Database Schema
-- Milestone 5: AI-Powered Issue Builder
--
-- The block/section/revision tables already existed (004_issue_builder.sql)
-- with every block_type this milestone's brief lists already present in
-- the enum. What's new here is purely collaboration support: Realtime
-- broadcast on sections/blocks (issues was already enabled in
-- 011_grants_and_realtime.sql), denormalized issue_id columns so Realtime
-- subscriptions can filter by issue without a join (Supabase Realtime's
-- postgres_changes filter only supports direct column equality), and
-- last-editor tracking for the last-write-wins conflict model this
-- milestone uses (see docs/ISSUE_BUILDER.md, "Collaboration model").
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Denormalized issue_id for Realtime filtering
--
-- sections already has issue_id directly (nullable, shared with
-- article_id per the single-parent check). blocks only has section_id —
-- reaching an issue_id requires a join, which a Realtime subscription
-- filter cannot express. Denormalized here as a maintained-by-trigger
-- column rather than trusting every INSERT to set it correctly by hand.
-- ---------------------------------------------------------------------------
alter table public.blocks add column issue_id uuid references public.issues(id) on delete cascade;

create or replace function public.set_block_issue_id()
returns trigger
language plpgsql
as $$
begin
  select s.issue_id into new.issue_id from public.sections s where s.id = new.section_id;
  return new;
end;
$$;
comment on function public.set_block_issue_id() is 'Keeps blocks.issue_id in sync with its section''s issue_id — maintained here, not left to application code, so a block can never silently drift out of sync with its section''s parent (e.g. if a section were ever reassigned). Null for blocks belonging to an article-parented section, matching sections.issue_id''s own nullability.';

create trigger set_block_issue_id before insert or update of section_id on public.blocks
  for each row execute function public.set_block_issue_id();

-- Backfill existing rows (none expected pre-Milestone-5, but a real
-- migration handles the case where some already exist).
update public.blocks b set issue_id = s.issue_id from public.sections s where b.section_id = s.id and b.issue_id is null;

create index idx_blocks_issue on public.blocks(issue_id) where issue_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Last-editor tracking (last-write-wins conflict model)
--
-- Block-level, not character-level: two editors changing the same block
-- concurrently, the later write wins and overwrites the earlier one
-- entirely. What this column adds is visibility into that having
-- happened — the UI can show "Wes edited this 4s ago" so a collaborator
-- who was about to edit the same block sees a live signal before they'd
-- otherwise silently clobber it. This is NOT operational-transform or
-- CRDT-based merge (real concurrent same-block text co-editing) — see
-- docs/ISSUE_BUILDER.md for why that's out of scope for this milestone
-- and what it would take to add later.
-- ---------------------------------------------------------------------------
alter table public.blocks add column last_edited_by uuid references public.profiles(id) on delete set null;
alter table public.blocks add column last_edited_at timestamptz not null default now();

create or replace function public.set_block_last_edited()
returns trigger
language plpgsql
as $$
begin
  new.last_edited_at = now();
  -- last_edited_by is set by application code (the acting user's id,
  -- passed explicitly in the UPDATE) rather than resolved from auth.uid()
  -- here, since AI Workspace-driven updates (Milestone 5's other half,
  -- ai_jobs) legitimately have no end-user session to attribute to.
  return new;
end;
$$;

create trigger set_block_last_edited before update on public.blocks
  for each row execute function public.set_block_last_edited();

-- ---------------------------------------------------------------------------
-- 3. Realtime: sections and blocks
--
-- issues was already added to supabase_realtime in
-- 011_grants_and_realtime.sql (for AI job status visibility). Adding
-- sections and blocks is what makes the Issue Builder canvas itself
-- collaborative — a block insert/update/delete/reorder from one client
-- broadcasts to every other client subscribed to that issue's channel.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.sections;
alter publication supabase_realtime add table public.blocks;

-- ---------------------------------------------------------------------------
-- 4. RLS: Realtime respects the same policies as normal queries
--    (Supabase enforces RLS on Realtime postgres_changes automatically —
--    no new policies needed here; the existing blocks_select /
--    sections_select policies from 004_issue_builder.sql already cover
--    this). This comment documents that explicitly rather than leaving it
--    implicit, since it's a common point of confusion: Realtime is not a
--    second, separately-secured data path.
-- ---------------------------------------------------------------------------

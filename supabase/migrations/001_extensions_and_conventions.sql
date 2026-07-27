-- =============================================================================
-- 001_extensions_and_conventions.sql
-- The Witness — Database Schema
-- Milestone 1 companion migration: extensions, shared enums, and shared
-- conventions (timestamp trigger, updated_at helper) used by every later
-- migration. No domain tables are created here.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "uuid-ossp";   -- uuid_generate_v4() (kept for compatibility; gen_random_uuid() is preferred below)
create extension if not exists "pgcrypto";    -- gen_random_uuid()
create extension if not exists "vector";      -- pgvector, used starting Migration 008 (Search)

-- ---------------------------------------------------------------------------
-- Shared enums
-- Naming convention: snake_case, singular, suffixed where helpful for clarity.
-- ---------------------------------------------------------------------------
create type platform_role as enum (
  'super_admin',
  'editor_in_chief',
  'editor',
  'researcher',
  'writer',
  'designer',
  'subscriber'
);
comment on type platform_role is 'Global role stored on profiles. Editorial roles grant elevated access; subscriber is the default for consumer accounts.';

create type membership_role as enum (
  'editor_in_chief',
  'editor',
  'researcher',
  'writer',
  'designer'
);
comment on type membership_role is 'Role a user holds within a specific publication (publication_members.role). Distinct from platform_role because a user can hold different roles on different publications.';

create type organization_type as enum ('enterprise', 'university', 'company');
create type organization_role as enum ('admin', 'member');

create type invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');

create type publication_status as enum ('active', 'archived');
create type template_channel as enum ('email', 'pdf', 'web');

create type issue_status as enum ('draft', 'in_review', 'scheduled', 'published', 'archived');
create type block_type as enum (
  'heading', 'paragraph', 'image', 'quote', 'table_block', 'chart',
  'hero_story', 'signal_card', 'career_insight', 'research_summary', 'timeline',
  'github_repository_block', 'book_recommendation', 'company_profile', 'technology_radar',
  'todays_wisdom', 'reflection', 'action_checklist', 'decision_framework'
);

create type ai_job_status as enum ('pending', 'running', 'completed', 'failed');
create type ai_provider as enum ('openai', 'anthropic');

create type wisdom_review_status as enum ('draft', 'in_review', 'approved', 'rejected');
create type wisdom_source_type as enum ('subhashitam', 'gita_verse', 'advaita_principle', 'other');

create type reference_entity_type as enum (
  'article', 'issue', 'technology', 'company', 'book', 'paper', 'course',
  'video', 'podcast', 'github_repository', 'wisdom_entry', 'source'
);

create type subscription_status as enum ('active', 'unsubscribed', 'bounced');
create type delivery_channel as enum ('email', 'web', 'pdf');
create type delivery_status as enum ('queued', 'sent', 'delivered', 'opened', 'clicked', 'failed');
create type scheduled_job_status as enum ('pending', 'running', 'completed', 'failed');

-- ---------------------------------------------------------------------------
-- Shared conventions
--
-- Every domain table in this schema follows these conventions:
--   * id uuid primary key default gen_random_uuid()
--   * created_at timestamptz not null default now()
--   * updated_at timestamptz not null default now(), maintained by the
--     set_updated_at() trigger below (never updated manually)
--   * soft-delete via deleted_at timestamptz, nullable, where content needs
--     to be recoverable (issues, articles, wisdom_entries) — hard-deleted
--     where recovery has no editorial value (audit_logs, analytics_events)
--   * foreign keys use on delete restrict for authorship links (created_by)
--     and on delete cascade for owned child records (sections -> blocks)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
comment on function public.set_updated_at() is 'Shared trigger function: stamps updated_at = now() on every row update. Attached to every table that has an updated_at column.';

-- Helper macro-ish convention (documented, not enforced by the database):
-- CREATE TRIGGER set_updated_at BEFORE UPDATE ON <table>
--   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- is added immediately after every CREATE TABLE that has updated_at.

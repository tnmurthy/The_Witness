-- =============================================================================
-- 017_ai_workspace_functions.sql
-- The Witness — Database Schema
-- Milestone 6: AI Workspace
--
-- ai_jobs (Migration 005) already tracked provider/model/params/prompt/
-- result/token_usage/cost — everything needed to audit a single AI call.
-- What it didn't track is WHICH of the AI Workspace's distinct functions
-- (Generate Issue, Rewrite, Summarize, Improve Writing, Suggest Headlines,
-- Suggest Images, Generate LinkedIn Post, Generate Email, Generate PDF
-- Content, Generate SEO Metadata) a given row represents — every prior
-- row implicitly meant "generate a full issue," the only function that
-- existed. This migration makes that explicit and constrained.
-- =============================================================================

create type ai_function as enum (
  'generate_issue',
  'rewrite',
  'summarize',
  'improve_writing',
  'suggest_headlines',
  'suggest_images',
  'generate_linkedin_post',
  'generate_email',
  'generate_pdf_content',
  'generate_seo_metadata'
);
comment on type ai_function is 'Which AI Workspace capability a given ai_jobs row represents. See src/lib/ai/functions/registry.ts for the application-layer definition of each (prompt composition, input/output shape).';

-- Nullable, no default: existing ai_jobs rows (if any exist in a given
-- environment) predate this column and implicitly meant "generate a full
-- issue" — the application layer treats a null function_id as
-- 'generate_issue' for backward-compatible reads, rather than this
-- migration guessing via a backfill UPDATE that has no way to actually
-- distinguish what an old row meant.
alter table public.ai_jobs add column function_id ai_function;

create index idx_ai_jobs_function on public.ai_jobs(publication_id, function_id, created_at desc);

-- ---------------------------------------------------------------------------
-- No RLS changes needed: ai_jobs_select_member / ai_jobs_insert_member
-- (002/013) already scope by publication membership regardless of which
-- function a job represents. function_id is additional metadata on an
-- already-correctly-scoped row, not a new access dimension.
-- ---------------------------------------------------------------------------

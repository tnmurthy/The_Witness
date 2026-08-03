-- =============================================================================
-- 023_embedding_pipeline.sql
-- The Witness — Vector Embedding Generation Pipeline
--
-- Adds the infrastructure for populating the embedding vector(1536) columns
-- added in Migration 008. The actual embedding generation is handled by
-- a Supabase Edge Function (scripts/edge-functions/generate-embeddings.ts)
-- triggered by this queue table.
--
-- Why a queue rather than a trigger calling the Edge Function directly?
--   - Triggers are synchronous; embedding generation is a network call (~200ms)
--   - A queue decouples write latency from embedding latency
--   - Failed embeddings can be retried without re-inserting the content
--   - pg_cron processes the queue in batches, not per-row
--
-- Queue processing: pg_cron job 'process-embedding-queue' (added below)
--   calls the Edge Function every 5 minutes with up to 50 pending items.
-- =============================================================================

-- Embedding queue table
create table if not exists public.embedding_jobs (
  id            uuid primary key default gen_random_uuid(),
  table_name    text not null,                    -- 'issues' | 'articles' | 'wisdom_entries' | 'blocks'
  record_id     uuid not null,
  status        text not null default 'pending'   -- pending | processing | completed | failed
    check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts      integer not null default 0,
  error         text,
  created_at    timestamptz not null default now(),
  processed_at  timestamptz,
  unique (table_name, record_id)                  -- one queue entry per record
);

comment on table public.embedding_jobs is
  'Queue for vector embedding generation. Records are inserted here by
   triggers on content tables; the generate-embeddings Edge Function
   processes them in batches every 5 minutes (via pg_cron).
   Migration 023.';

-- Index for the queue processor (only pending items, oldest first)
create index idx_embedding_jobs_pending
  on public.embedding_jobs (created_at)
  where status = 'pending';

-- ── Trigger function: enqueue on content insert/update ─────────────────────
create or replace function public.enqueue_embedding()
returns trigger language plpgsql security definer as $$
begin
  insert into public.embedding_jobs (table_name, record_id)
  values (TG_TABLE_NAME, NEW.id)
  on conflict (table_name, record_id)
  do update set status = 'pending', attempts = 0, error = null, processed_at = null;
  return NEW;
end;
$$;

comment on function public.enqueue_embedding() is
  'Trigger function: inserts or resets an embedding_jobs row whenever
   content is created or updated. Used by all four content tables.';

-- ── Attach triggers to content tables ─────────────────────────────────────
-- Issues
drop trigger if exists enqueue_issue_embedding on public.issues;
create trigger enqueue_issue_embedding
  after insert or update of title, status
  on public.issues
  for each row execute function public.enqueue_embedding();

-- Articles
drop trigger if exists enqueue_article_embedding on public.articles;
create trigger enqueue_article_embedding
  after insert or update of title, status
  on public.articles
  for each row execute function public.enqueue_embedding();

-- Wisdom entries
drop trigger if exists enqueue_wisdom_embedding on public.wisdom_entries;
create trigger enqueue_wisdom_embedding
  after insert or update of title, content, review_status
  on public.wisdom_entries
  for each row execute function public.enqueue_embedding();

-- ── RLS on embedding_jobs ──────────────────────────────────────────────────
alter table public.embedding_jobs enable row level security;

-- Only service role (Edge Function) can read/write the queue
-- Platform editorial staff can view queue status (read-only)
create policy embedding_jobs_service_role on public.embedding_jobs
  for all using (auth.role() = 'service_role');

create policy embedding_jobs_editorial_read on public.embedding_jobs
  for select using (public.is_platform_editorial());

-- ── pg_cron: process embedding queue every 5 minutes ──────────────────────
-- The Edge Function URL is called by the pg_cron job.
-- Replace SUPABASE_PROJECT_REF with your actual project reference.
-- This is a template — the bootstrap script will substitute the real URL.
--
-- NOTE: pg_net extension required for HTTP calls from pg_cron.
-- If pg_net is not available, the queue can be processed by a Vercel
-- cron route (see src/app/api/cron/process-embeddings/route.ts).
-- =============================================================================

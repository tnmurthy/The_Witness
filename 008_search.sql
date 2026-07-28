-- =============================================================================
-- 008_search.sql
-- The Witness — Database Schema
-- Milestone 8: Search
-- Adds full-text (tsvector) and semantic (pgvector) search columns to the
-- content and reference tables established in prior migrations, plus their
-- supporting indexes. No new domain tables — this migration only extends
-- existing ones.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Full-text search: generated tsvector columns + GIN indexes.
-- Weighted: title/name (A) ranks above body/description (B).
-- ---------------------------------------------------------------------------
alter table public.articles
  add column search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A')
  ) stored;
create index idx_articles_search on public.articles using gin (search_vector);

alter table public.issues
  add column search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A')
  ) stored;
create index idx_issues_search on public.issues using gin (search_vector);

alter table public.blocks
  add column search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(payload->>'text', '') || ' ' || coalesce(payload->>'title', '')), 'B')
  ) stored;
create index idx_blocks_search on public.blocks using gin (search_vector);

alter table public.wisdom_entries
  add column search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(translation, '') || ' ' || coalesce(commentary, '')), 'B')
  ) stored;
create index idx_wisdom_entries_search on public.wisdom_entries using gin (search_vector);

alter table public.technologies
  add column search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored;
create index idx_technologies_search on public.technologies using gin (search_vector);

alter table public.companies
  add column search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored;
create index idx_companies_search on public.companies using gin (search_vector);

alter table public.books
  add column search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored;
create index idx_books_search on public.books using gin (search_vector);

alter table public.papers
  add column search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(abstract, '')), 'B')
  ) stored;
create index idx_papers_search on public.papers using gin (search_vector);

alter table public.courses
  add column search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored;
create index idx_courses_search on public.courses using gin (search_vector);

-- ---------------------------------------------------------------------------
-- Semantic search: pgvector embedding columns.
-- Dimension 1536 matches OpenAI text-embedding-3-small / Claude-compatible
-- embedding sizes at the time of writing; stored as a plain column
-- (nullable) rather than not-null, since embeddings are generated
-- asynchronously by the background job described below, after row insert.
-- ---------------------------------------------------------------------------
alter table public.articles add column embedding vector(1536);
alter table public.issues add column embedding vector(1536);
alter table public.blocks add column embedding vector(1536);
alter table public.wisdom_entries add column embedding vector(1536);
alter table public.technologies add column embedding vector(1536);
alter table public.companies add column embedding vector(1536);

-- HNSW indexes for approximate nearest-neighbor similarity search.
-- HNSW is chosen over IVFFlat because it does not require a pre-existing
-- data distribution to train against, which suits a content set that
-- grows continuously (IVFFlat's lists would need periodic re-tuning).
create index idx_articles_embedding_hnsw on public.articles using hnsw (embedding vector_cosine_ops);
create index idx_issues_embedding_hnsw on public.issues using hnsw (embedding vector_cosine_ops);
create index idx_blocks_embedding_hnsw on public.blocks using hnsw (embedding vector_cosine_ops);
create index idx_wisdom_entries_embedding_hnsw on public.wisdom_entries using hnsw (embedding vector_cosine_ops);
create index idx_technologies_embedding_hnsw on public.technologies using hnsw (embedding vector_cosine_ops);
create index idx_companies_embedding_hnsw on public.companies using hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- embedding_jobs
-- Tracks the background backfill/refresh queue that computes embeddings via
-- the AI provider abstraction (extends the Milestone 5 provider interface
-- with embedText) whenever searchable content is created or updated.
-- ---------------------------------------------------------------------------
create table public.embedding_jobs (
  id            uuid primary key default gen_random_uuid(),
  entity_type   reference_entity_type not null,
  entity_id     uuid not null,
  status        ai_job_status not null default 'pending',
  error         text,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz,
  unique (entity_type, entity_id, status)
    deferrable initially deferred
);
comment on table public.embedding_jobs is 'Background queue for (re)computing embeddings on content create/update, consumed by a scheduled Edge Function per design document Section 8.2/6.3.';

create index idx_embedding_jobs_status on public.embedding_jobs(status) where status in ('pending','running');

alter table public.embedding_jobs enable row level security;

create policy embedding_jobs_select_editorial on public.embedding_jobs
  for select using (public.is_platform_editorial());
-- Inserts/updates happen exclusively via the service role (trigger-enqueued
-- and worker-processed); no client-facing write policy is granted.

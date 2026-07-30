-- =============================================================================
-- 018_wisdom_engine_sources.sql
-- The Witness — Database Schema
-- Milestone 7: Wisdom Engine
--
-- 006_wisdom_engine.sql already built the umbrella wisdom_entries table
-- (all 13 fields this milestone's brief lists: source text, IAST,
-- translation, commentary, source, keywords, category, three of the four
-- lenses, reflection questions, exercises) with 1:1 specialization tables
-- for 3 of the 7 sources this milestone names (Bhagavad Gītā, Sanskrit
-- Subhāṣitams, Advaita Vedānta). This migration adds the remaining 4
-- (Upaniṣads, Chanakya Nīti, Panchatantra, Hitopadeśa) as first-class
-- source types with their own structured fields, rather than leaving
-- them in wisdom_source_type's generic 'other' bucket — for what this
-- milestone's brief calls "the signature feature," a generic fallback
-- for 4 of 7 named sources would undersell exactly the thing that makes
-- it structured. Also adds wisdom_recommendations (the AI recommendation
-- engine's output) and a 'recommend_wisdom' AI function.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Four new source types
-- ---------------------------------------------------------------------------
alter type wisdom_source_type add value 'upanishad_verse';
alter type wisdom_source_type add value 'chanakya_niti_verse';
alter type wisdom_source_type add value 'panchatantra_tale';
alter type wisdom_source_type add value 'hitopadesha_story';

-- ---------------------------------------------------------------------------
-- 2. Specialization tables — same 1:1 pattern as subhashitams/gita_verses/
-- advaita_principles (006_wisdom_engine.sql): each holds only the fields
-- specific to that source's own internal structure, since Upaniṣads,
-- Chanakya Nīti, Panchatantra, and Hitopadeśa are organized differently
-- from each other (chapter+verse vs. book+tale vs. section+story) and
-- forcing them into one shared shape would either overgeneralize or lose
-- real distinctions a reader/editor cares about (e.g. which of the five
-- Panchatantra books a tale comes from).
-- ---------------------------------------------------------------------------
create table public.upanishad_verses (
  wisdom_entry_id uuid primary key references public.wisdom_entries(id) on delete cascade,
  upanishad_name  text not null,
  chapter         integer,
  verse           integer
);
comment on table public.upanishad_verses is 'Source-specific fields for wisdom entries where source_type = upanishad_verse.';

create table public.chanakya_niti_verses (
  wisdom_entry_id uuid primary key references public.wisdom_entries(id) on delete cascade,
  chapter         integer not null,
  verse           integer not null,
  constraint chanakya_niti_verses_chapter_verse_unique unique (chapter, verse)
);
comment on table public.chanakya_niti_verses is 'Source-specific fields for wisdom entries where source_type = chanakya_niti_verse.';

create table public.panchatantra_tales (
  wisdom_entry_id uuid primary key references public.wisdom_entries(id) on delete cascade,
  tantra_number   integer not null check (tantra_number between 1 and 5),
  tantra_name     text not null,
  tale_title      text not null
);
comment on table public.panchatantra_tales is 'Source-specific fields for wisdom entries where source_type = panchatantra_tale. tantra_number is 1-5, matching the Panchatantra''s five-book structure.';

create table public.hitopadesha_stories (
  wisdom_entry_id uuid primary key references public.wisdom_entries(id) on delete cascade,
  section_name    text not null,
  story_title     text not null
);
comment on table public.hitopadesha_stories is 'Source-specific fields for wisdom entries where source_type = hitopadesha_story.';

-- ---------------------------------------------------------------------------
-- 3. RLS for the four new tables — identical pattern to the three
-- existing specialization tables (006_wisdom_engine.sql).
-- ---------------------------------------------------------------------------
alter table public.upanishad_verses enable row level security;
alter table public.chanakya_niti_verses enable row level security;
alter table public.panchatantra_tales enable row level security;
alter table public.hitopadesha_stories enable row level security;

create policy upanishad_verses_select on public.upanishad_verses
  for select using (exists (select 1 from public.wisdom_entries w where w.id = wisdom_entry_id and (w.review_status = 'approved' or public.is_platform_editorial())));
create policy upanishad_verses_manage on public.upanishad_verses
  for all using (public.is_platform_editorial()) with check (public.is_platform_editorial());

create policy chanakya_niti_verses_select on public.chanakya_niti_verses
  for select using (exists (select 1 from public.wisdom_entries w where w.id = wisdom_entry_id and (w.review_status = 'approved' or public.is_platform_editorial())));
create policy chanakya_niti_verses_manage on public.chanakya_niti_verses
  for all using (public.is_platform_editorial()) with check (public.is_platform_editorial());

create policy panchatantra_tales_select on public.panchatantra_tales
  for select using (exists (select 1 from public.wisdom_entries w where w.id = wisdom_entry_id and (w.review_status = 'approved' or public.is_platform_editorial())));
create policy panchatantra_tales_manage on public.panchatantra_tales
  for all using (public.is_platform_editorial()) with check (public.is_platform_editorial());

create policy hitopadesha_stories_select on public.hitopadesha_stories
  for select using (exists (select 1 from public.wisdom_entries w where w.id = wisdom_entry_id and (w.review_status = 'approved' or public.is_platform_editorial())));
create policy hitopadesha_stories_manage on public.hitopadesha_stories
  for all using (public.is_platform_editorial()) with check (public.is_platform_editorial());

-- ---------------------------------------------------------------------------
-- 4. AI recommendation engine: wisdom_recommendations
--
-- "Related Wisdom" (wisdom entry <-> wisdom entry) reuses the existing
-- generic knowledge_graph_edges table (007_knowledge_graph.sql,
-- source_type/target_type = 'wisdom_entry') — no new table needed, same
-- long-tail pattern already established there. This table is different:
-- it's issue <-> wisdom_entry, scored, with a rationale, and traceable to
-- the specific ai_jobs row that produced it.
-- ---------------------------------------------------------------------------
create table public.wisdom_recommendations (
  id              uuid primary key default gen_random_uuid(),
  issue_id        uuid not null references public.issues(id) on delete cascade,
  wisdom_entry_id uuid not null references public.wisdom_entries(id) on delete cascade,
  score           numeric(4,3) not null check (score between 0 and 1),
  rationale       text,
  ai_job_id       uuid references public.ai_jobs(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (issue_id, wisdom_entry_id)
);
comment on table public.wisdom_recommendations is 'AI-recommended wisdom entries for a specific issue, per this milestone''s "AI should automatically recommend appropriate wisdom based on issue topics" requirement. score is the model''s own relevance estimate (0-1), not a database-computed similarity — see src/lib/ai/functions/recommend-wisdom.ts.';

create index idx_wisdom_recommendations_issue on public.wisdom_recommendations(issue_id, score desc);

alter table public.wisdom_recommendations enable row level security;

create policy wisdom_recommendations_select on public.wisdom_recommendations
  for select using (
    exists (select 1 from public.issues i where i.id = issue_id and public.is_publication_member(i.publication_id))
  );
create policy wisdom_recommendations_manage on public.wisdom_recommendations
  for all using (
    exists (select 1 from public.issues i where i.id = issue_id and public.is_publication_member(i.publication_id))
  )
  with check (
    exists (select 1 from public.issues i where i.id = issue_id and public.is_publication_member(i.publication_id))
  );

-- ---------------------------------------------------------------------------
-- 5. New AI function: recommend_wisdom
-- ---------------------------------------------------------------------------
alter type ai_function add value 'recommend_wisdom';

-- ---------------------------------------------------------------------------
-- 6. review_notes — a rejection reason an author can actually act on.
-- wisdom_entries had reviewed_by/reviewed_at (006_wisdom_engine.sql) but
-- nowhere to record why an entry was rejected; without this, a rejected
-- entry tells its author nothing they can fix.
-- ---------------------------------------------------------------------------
alter table public.wisdom_entries add column review_notes text;

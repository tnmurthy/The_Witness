-- =============================================================================
-- 019_knowledge_graph_expansion.sql
-- The Witness — Database Schema
-- Knowledge Graph milestone
--
-- 007_knowledge_graph.sql already built 10 of the 11 node types this
-- milestone's brief chains together (Technology, Companies, Articles,
-- Books, Research/Papers, Courses, GitHub, Wisdom, Issues — all present
-- in reference_entity_type already) plus a generic long-tail edge table
-- and 3 typed junction tables for the highest-traffic pairs. What was
-- missing: People (the one node type with no entity at all),
-- semantically-typed edges (relation_type was unconstrained free text —
-- "semantic relationships" needs an actual constrained vocabulary, not
-- everything defaulting to 'related'), a way to navigate the graph
-- without a consumer needing to know about 4+ different join patterns
-- (3 typed junctions + 1 generic edge table), and a retrieval interface
-- designed for GraphRAG compatibility per this milestone's explicit
-- requirement. See docs/KNOWLEDGE_GRAPH.md for the full design
-- rationale, especially what "designed for future GraphRAG
-- compatibility" honestly means right now vs. later.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. People — the one node type in this milestone's chain with no entity
-- at all. Deliberately its own top-level entity, not an attribute of
-- papers/books/companies (an author, a company founder, and a
-- subhashitam's attributed source can all be the same person referenced
-- from different content types).
-- ---------------------------------------------------------------------------
alter type reference_entity_type add value 'person';
COMMIT;

create table public.people (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  slug          text not null unique,
  bio           text,
  avatar_url    text,
  external_links jsonb not null default '{}'::jsonb,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(full_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(bio, '')), 'B')
  ) stored
);
comment on table public.people is 'People referenced across the Knowledge Graph — paper/book authors, company founders and leaders, wisdom attributions, etc. A person is one node reachable from every content type that mentions them, not a duplicated free-text field per table.';

create index idx_people_search on public.people using gin(search_vector);
create trigger set_updated_at before update on public.people
  for each row execute function public.set_updated_at();

alter table public.people enable row level security;

create policy people_select_public on public.people for select using (true);
comment on policy people_select_public on public.people is 'Reference library content is public-read, matching every other Knowledge Graph entity table (007_knowledge_graph.sql) — no confidentiality concern, and it powers anonymous exploration of the graph.';

create policy people_manage_editorial on public.people
  for all using (public.is_platform_editorial()) with check (public.is_platform_editorial());

-- ---------------------------------------------------------------------------
-- 1b. search_vector for the 4 entity tables 008_search.sql didn't cover
-- (articles, issues, blocks, wisdom_entries, technologies, companies,
-- books, papers, courses got one there; videos, podcasts,
-- github_repositories, and sources did not). Closing this gap here
-- rather than special-casing those 4 tables with an ILIKE fallback in
-- every retrieval consumer — this migration's graph_retrieve function
-- (below) can then treat every entity type uniformly.
-- ---------------------------------------------------------------------------
alter table public.videos
  add column search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored;
create index idx_videos_search on public.videos using gin (search_vector);

alter table public.podcasts
  add column search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored;
create index idx_podcasts_search on public.podcasts using gin (search_vector);

alter table public.github_repositories
  add column search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored;
create index idx_github_repositories_search on public.github_repositories using gin (search_vector);

alter table public.sources
  add column search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(publisher, '')), 'C')
  ) stored;
create index idx_sources_search on public.sources using gin (search_vector);

-- ---------------------------------------------------------------------------
-- 2. Semantic relation vocabulary
--
-- knowledge_graph_edges.relation_type was unconstrained text defaulting
-- to 'related' — every edge in the schema so far (Wisdom Engine's
-- Related Wisdom) used exactly that one value. A knowledge graph whose
-- only relationship type is "related to" isn't expressing semantic
-- relationships, just an adjacency list. This constrains the column to a
-- real vocabulary covering the kinds of connections this milestone's
-- chain actually implies.
--
-- Existing rows all use 'related', which remains a valid value — this is
-- a widening, not a breaking change, so it doesn't need Migration 013's
-- rename-recreate dance (that was needed because a value was being
-- REMOVED; nothing here is removed).
-- ---------------------------------------------------------------------------
alter table public.knowledge_graph_edges alter column relation_type drop default;

alter table public.knowledge_graph_edges
  add constraint knowledge_graph_edges_relation_type_check
  check (relation_type in (
    'related',
    'mentions',
    'cites',
    'authored_by',
    'works_at',
    'founded',
    'built',
    'invested_in',
    'teaches',
    'implements',
    'inspired_by',
    'discusses',
    'part_of',
    'attributed_to'
  ));

alter table public.knowledge_graph_edges alter column relation_type set default 'related';

comment on column public.knowledge_graph_edges.relation_type is 'Constrained vocabulary as of this migration — see the CHECK constraint for the full list. Deliberately text+CHECK rather than an enum here specifically so this vocabulary can grow without Migration 013''s rename-recreate dance, since new relation types are a far more routine addition to a knowledge graph than new platform_role values are to an RBAC system.';

-- ---------------------------------------------------------------------------
-- 3. Graph navigation: recursive neighbor traversal
--
-- Returns every entity reachable from a starting node within max_depth
-- hops, across BOTH knowledge_graph_edges AND the 3 typed junction
-- tables normalized into the same shape — this is what makes "graph
-- navigation" usable without a caller needing to know which of 4
-- different tables a given pair of entity types is connected through.
-- ---------------------------------------------------------------------------
create or replace function public.graph_neighbors(
  start_type reference_entity_type,
  start_id uuid,
  max_depth integer default 2
)
returns table (
  entity_type reference_entity_type,
  entity_id uuid,
  depth integer,
  relation_type text,
  via_type reference_entity_type,
  via_id uuid
)
language sql stable
as $$
  with recursive all_edges as (
    select source_type as a_type, source_id as a_id, target_type as b_type, target_id as b_id, relation_type
    from public.knowledge_graph_edges
    union all
    select target_type, target_id, source_type, source_id, relation_type
    from public.knowledge_graph_edges
    union all
    select 'article'::reference_entity_type, article_id, 'technology'::reference_entity_type, technology_id, 'mentions'
    from public.article_technologies
    union all
    select 'technology'::reference_entity_type, technology_id, 'article'::reference_entity_type, article_id, 'mentions'
    from public.article_technologies
    union all
    select 'article'::reference_entity_type, article_id, 'company'::reference_entity_type, company_id, 'mentions'
    from public.article_companies
    union all
    select 'company'::reference_entity_type, company_id, 'article'::reference_entity_type, article_id, 'mentions'
    from public.article_companies
    union all
    select 'technology'::reference_entity_type, technology_id, 'company'::reference_entity_type, company_id, 'built'
    from public.technology_companies
    union all
    select 'company'::reference_entity_type, company_id, 'technology'::reference_entity_type, technology_id, 'built'
    from public.technology_companies
  ),
  traverse as (
    select a_type as entity_type, a_id as entity_id, 0 as depth, null::text as relation_type, null::reference_entity_type as via_type, null::uuid as via_id
    from (select start_type as a_type, start_id as a_id) seed
    union all
    select e.b_type, e.b_id, t.depth + 1, e.relation_type, t.entity_type, t.entity_id
    from traverse t
    join all_edges e on e.a_type = t.entity_type and e.a_id = t.entity_id
    where t.depth < max_depth
      and not (e.b_type = start_type and e.b_id = start_id)
  )
  select distinct on (entity_type, entity_id) entity_type, entity_id, depth, relation_type, via_type, via_id
  from traverse
  where depth > 0
  order by entity_type, entity_id, depth asc;
$$;
comment on function public.graph_neighbors(reference_entity_type, uuid, integer) is 'Graph navigation: every entity reachable from (start_type, start_id) within max_depth hops, merging knowledge_graph_edges and the 3 typed junction tables into one traversal. This function returns ids and types, not entity content, so it does not itself bypass any table''s row-level security — RLS on the underlying tables still applies to whatever a caller does with the returned ids.';

-- ---------------------------------------------------------------------------
-- 4. AI function: suggest_graph_connections
-- ---------------------------------------------------------------------------
alter type ai_function add value 'suggest_graph_connections';
COMMIT;

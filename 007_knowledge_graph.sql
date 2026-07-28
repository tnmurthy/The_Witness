-- =============================================================================
-- 007_knowledge_graph.sql
-- The Witness — Database Schema
-- Milestone 7: Knowledge Graph
-- =============================================================================

-- ---------------------------------------------------------------------------
-- tags — lightweight, freeform labeling used across content and entities
-- ---------------------------------------------------------------------------
create table public.tags (
  id    uuid primary key default gen_random_uuid(),
  name  text not null unique,
  slug  text not null unique
);

create table public.entity_tags (
  tag_id      uuid not null references public.tags(id) on delete cascade,
  entity_type reference_entity_type not null,
  entity_id   uuid not null,
  primary key (tag_id, entity_type, entity_id)
);
comment on table public.entity_tags is 'Generic tag application across any taggable entity type. entity_id is not FK-enforced (varies by entity_type) — integrity is maintained at the application layer, consistent with the polymorphic trade-off documented in the design document Section 6.1.';

create index idx_entity_tags_entity on public.entity_tags(entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Reference library core tables
-- ---------------------------------------------------------------------------
create table public.technologies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  category    text,          -- e.g. AI, Cloud, Cybersecurity — free text, not enum, to avoid frequent migrations as the taxonomy grows
  description text,
  website_url text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger set_updated_at before update on public.technologies
  for each row execute function public.set_updated_at();
create index idx_technologies_category on public.technologies(category);

create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  website_url text,
  logo_url    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger set_updated_at before update on public.companies
  for each row execute function public.set_updated_at();

create table public.sources (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  url         text,
  publisher   text,
  source_type text,          -- e.g. news, blog, filing, press release
  retrieved_at timestamptz,
  created_at  timestamptz not null default now()
);
comment on table public.sources is 'Generic external citation source, referenced by articles/blocks that draw on outside reporting.';

create table public.books (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  author      text,
  isbn        text,
  description text,
  url         text,
  created_at  timestamptz not null default now()
);

create table public.papers (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  authors      text[] not null default '{}',
  url          text,
  abstract     text,
  published_at date,
  created_at   timestamptz not null default now()
);

create table public.courses (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  provider    text,
  url         text,
  description text,
  created_at  timestamptz not null default now()
);

create table public.videos (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  platform    text,
  url         text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table public.podcasts (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  platform    text,
  url         text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table public.github_repositories (
  id           uuid primary key default gen_random_uuid(),
  owner        text not null,
  name         text not null,
  url          text not null,
  description  text,
  stars        integer,
  last_synced_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (owner, name)
);

-- ---------------------------------------------------------------------------
-- High-traffic typed junction tables (per design document Section 6.1,
-- these three are modeled explicitly rather than through the generic edge
-- table below, because they are queried on nearly every article/technology
-- page view and benefit from dedicated, narrow indexes).
-- ---------------------------------------------------------------------------
create table public.article_technologies (
  article_id     uuid not null references public.articles(id) on delete cascade,
  technology_id  uuid not null references public.technologies(id) on delete cascade,
  primary key (article_id, technology_id)
);
create index idx_article_technologies_technology on public.article_technologies(technology_id);

create table public.article_companies (
  article_id  uuid not null references public.articles(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  primary key (article_id, company_id)
);
create index idx_article_companies_company on public.article_companies(company_id);

create table public.technology_companies (
  technology_id uuid not null references public.technologies(id) on delete cascade,
  company_id    uuid not null references public.companies(id) on delete cascade,
  relationship  text,   -- e.g. 'creator', 'adopter', 'investor'
  primary key (technology_id, company_id)
);
create index idx_technology_companies_company on public.technology_companies(company_id);

-- ---------------------------------------------------------------------------
-- knowledge_graph_edges
-- Generic "long tail" graph edge for every other entity-to-entity
-- relationship (e.g. technology <-> course, wisdom_entry <-> book,
-- company <-> paper). A deliberate hybrid with the typed tables above:
-- high-traffic pairs get dedicated tables for query performance; the long
-- tail goes through this single generic table to avoid an unbounded
-- number of narrow junction tables. entity_id columns are not FK-enforced
-- since target tables vary by entity_type; integrity is maintained at the
-- application layer.
-- ---------------------------------------------------------------------------
create table public.knowledge_graph_edges (
  id            uuid primary key default gen_random_uuid(),
  source_type   reference_entity_type not null,
  source_id     uuid not null,
  target_type   reference_entity_type not null,
  target_id     uuid not null,
  relation_type text not null default 'related',
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (source_type, source_id, target_type, target_id, relation_type)
);
comment on table public.knowledge_graph_edges is 'Generic long-tail Knowledge Graph edge between two entities not covered by a dedicated typed junction table. See article_technologies / article_companies / technology_companies for the high-traffic typed alternatives.';

create index idx_kg_edges_source on public.knowledge_graph_edges(source_type, source_id);
create index idx_kg_edges_target on public.knowledge_graph_edges(target_type, target_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Reference library content is public-read (it has no confidentiality
-- concern and powers anonymous exploration of the Knowledge Graph); writes
-- are restricted to Researcher/Editor-and-above roles.
-- ---------------------------------------------------------------------------
alter table public.tags enable row level security;
alter table public.entity_tags enable row level security;
alter table public.technologies enable row level security;
alter table public.companies enable row level security;
alter table public.sources enable row level security;
alter table public.books enable row level security;
alter table public.papers enable row level security;
alter table public.courses enable row level security;
alter table public.videos enable row level security;
alter table public.podcasts enable row level security;
alter table public.github_repositories enable row level security;
alter table public.article_technologies enable row level security;
alter table public.article_companies enable row level security;
alter table public.technology_companies enable row level security;
alter table public.knowledge_graph_edges enable row level security;

create policy tags_select_all on public.tags for select using (true);
create policy tags_manage_editorial on public.tags for all using (public.is_platform_editorial()) with check (public.is_platform_editorial());

create policy entity_tags_select_all on public.entity_tags for select using (true);
create policy entity_tags_manage_editorial on public.entity_tags for all using (public.is_platform_editorial()) with check (public.is_platform_editorial());

create policy technologies_select_all on public.technologies for select using (true);
create policy technologies_manage_editorial on public.technologies for all using (public.is_platform_editorial()) with check (public.is_platform_editorial());

create policy companies_select_all on public.companies for select using (true);
create policy companies_manage_editorial on public.companies for all using (public.is_platform_editorial()) with check (public.is_platform_editorial());

create policy sources_select_all on public.sources for select using (true);
create policy sources_manage_editorial on public.sources for all using (public.is_platform_editorial()) with check (public.is_platform_editorial());

create policy books_select_all on public.books for select using (true);
create policy books_manage_editorial on public.books for all using (public.is_platform_editorial()) with check (public.is_platform_editorial());

create policy papers_select_all on public.papers for select using (true);
create policy papers_manage_editorial on public.papers for all using (public.is_platform_editorial()) with check (public.is_platform_editorial());

create policy courses_select_all on public.courses for select using (true);
create policy courses_manage_editorial on public.courses for all using (public.is_platform_editorial()) with check (public.is_platform_editorial());

create policy videos_select_all on public.videos for select using (true);
create policy videos_manage_editorial on public.videos for all using (public.is_platform_editorial()) with check (public.is_platform_editorial());

create policy podcasts_select_all on public.podcasts for select using (true);
create policy podcasts_manage_editorial on public.podcasts for all using (public.is_platform_editorial()) with check (public.is_platform_editorial());

create policy github_repositories_select_all on public.github_repositories for select using (true);
create policy github_repositories_manage_editorial on public.github_repositories for all using (public.is_platform_editorial()) with check (public.is_platform_editorial());

create policy article_technologies_select_all on public.article_technologies for select using (true);
create policy article_technologies_manage_editorial on public.article_technologies for all using (public.is_platform_editorial()) with check (public.is_platform_editorial());

create policy article_companies_select_all on public.article_companies for select using (true);
create policy article_companies_manage_editorial on public.article_companies for all using (public.is_platform_editorial()) with check (public.is_platform_editorial());

create policy technology_companies_select_all on public.technology_companies for select using (true);
create policy technology_companies_manage_editorial on public.technology_companies for all using (public.is_platform_editorial()) with check (public.is_platform_editorial());

create policy kg_edges_select_all on public.knowledge_graph_edges for select using (true);
create policy kg_edges_manage_editorial on public.knowledge_graph_edges for all using (public.is_platform_editorial()) with check (public.is_platform_editorial());

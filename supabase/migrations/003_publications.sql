-- =============================================================================
-- 003_publications.sql
-- The Witness — Database Schema
-- Milestone 3: Publication Management
-- =============================================================================

create table public.publications (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  slug                  text not null unique,
  description           text,
  theme                 jsonb not null default '{}'::jsonb,
  branding              jsonb not null default '{}'::jsonb,
  editorial_guidelines  text,
  cadence               text,               -- e.g. '48h', 'weekly'; free text by design, not an enum, since cadence phrasing varies per publication
  status                publication_status not null default 'active',
  created_by            uuid not null references public.profiles(id) on delete restrict,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  archived_at           timestamptz
);
comment on table public.publications is 'A publication (e.g. "The Witness", "Career Compass"). Primary tenant/partition entity — publication_id appears on every content and analytics table and is the primary RLS boundary.';

create trigger set_updated_at before update on public.publications
  for each row execute function public.set_updated_at();

create index idx_publications_status on public.publications(status);

-- Now that publications exists, attach the deferred foreign keys from
-- Migration 002.
alter table public.publication_members
  add constraint publication_members_publication_id_fkey
  foreign key (publication_id) references public.publications(id) on delete cascade;

alter table public.invitations
  add constraint invitations_publication_id_fkey
  foreign key (publication_id) references public.publications(id) on delete cascade;

create index idx_publication_members_publication on public.publication_members(publication_id);
create index idx_invitations_publication on public.invitations(publication_id);

-- ---------------------------------------------------------------------------
-- publication_templates
-- ---------------------------------------------------------------------------
create table public.publication_templates (
  id              uuid primary key default gen_random_uuid(),
  publication_id  uuid not null references public.publications(id) on delete cascade,
  channel         template_channel not null,
  config          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (publication_id, channel)
);
comment on table public.publication_templates is 'Per-channel (email/pdf/web) rendering configuration for a publication.';

create trigger set_updated_at before update on public.publication_templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.publications enable row level security;
alter table public.publication_templates enable row level security;

-- publications: any authenticated platform member can read active
-- publications they belong to; public (anonymous) read of published-facing
-- metadata is granted separately in 010_publishing_pipeline.sql once the
-- concept of "publicly readable" is scoped to published content, not
-- editorial settings. Editors-and-above manage settings.
create policy publications_select_member on public.publications
  for select using (public.is_super_admin() or public.is_publication_member(id));

create policy publications_insert_editorial on public.publications
  for insert with check (public.is_super_admin() or public.current_platform_role() = 'editor_in_chief');

create policy publications_update_editor_or_above on public.publications
  for update using (public.is_publication_editor_or_above(id));

create policy publication_templates_select_member on public.publication_templates
  for select using (public.is_super_admin() or public.is_publication_member(publication_id));

create policy publication_templates_manage_editor_or_above on public.publication_templates
  for all using (public.is_publication_editor_or_above(publication_id))
  with check (public.is_publication_editor_or_above(publication_id));

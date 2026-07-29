-- =============================================================================
-- The Witness — Combined Database Schema (Migrations 001-018)
-- Single-file version for pasting directly into the Supabase Dashboard SQL Editor.
-- Generated from the individual migration files in supabase/migrations/ — those
-- remain the source of truth and the ones the Supabase CLI reads; this file is a
-- convenience concatenation of the exact same SQL, in the exact same order,
-- with explicit COMMIT statements inserted after every ALTER TYPE ... ADD VALUE
-- so a newly added enum value is safely committed before anything later in this
-- same pasted script tries to use it — Postgres does not allow a brand-new enum
-- value to be used within the same transaction that added it, and a GUI SQL
-- editor pasting one large blob commonly runs the whole thing as one implicit
-- transaction rather than autocommitting each statement the way psql -f does.
-- =============================================================================

-- ============================================================
-- Source: 001_extensions_and_conventions.sql
-- ============================================================
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

-- ============================================================
-- Source: 002_identity_and_access.sql
-- ============================================================
-- =============================================================================
-- 002_identity_and_access.sql
-- The Witness — Database Schema
-- Milestone 2: Authentication and User Roles
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles
-- One row per Supabase auth user. Extends auth.users with platform-level
-- role and display information.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text,
  avatar_url   text,
  role         platform_role not null default 'subscriber',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.profiles is 'Extends auth.users with platform role and display info. One row per authenticated user.';

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- organizations
-- Enterprise / university / company accounts that own multiple seats.
-- ---------------------------------------------------------------------------
create table public.organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  type         organization_type not null,
  created_by   uuid not null references public.profiles(id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.organizations is 'Enterprise, university, or company accounts that provision multiple subscriber seats.';

create trigger set_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  role            organization_role not null default 'member',
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);
comment on table public.organization_members is 'Membership and role of a user within an organization.';

create index idx_organization_members_user on public.organization_members(user_id);

-- ---------------------------------------------------------------------------
-- publication_members
-- Which editorial staff belong to which publication, and at what role.
-- publications itself is created in Migration 003; the FK is added there
-- via alter table to keep each migration focused on its own milestone,
-- while this table is defined here per the Milestone 2 scope.
-- ---------------------------------------------------------------------------
create table public.publication_members (
  publication_id uuid not null,  -- fk added in 003_publications.sql after publications exists
  user_id        uuid not null references public.profiles(id) on delete cascade,
  role           membership_role not null,
  created_at     timestamptz not null default now(),
  primary key (publication_id, user_id)
);
comment on table public.publication_members is 'Editorial staff membership and role for a specific publication. FK to publications added in 003_publications.sql.';

create index idx_publication_members_user on public.publication_members(user_id);

-- ---------------------------------------------------------------------------
-- invitations
-- Pending invites to an organization or a publication.
-- ---------------------------------------------------------------------------
create table public.invitations (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  organization_id uuid references public.organizations(id) on delete cascade,
  publication_id  uuid,  -- fk added in 003_publications.sql
  role            text not null,  -- interpreted against organization_role or membership_role depending on which id is set
  token           text not null unique,
  status          invitation_status not null default 'pending',
  invited_by      uuid not null references public.profiles(id) on delete restrict,
  expires_at      timestamptz not null,
  created_at      timestamptz not null default now(),
  constraint invitations_target_check check (
    (organization_id is not null and publication_id is null) or
    (organization_id is null and publication_id is not null)
  )
);
comment on table public.invitations is 'Pending invitations to join an organization or a publication. Exactly one of organization_id / publication_id is set.';

create index idx_invitations_email on public.invitations(email);
create index idx_invitations_status on public.invitations(status);

-- ---------------------------------------------------------------------------
-- audit_logs
-- Append-only record of sensitive actions (role changes, publish actions,
-- review-status transitions). Hard-deleted never; no updated_at (immutable).
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  before      jsonb,
  after       jsonb,
  occurred_at timestamptz not null default now()
);
comment on table public.audit_logs is 'Append-only audit trail for sensitive actions across the platform (role changes, publish actions, review approvals).';

create index idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);
create index idx_audit_logs_actor on public.audit_logs(actor_id);
create index idx_audit_logs_occurred_at on public.audit_logs(occurred_at desc);

-- ---------------------------------------------------------------------------
-- Authorization helper functions
-- security definer so they can read membership tables regardless of the
-- calling user's own row-level access, which avoids RLS recursion when
-- these functions are used inside other tables' policies.
-- ---------------------------------------------------------------------------
create or replace function public.current_platform_role()
returns platform_role
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;
comment on function public.current_platform_role() is 'Returns the calling user''s platform_role, or null if not authenticated / no profile row.';

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_platform_editorial()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('super_admin','editor_in_chief','editor','researcher','writer','designer')
     from public.profiles where id = auth.uid()),
    false
  );
$$;
comment on function public.is_platform_editorial() is 'True if the calling user holds any editorial platform_role (not merely a subscriber).';

create or replace function public.publication_role(p_publication_id uuid)
returns membership_role
language sql stable security definer
set search_path = public
as $$
  select role from public.publication_members
  where publication_id = p_publication_id and user_id = auth.uid();
$$;
comment on function public.publication_role(uuid) is 'Returns the calling user''s membership_role on the given publication, or null if not a member.';

create or replace function public.is_publication_member(p_publication_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.publication_members
    where publication_id = p_publication_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_publication_editor_or_above(p_publication_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_super_admin() or coalesce(
    (select role in ('editor_in_chief','editor') from public.publication_members
     where publication_id = p_publication_id and user_id = auth.uid()),
    false
  );
$$;
comment on function public.is_publication_editor_or_above(uuid) is 'True for Super Admin, or a publication member with role editor_in_chief or editor.';

create or replace function public.is_organization_admin(p_organization_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.organization_members
     where organization_id = p_organization_id and user_id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.publication_members enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_logs enable row level security;

-- profiles: a user can read/update their own profile; editorial staff can
-- read all profiles (needed to render author names, assign roles); only
-- Super Admin can change another user's role.
create policy profiles_select_self on public.profiles
  for select using (id = auth.uid());

create policy profiles_select_editorial on public.profiles
  for select using (public.is_platform_editorial());

create policy profiles_update_self on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
comment on policy profiles_update_self on public.profiles is 'Users may update their own display fields but the with-check re-reads the stored role so this policy alone cannot be used to self-elevate; role changes go through profiles_update_role_admin.';

create policy profiles_update_role_admin on public.profiles
  for update using (public.is_super_admin())
  with check (public.is_super_admin());

-- organizations: members can read their organization; org admins manage it;
-- Super Admin manages all.
create policy organizations_select_member on public.organizations
  for select using (
    public.is_super_admin() or
    exists (select 1 from public.organization_members m where m.organization_id = id and m.user_id = auth.uid())
  );

create policy organizations_insert_authenticated on public.organizations
  for insert with check (auth.uid() is not null and created_by = auth.uid());

create policy organizations_update_admin on public.organizations
  for update using (public.is_super_admin() or public.is_organization_admin(id));

-- organization_members: members can see their own organization's roster;
-- org admins manage membership.
create policy organization_members_select on public.organization_members
  for select using (
    public.is_super_admin() or
    exists (select 1 from public.organization_members m2 where m2.organization_id = organization_id and m2.user_id = auth.uid())
  );

create policy organization_members_manage on public.organization_members
  for all using (public.is_super_admin() or public.is_organization_admin(organization_id))
  with check (public.is_super_admin() or public.is_organization_admin(organization_id));

-- publication_members: publication members can see their own roster;
-- editor_in_chief/editor/Super Admin manage it.
create policy publication_members_select on public.publication_members
  for select using (public.is_super_admin() or public.is_publication_member(publication_id));

create policy publication_members_manage on public.publication_members
  for all using (public.is_publication_editor_or_above(publication_id))
  with check (public.is_publication_editor_or_above(publication_id));

-- invitations: visible to the inviter, to org/publication admins, and to
-- Super Admin. No public read (token-based acceptance happens through a
-- server-side route using the service role, not direct client RLS access).
create policy invitations_select on public.invitations
  for select using (
    public.is_super_admin() or
    invited_by = auth.uid() or
    (organization_id is not null and public.is_organization_admin(organization_id)) or
    (publication_id is not null and public.is_publication_editor_or_above(publication_id))
  );

create policy invitations_manage on public.invitations
  for all using (
    public.is_super_admin() or
    (organization_id is not null and public.is_organization_admin(organization_id)) or
    (publication_id is not null and public.is_publication_editor_or_above(publication_id))
  )
  with check (
    public.is_super_admin() or
    (organization_id is not null and public.is_organization_admin(organization_id)) or
    (publication_id is not null and public.is_publication_editor_or_above(publication_id))
  );

-- audit_logs: read-only to Super Admin and Editor-in-Chief; writes happen
-- exclusively via server-side service-role calls (application layer), never
-- directly from the client, so no insert/update/delete policy is defined
-- for regular authenticated roles.
create policy audit_logs_select_admin on public.audit_logs
  for select using (public.is_super_admin() or public.current_platform_role() = 'editor_in_chief');

-- ============================================================
-- Source: 003_publications.sql
-- ============================================================
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

-- ============================================================
-- Source: 004_issue_builder.sql
-- ============================================================
-- =============================================================================
-- 004_issue_builder.sql
-- The Witness — Database Schema
-- Milestone 4: Issue Builder
-- =============================================================================

-- ---------------------------------------------------------------------------
-- issues
-- ---------------------------------------------------------------------------
create table public.issues (
  id             uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  title          text not null,
  slug           text not null,
  status         issue_status not null default 'draft',
  scheduled_at   timestamptz,
  published_at   timestamptz,
  created_by     uuid not null references public.profiles(id) on delete restrict,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  unique (publication_id, slug)
);
comment on table public.issues is 'A single edition of a publication. Status drives visibility: only published issues are readable by subscribers/anonymous readers.';

create trigger set_updated_at before update on public.issues
  for each row execute function public.set_updated_at();

create index idx_issues_publication on public.issues(publication_id);
create index idx_issues_status on public.issues(publication_id, status);
create index idx_issues_published_at on public.issues(published_at desc) where status = 'published';
create index idx_issues_scheduled on public.issues(scheduled_at) where status = 'scheduled';

-- ---------------------------------------------------------------------------
-- articles
-- Standalone pieces that are not tied to a specific issue edition (e.g. an
-- evergreen explainer). Shares the same section/block content model as
-- issues via a polymorphic-by-nullable-FK pattern on sections (see below).
-- ---------------------------------------------------------------------------
create table public.articles (
  id             uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  title          text not null,
  slug           text not null,
  status         issue_status not null default 'draft',
  published_at   timestamptz,
  created_by     uuid not null references public.profiles(id) on delete restrict,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  unique (publication_id, slug)
);
comment on table public.articles is 'A standalone article not tied to a specific issue edition. Uses the same section/block model as issues.';

create trigger set_updated_at before update on public.articles
  for each row execute function public.set_updated_at();

create index idx_articles_publication on public.articles(publication_id);
create index idx_articles_status on public.articles(publication_id, status);

-- ---------------------------------------------------------------------------
-- sections
-- Belongs to exactly one of issue or article (never both, never neither).
-- ---------------------------------------------------------------------------
create table public.sections (
  id          uuid primary key default gen_random_uuid(),
  issue_id    uuid references public.issues(id) on delete cascade,
  article_id  uuid references public.articles(id) on delete cascade,
  title       text,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint sections_single_parent_check check (
    (issue_id is not null and article_id is null) or
    (issue_id is null and article_id is not null)
  )
);
comment on table public.sections is 'Groups blocks within an issue or an article. Exactly one parent is set, enforced by sections_single_parent_check.';

create trigger set_updated_at before update on public.sections
  for each row execute function public.set_updated_at();

create index idx_sections_issue on public.sections(issue_id, position);
create index idx_sections_article on public.sections(article_id, position);

-- ---------------------------------------------------------------------------
-- blocks
-- The atomic, typed content unit. payload is validated per block_type at
-- the application layer against a JSON schema (Section 6.2 of the design
-- document) before being persisted; the database enforces shape only
-- loosely (payload must be a JSON object) to stay flexible across the
-- growing block type library.
-- ---------------------------------------------------------------------------
create table public.blocks (
  id            uuid primary key default gen_random_uuid(),
  section_id    uuid not null references public.sections(id) on delete cascade,
  type          block_type not null,
  position      integer not null default 0,
  payload       jsonb not null default '{}'::jsonb,
  ai_generated  boolean not null default false,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint blocks_payload_is_object check (jsonb_typeof(payload) = 'object')
);
comment on table public.blocks is 'Atomic, typed, ordered content unit within a section. ai_generated flags a block produced by the AI Workspace (Milestone 5) pending editorial review.';

create trigger set_updated_at before update on public.blocks
  for each row execute function public.set_updated_at();

create index idx_blocks_section on public.blocks(section_id, position);
create index idx_blocks_type on public.blocks(type);
create index idx_blocks_payload_gin on public.blocks using gin (payload jsonb_path_ops);

-- ---------------------------------------------------------------------------
-- issue_revisions
-- Immutable snapshots for version history / restore.
-- ---------------------------------------------------------------------------
create table public.issue_revisions (
  id          uuid primary key default gen_random_uuid(),
  issue_id    uuid not null references public.issues(id) on delete cascade,
  snapshot    jsonb not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
comment on table public.issue_revisions is 'Immutable full-content snapshot of an issue at a point in time, used for version history and restore.';

create index idx_issue_revisions_issue on public.issue_revisions(issue_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helper functions for content-visibility RLS
-- ---------------------------------------------------------------------------
create or replace function public.can_edit_issue(p_issue_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select case
    when public.is_super_admin() then true
    else exists (
      select 1 from public.issues i
      where i.id = p_issue_id and (
        public.is_publication_editor_or_above(i.publication_id) or
        (public.publication_role(i.publication_id) in ('writer','researcher') and i.created_by = auth.uid())
      )
    )
  end;
$$;
comment on function public.can_edit_issue(uuid) is 'True for Super Admin, publication editor_in_chief/editor, or the writer/researcher who authored the (still-draft) issue.';

create or replace function public.can_edit_article(p_article_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select case
    when public.is_super_admin() then true
    else exists (
      select 1 from public.articles a
      where a.id = p_article_id and (
        public.is_publication_editor_or_above(a.publication_id) or
        (public.publication_role(a.publication_id) in ('writer','researcher') and a.created_by = auth.uid())
      )
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.issues enable row level security;
alter table public.articles enable row level security;
alter table public.sections enable row level security;
alter table public.blocks enable row level security;
alter table public.issue_revisions enable row level security;

-- issues: publication members can read all issues in their publication
-- (drafts included, needed for the editorial pipeline view); public/
-- anonymous read of published issues is granted in 010_publishing_pipeline.sql.
create policy issues_select_member on public.issues
  for select using (public.is_super_admin() or public.is_publication_member(publication_id));

create policy issues_insert_member on public.issues
  for insert with check (
    public.is_super_admin() or
    public.publication_role(publication_id) in ('editor_in_chief','editor','writer','researcher')
  );

create policy issues_update_editor_or_owner on public.issues
  for update using (public.can_edit_issue(id));

create policy issues_delete_editor_or_above on public.issues
  for delete using (public.is_publication_editor_or_above(publication_id));

-- articles: mirrors issues.
create policy articles_select_member on public.articles
  for select using (public.is_super_admin() or public.is_publication_member(publication_id));

create policy articles_insert_member on public.articles
  for insert with check (
    public.is_super_admin() or
    public.publication_role(publication_id) in ('editor_in_chief','editor','writer','researcher')
  );

create policy articles_update_editor_or_owner on public.articles
  for update using (public.can_edit_article(id));

create policy articles_delete_editor_or_above on public.articles
  for delete using (public.is_publication_editor_or_above(publication_id));

-- sections: inherit access from the parent issue or article.
create policy sections_select on public.sections
  for select using (
    public.is_super_admin() or
    (issue_id is not null and exists (select 1 from public.issues i where i.id = issue_id and public.is_publication_member(i.publication_id))) or
    (article_id is not null and exists (select 1 from public.articles a where a.id = article_id and public.is_publication_member(a.publication_id)))
  );

create policy sections_manage on public.sections
  for all using (
    public.is_super_admin() or
    (issue_id is not null and public.can_edit_issue(issue_id)) or
    (article_id is not null and public.can_edit_article(article_id))
  )
  with check (
    public.is_super_admin() or
    (issue_id is not null and public.can_edit_issue(issue_id)) or
    (article_id is not null and public.can_edit_article(article_id))
  );

-- blocks: inherit access via their section's parent.
create policy blocks_select on public.blocks
  for select using (
    public.is_super_admin() or
    exists (
      select 1 from public.sections s
      where s.id = section_id and (
        (s.issue_id is not null and exists (select 1 from public.issues i where i.id = s.issue_id and public.is_publication_member(i.publication_id))) or
        (s.article_id is not null and exists (select 1 from public.articles a where a.id = s.article_id and public.is_publication_member(a.publication_id)))
      )
    )
  );

create policy blocks_manage on public.blocks
  for all using (
    public.is_super_admin() or
    exists (
      select 1 from public.sections s
      where s.id = section_id and (
        (s.issue_id is not null and public.can_edit_issue(s.issue_id)) or
        (s.article_id is not null and public.can_edit_article(s.article_id))
      )
    )
  )
  with check (
    public.is_super_admin() or
    exists (
      select 1 from public.sections s
      where s.id = section_id and (
        (s.issue_id is not null and public.can_edit_issue(s.issue_id)) or
        (s.article_id is not null and public.can_edit_article(s.article_id))
      )
    )
  );

-- issue_revisions: readable by anyone who can read the issue; written only
-- by the application layer (server-side), so no insert policy is granted
-- to the authenticated role — inserts happen via the service role.
create policy issue_revisions_select on public.issue_revisions
  for select using (
    public.is_super_admin() or
    exists (select 1 from public.issues i where i.id = issue_id and public.is_publication_member(i.publication_id))
  );

-- ============================================================
-- Source: 005_ai_workspace.sql
-- ============================================================
-- =============================================================================
-- 005_ai_workspace.sql
-- The Witness — Database Schema
-- Milestone 5: AI Workspace
-- =============================================================================

create table public.prompt_templates (
  id            uuid primary key default gen_random_uuid(),
  block_type    block_type not null,
  name          text not null,
  template_text text not null,
  variables     jsonb not null default '[]'::jsonb,  -- array of variable names the template expects
  is_active     boolean not null default true,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.prompt_templates is 'Reusable prompt templates keyed by block_type, composed by the AI Workspace Orchestrator into per-block generation requests.';

create trigger set_updated_at before update on public.prompt_templates
  for each row execute function public.set_updated_at();

create index idx_prompt_templates_block_type on public.prompt_templates(block_type) where is_active;

-- ---------------------------------------------------------------------------
-- ai_jobs
-- Durable, auditable record of every AI Workspace invocation. One row per
-- generation request; block_id is set for a single-block regenerate, null
-- for a full-issue generation (which itself fans out into multiple blocks
-- referenced via blocks.ai_generated / a job-scoped correlation captured in
-- result).
-- ---------------------------------------------------------------------------
create table public.ai_jobs (
  id             uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  issue_id       uuid references public.issues(id) on delete cascade,
  block_id       uuid references public.blocks(id) on delete set null,
  status         ai_job_status not null default 'pending',
  provider       ai_provider not null,
  model          text not null,
  params         jsonb not null default '{}'::jsonb,   -- audience, tone, depth, date range, output format
  prompt         text,
  result         jsonb,
  token_usage    jsonb,                                  -- {"input": n, "output": n}
  cost_usd       numeric(10,4),
  error          text,
  created_by     uuid not null references public.profiles(id) on delete restrict,
  created_at     timestamptz not null default now(),
  started_at     timestamptz,
  completed_at   timestamptz
);
comment on table public.ai_jobs is 'Durable, auditable record of every AI Workspace generation request, including provider/model, prompt, result, token usage, and cost. Never fire-and-forget.';

create index idx_ai_jobs_publication on public.ai_jobs(publication_id, created_at desc);
create index idx_ai_jobs_issue on public.ai_jobs(issue_id);
create index idx_ai_jobs_status on public.ai_jobs(status) where status in ('pending','running');

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.prompt_templates enable row level security;
alter table public.ai_jobs enable row level security;

-- prompt_templates: readable by any editorial staff (needed to preview what
-- will be generated); manageable by Super Admin only, since these directly
-- control AI output quality/cost platform-wide.
create policy prompt_templates_select_editorial on public.prompt_templates
  for select using (public.is_platform_editorial());

create policy prompt_templates_manage_super_admin on public.prompt_templates
  for all using (public.is_super_admin())
  with check (public.is_super_admin());

-- ai_jobs: scoped by publication membership; only writer-or-above roles can
-- trigger new generation (subscribers/readers never touch this table).
create policy ai_jobs_select_member on public.ai_jobs
  for select using (public.is_super_admin() or public.is_publication_member(publication_id));

create policy ai_jobs_insert_member on public.ai_jobs
  for insert with check (
    public.is_super_admin() or
    public.publication_role(publication_id) in ('editor_in_chief','editor','writer','researcher')
  );

-- Updates to job status/result happen from the server-side orchestrator via
-- the service role, not directly from an authenticated client, so no
-- update policy is granted here beyond Super Admin (useful for manual
-- intervention/cleanup).
create policy ai_jobs_update_super_admin on public.ai_jobs
  for update using (public.is_super_admin());

-- ============================================================
-- Source: 006_wisdom_engine.sql
-- ============================================================
-- =============================================================================
-- 006_wisdom_engine.sql
-- The Witness — Database Schema
-- Milestone 6: Wisdom Engine
-- =============================================================================

create table public.wisdom_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  description text,
  created_at  timestamptz not null default now()
);
comment on table public.wisdom_categories is 'Taxonomy for wisdom entries (e.g. Learning, Leadership, Ethics).';

-- ---------------------------------------------------------------------------
-- wisdom_entries
-- The umbrella structured record. Source-specific fields live in the
-- specialized child tables below (subhashitams / gita_verses /
-- advaita_principles), each of which has a 1:1 relationship back to its
-- parent wisdom_entries row.
-- ---------------------------------------------------------------------------
create table public.wisdom_entries (
  id             uuid primary key default gen_random_uuid(),
  category_id    uuid references public.wisdom_categories(id) on delete set null,
  title          text not null,
  source_type    wisdom_source_type not null,
  source_text    text,          -- original-language text, where applicable
  iast           text,          -- IAST transliteration
  translation    text not null,
  context        text,          -- source/context of the passage
  commentary     text,
  tech_lens      text,
  career_lens    text,
  leadership_lens text,
  decision_lens  text,
  keywords       text[] not null default '{}',
  references_json jsonb not null default '[]'::jsonb,
  review_status  wisdom_review_status not null default 'draft',
  reviewed_by    uuid references public.profiles(id) on delete set null,
  reviewed_at    timestamptz,
  created_by     uuid not null references public.profiles(id) on delete restrict,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
comment on table public.wisdom_entries is 'Structured, multi-lens wisdom entry. Only rows with review_status = approved may be attached to a published issue block (enforced at the application layer per design document Section 5.5/8; see also can_attach_wisdom_entry()).';

create trigger set_updated_at before update on public.wisdom_entries
  for each row execute function public.set_updated_at();

create index idx_wisdom_entries_category on public.wisdom_entries(category_id);
create index idx_wisdom_entries_review_status on public.wisdom_entries(review_status);
create index idx_wisdom_entries_keywords_gin on public.wisdom_entries using gin (keywords);

create table public.wisdom_reflection_questions (
  id              uuid primary key default gen_random_uuid(),
  wisdom_entry_id uuid not null references public.wisdom_entries(id) on delete cascade,
  question        text not null,
  position        integer not null default 0
);
create index idx_wisdom_reflection_questions_entry on public.wisdom_reflection_questions(wisdom_entry_id, position);

create table public.wisdom_exercises (
  id              uuid primary key default gen_random_uuid(),
  wisdom_entry_id uuid not null references public.wisdom_entries(id) on delete cascade,
  exercise        text not null,
  position        integer not null default 0
);
create index idx_wisdom_exercises_entry on public.wisdom_exercises(wisdom_entry_id, position);

-- ---------------------------------------------------------------------------
-- Specialized source tables (1:1 with wisdom_entries)
-- ---------------------------------------------------------------------------
create table public.subhashitams (
  wisdom_entry_id uuid primary key references public.wisdom_entries(id) on delete cascade,
  meter           text,       -- e.g. Anushtubh
  attributed_to   text
);
comment on table public.subhashitams is 'Source-specific fields for wisdom entries where source_type = subhashitam.';

create table public.gita_verses (
  wisdom_entry_id uuid primary key references public.wisdom_entries(id) on delete cascade,
  chapter         integer not null,
  verse           integer not null,
  constraint gita_verses_chapter_verse_unique unique (chapter, verse)
);
comment on table public.gita_verses is 'Source-specific fields for wisdom entries where source_type = gita_verse.';

create table public.advaita_principles (
  wisdom_entry_id uuid primary key references public.wisdom_entries(id) on delete cascade,
  source_work     text,       -- e.g. "Vivekachudamani"
  tradition_note  text
);
comment on table public.advaita_principles is 'Source-specific fields for wisdom entries where source_type = advaita_principle.';

-- ---------------------------------------------------------------------------
-- Helper function
-- ---------------------------------------------------------------------------
create or replace function public.is_approved_wisdom_entry(p_wisdom_entry_id uuid)
returns boolean
language sql stable
as $$
  select coalesce((select review_status = 'approved' from public.wisdom_entries where id = p_wisdom_entry_id), false);
$$;
comment on function public.is_approved_wisdom_entry(uuid) is 'Used by the application layer to gate attaching a wisdom entry to a Today''s Wisdom / Reflection block; only approved entries should be attached to a block destined for publication.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.wisdom_categories enable row level security;
alter table public.wisdom_entries enable row level security;
alter table public.wisdom_reflection_questions enable row level security;
alter table public.wisdom_exercises enable row level security;
alter table public.subhashitams enable row level security;
alter table public.gita_verses enable row level security;
alter table public.advaita_principles enable row level security;

-- wisdom_categories: public read (used to power browse/filter UI even for
-- anonymous readers of published wisdom content); managed by editorial staff.
create policy wisdom_categories_select_all on public.wisdom_categories
  for select using (true);

create policy wisdom_categories_manage_editorial on public.wisdom_categories
  for all using (public.is_platform_editorial())
  with check (public.is_platform_editorial());

-- wisdom_entries: approved entries are readable by anyone (they may be
-- attached to public content); draft/in_review entries are visible only to
-- editorial staff, so unapproved translations are never exposed publicly.
create policy wisdom_entries_select_approved on public.wisdom_entries
  for select using (review_status = 'approved' or public.is_platform_editorial());

create policy wisdom_entries_insert_editorial on public.wisdom_entries
  for insert with check (public.is_platform_editorial());

create policy wisdom_entries_update_author_or_reviewer on public.wisdom_entries
  for update using (
    public.is_super_admin() or
    created_by = auth.uid() or
    public.current_platform_role() in ('editor_in_chief','editor')
  );

create policy wisdom_entries_delete_editorial on public.wisdom_entries
  for delete using (public.current_platform_role() in ('editor_in_chief','editor') or public.is_super_admin());

-- Child tables inherit visibility from their parent wisdom_entries row.
create policy wisdom_reflection_questions_select on public.wisdom_reflection_questions
  for select using (exists (
    select 1 from public.wisdom_entries w where w.id = wisdom_entry_id
    and (w.review_status = 'approved' or public.is_platform_editorial())
  ));
create policy wisdom_reflection_questions_manage on public.wisdom_reflection_questions
  for all using (public.is_platform_editorial()) with check (public.is_platform_editorial());

create policy wisdom_exercises_select on public.wisdom_exercises
  for select using (exists (
    select 1 from public.wisdom_entries w where w.id = wisdom_entry_id
    and (w.review_status = 'approved' or public.is_platform_editorial())
  ));
create policy wisdom_exercises_manage on public.wisdom_exercises
  for all using (public.is_platform_editorial()) with check (public.is_platform_editorial());

create policy subhashitams_select on public.subhashitams
  for select using (exists (
    select 1 from public.wisdom_entries w where w.id = wisdom_entry_id
    and (w.review_status = 'approved' or public.is_platform_editorial())
  ));
create policy subhashitams_manage on public.subhashitams
  for all using (public.is_platform_editorial()) with check (public.is_platform_editorial());

create policy gita_verses_select on public.gita_verses
  for select using (exists (
    select 1 from public.wisdom_entries w where w.id = wisdom_entry_id
    and (w.review_status = 'approved' or public.is_platform_editorial())
  ));
create policy gita_verses_manage on public.gita_verses
  for all using (public.is_platform_editorial()) with check (public.is_platform_editorial());

create policy advaita_principles_select on public.advaita_principles
  for select using (exists (
    select 1 from public.wisdom_entries w where w.id = wisdom_entry_id
    and (w.review_status = 'approved' or public.is_platform_editorial())
  ));
create policy advaita_principles_manage on public.advaita_principles
  for all using (public.is_platform_editorial()) with check (public.is_platform_editorial());

-- ============================================================
-- Source: 007_knowledge_graph.sql
-- ============================================================
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

-- ============================================================
-- Source: 008_search.sql
-- ============================================================
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

-- ============================================================
-- Source: 009_analytics.sql
-- ============================================================
-- =============================================================================
-- 009_analytics.sql
-- The Witness — Database Schema
-- Milestone 9: Analytics
-- =============================================================================

create table public.analytics_events (
  id             uuid primary key default gen_random_uuid(),
  event_type     text not null,             -- e.g. 'issue_view', 'article_view', 'email_open', 'email_click', 'wisdom_view'
  entity_type    reference_entity_type,
  entity_id      uuid,
  user_id        uuid references public.profiles(id) on delete set null,
  publication_id uuid references public.publications(id) on delete cascade,
  metadata       jsonb not null default '{}'::jsonb,
  occurred_at    timestamptz not null default now()
);
comment on table public.analytics_events is 'Raw event capture. High write volume — see 011_seed_data.sql notes and the scalability section for the partitioning plan applied ahead of Milestone 11.';

create index idx_analytics_events_publication_time on public.analytics_events(publication_id, occurred_at desc);
create index idx_analytics_events_entity on public.analytics_events(entity_type, entity_id);
create index idx_analytics_events_type on public.analytics_events(event_type);

-- ---------------------------------------------------------------------------
-- Materialized views: daily publication metrics and content engagement.
-- Refreshed on a schedule (pg_cron) rather than computed live per request.
-- ---------------------------------------------------------------------------
create materialized view public.daily_publication_metrics as
select
  publication_id,
  date_trunc('day', occurred_at) as day,
  count(*) filter (where event_type = 'issue_view') as issue_views,
  count(*) filter (where event_type = 'article_view') as article_views,
  count(*) filter (where event_type = 'email_open') as email_opens,
  count(*) filter (where event_type = 'email_click') as email_clicks,
  count(distinct user_id) as unique_active_users
from public.analytics_events
group by publication_id, date_trunc('day', occurred_at);

create unique index idx_daily_publication_metrics_pk on public.daily_publication_metrics(publication_id, day);

create materialized view public.content_engagement_summary as
select
  entity_type,
  entity_id,
  count(*) as total_events,
  count(*) filter (where event_type in ('issue_view','article_view')) as views,
  max(occurred_at) as last_event_at
from public.analytics_events
where entity_type is not null
group by entity_type, entity_id;

create unique index idx_content_engagement_summary_pk on public.content_engagement_summary(entity_type, entity_id);

comment on materialized view public.daily_publication_metrics is 'Refreshed on a schedule via pg_cron (see 011_seed_data.sql / operational notes). Backs the Analytics Dashboard overview.';
comment on materialized view public.content_engagement_summary is 'Refreshed on a schedule via pg_cron. Backs the Content Performance view and most-read/most-engaged rankings.';

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null,
  payload    jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notifications_user on public.notifications(user_id, read_at);

-- ---------------------------------------------------------------------------
-- settings
-- Key-value configuration store, optionally scoped to a publication
-- (publication_id null = platform-global setting, e.g. default AI provider).
-- ---------------------------------------------------------------------------
create table public.settings (
  id             uuid primary key default gen_random_uuid(),
  publication_id uuid references public.publications(id) on delete cascade,
  key            text not null,
  value          jsonb not null,
  updated_at     timestamptz not null default now(),
  unique (publication_id, key)
);
comment on table public.settings is 'Key-value configuration, e.g. default AI provider/model (publication_id null = platform-wide) or per-publication overrides.';

create trigger set_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.analytics_events enable row level security;
alter table public.notifications enable row level security;
alter table public.settings enable row level security;

-- analytics_events: reads scoped by publication membership and role;
-- writes happen exclusively via a server-side service role (event capture
-- endpoint), never directly from an authenticated client, so no insert
-- policy is granted to the authenticated role.
create policy analytics_events_select_member on public.analytics_events
  for select using (public.is_super_admin() or public.is_publication_member(publication_id));

-- notifications: a user only ever sees their own.
create policy notifications_select_self on public.notifications
  for select using (user_id = auth.uid());
create policy notifications_update_self on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- settings: platform-global settings (publication_id is null) are Super
-- Admin only; publication-scoped settings follow editor-or-above.
create policy settings_select on public.settings
  for select using (
    public.is_super_admin() or
    (publication_id is not null and public.is_publication_member(publication_id))
  );
create policy settings_manage on public.settings
  for all using (
    public.is_super_admin() or
    (publication_id is not null and public.is_publication_editor_or_above(publication_id))
  )
  with check (
    public.is_super_admin() or
    (publication_id is not null and public.is_publication_editor_or_above(publication_id))
  );

-- Materialized views do not support RLS directly; access is governed by
-- wrapping API functions (security invoker) that filter by publication_id
-- before returning rows, applied at the application layer per the design
-- document's data-privacy section. No grant to anon/authenticated is made
-- on the materialized views themselves.
revoke all on public.daily_publication_metrics from public, anon, authenticated;
revoke all on public.content_engagement_summary from public, anon, authenticated;

-- ============================================================
-- Source: 010_publishing_pipeline.sql
-- ============================================================
-- =============================================================================
-- 010_publishing_pipeline.sql
-- The Witness — Database Schema
-- Milestone 10: Publishing Pipeline
-- =============================================================================

-- ---------------------------------------------------------------------------
-- subscribers
-- Distinct from profiles: a subscriber may exist purely as an email
-- address (never signs in) or may be linked to a profile once they create
-- an account. This mirrors real-world newsletter subscriber lifecycles.
-- ---------------------------------------------------------------------------
create table public.subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  profile_id  uuid references public.profiles(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  created_at  timestamptz not null default now()
);
comment on table public.subscribers is 'A subscriber identity, keyed by email. May optionally link to a platform login (profile_id) and/or an enterprise/university organization seat.';

create index idx_subscribers_profile on public.subscribers(profile_id);
create index idx_subscribers_organization on public.subscribers(organization_id);

create table public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  subscriber_id   uuid not null references public.subscribers(id) on delete cascade,
  publication_id  uuid not null references public.publications(id) on delete cascade,
  status          subscription_status not null default 'active',
  subscribed_at   timestamptz not null default now(),
  unsubscribed_at timestamptz,
  unique (subscriber_id, publication_id)
);
comment on table public.subscriptions is 'A subscriber''s status on a specific publication.';

create index idx_subscriptions_publication_status on public.subscriptions(publication_id, status);
create index idx_subscriptions_subscriber on public.subscriptions(subscriber_id);

-- ---------------------------------------------------------------------------
-- delivery_logs
-- ---------------------------------------------------------------------------
create table public.delivery_logs (
  id            uuid primary key default gen_random_uuid(),
  issue_id      uuid not null references public.issues(id) on delete cascade,
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  channel       delivery_channel not null,
  status        delivery_status not null default 'queued',
  sent_at       timestamptz,
  opened_at     timestamptz,
  clicked_at    timestamptz,
  error         text,
  created_at    timestamptz not null default now()
);
comment on table public.delivery_logs is 'Per-subscriber, per-channel delivery status for a published issue. Populated by the send pipeline and updated by inbound ESP webhook events.';

create index idx_delivery_logs_issue on public.delivery_logs(issue_id, status);
create index idx_delivery_logs_subscriber on public.delivery_logs(subscriber_id);

-- ---------------------------------------------------------------------------
-- scheduled_jobs
-- Generic scheduled-publish execution record, following the same
-- job-tracking pattern established by ai_jobs (Migration 005).
-- ---------------------------------------------------------------------------
create table public.scheduled_jobs (
  id           uuid primary key default gen_random_uuid(),
  issue_id     uuid not null references public.issues(id) on delete cascade,
  run_at       timestamptz not null,
  status       scheduled_job_status not null default 'pending',
  error        text,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);
comment on table public.scheduled_jobs is 'Tracks scheduled-publish execution for an issue, invoked by pg_cron / an external scheduler.';

create index idx_scheduled_jobs_run_at on public.scheduled_jobs(run_at) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Public (anonymous) read access to published content.
-- This is the one place in the schema where anonymous users are granted
-- direct read access, and it is deliberately narrow: only rows where
-- status = 'published' (issues/articles) or review_status = 'approved'
-- (wisdom_entries, already granted in 006) are visible. Draft and
-- in-review content remains invisible to anon regardless of these policies
-- because the *_select_member policies from earlier migrations only ever
-- matched authenticated publication members.
-- ---------------------------------------------------------------------------
create policy issues_select_public_published on public.issues
  for select using (status = 'published' and deleted_at is null);

create policy articles_select_public_published on public.articles
  for select using (status = 'published' and deleted_at is null);

create policy sections_select_public_published on public.sections
  for select using (
    (issue_id is not null and exists (select 1 from public.issues i where i.id = issue_id and i.status = 'published' and i.deleted_at is null)) or
    (article_id is not null and exists (select 1 from public.articles a where a.id = article_id and a.status = 'published' and a.deleted_at is null))
  );

create policy blocks_select_public_published on public.blocks
  for select using (
    exists (
      select 1 from public.sections s
      where s.id = section_id and (
        (s.issue_id is not null and exists (select 1 from public.issues i where i.id = s.issue_id and i.status = 'published' and i.deleted_at is null)) or
        (s.article_id is not null and exists (select 1 from public.articles a where a.id = s.article_id and a.status = 'published' and a.deleted_at is null))
      )
    )
  );

create policy publications_select_public_active on public.publications
  for select using (status = 'active');

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.subscribers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.delivery_logs enable row level security;
alter table public.scheduled_jobs enable row level security;

-- subscribers: a person can read/update their own subscriber record (once
-- linked to their profile via profile_id); publication editors can read
-- subscriber records for their own publication's subscriptions (via a
-- join, not directly on this table, so no broad editorial select policy is
-- added here beyond Super Admin); org admins can see their org's seats.
create policy subscribers_select_self on public.subscribers
  for select using (public.is_super_admin() or profile_id = auth.uid());

create policy subscribers_select_org_admin on public.subscribers
  for select using (organization_id is not null and public.is_organization_admin(organization_id));

create policy subscribers_update_self on public.subscribers
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Public subscribe flow (creating a subscriber + subscription row for an
-- email that has no session) is handled via a server-side route using the
-- service role, not direct anon insert, so no anon insert policy is
-- granted on subscribers or subscriptions.

-- subscriptions: subscriber can see/manage their own; publication
-- editor-or-above can see subscriptions to their publication (for
-- analytics and support).
create policy subscriptions_select_self on public.subscriptions
  for select using (
    public.is_super_admin() or
    exists (select 1 from public.subscribers s where s.id = subscriber_id and s.profile_id = auth.uid()) or
    public.is_publication_editor_or_above(publication_id)
  );

create policy subscriptions_update_self on public.subscriptions
  for update using (
    exists (select 1 from public.subscribers s where s.id = subscriber_id and s.profile_id = auth.uid())
  );

-- delivery_logs: publication editor-or-above only (operational visibility);
-- not exposed to individual subscribers to avoid leaking send-infrastructure
-- detail, consistent with the data-minimization principle in the design
-- document Section 7.4.
create policy delivery_logs_select_editor_or_above on public.delivery_logs
  for select using (
    public.is_super_admin() or
    exists (select 1 from public.issues i where i.id = issue_id and public.is_publication_editor_or_above(i.publication_id))
  );

-- scheduled_jobs: publication editor-or-above only.
create policy scheduled_jobs_select_editor_or_above on public.scheduled_jobs
  for select using (
    public.is_super_admin() or
    exists (select 1 from public.issues i where i.id = issue_id and public.is_publication_editor_or_above(i.publication_id))
  );

-- ============================================================
-- Source: 011_grants_and_realtime.sql
-- ============================================================
-- =============================================================================
-- 011_grants_and_realtime.sql
-- The Witness — Database Schema
-- Supabase-specific plumbing: role grants and Realtime publication.
--
-- Row Level Security policies (Migrations 002–010) control which *rows* a
-- role can see or change. Postgres separately requires table-level
-- privileges before RLS is even consulted. On Supabase projects created via
-- the dashboard this is normally handled by platform-managed default
-- privileges; this migration makes those grants explicit so the schema is
-- fully self-contained and reproducible via the CLI / migration pipeline
-- alone, independent of dashboard defaults.
-- =============================================================================

grant usage on schema public to anon, authenticated;

-- Table privileges: broad grant to anon/authenticated is safe because RLS
-- (enabled on every table in Migrations 002–010) is the actual access
-- control; a role with an unopened policy set for a given operation still
-- cannot read/write rows even after this GRANT. service_role bypasses RLS
-- entirely by design (used only by trusted server-side code).
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to authenticated, anon;
grant execute on all functions in schema public to authenticated, anon;

-- Ensure the same grants apply automatically to tables added by future
-- migrations, without needing to remember to repeat this step.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, anon;
alter default privileges in schema public
  grant execute on functions to authenticated, anon;

-- service_role: full access, bypasses RLS (Supabase platform behavior for
-- this role). Used exclusively by server-side code (API routes, Edge
-- Functions, scheduled jobs) — never exposed to the browser.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Realtime
-- Enable Realtime change broadcasting on the tables the design document
-- calls out for live UI updates: AI job status (Milestone 5), delivery
-- status (Milestone 10), and issue collaborative presence (Milestone 4).
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.ai_jobs;
alter publication supabase_realtime add table public.delivery_logs;
alter publication supabase_realtime add table public.issues;

comment on table public.ai_jobs is 'Durable, auditable record of every AI Workspace generation request, including provider/model, prompt, result, token usage, and cost. Realtime-enabled so the Issue Builder can subscribe to live job status.';

-- ============================================================
-- Source: 012_seed_data.sql
-- ============================================================
-- =============================================================================
-- 012_seed_data.sql
-- The Witness — Database Schema
-- Seed data for local development and staging. NOT intended for production
-- (production starts empty except for reference taxonomy rows explicitly
-- marked below). Uses fixed UUIDs so seed data is idempotent and
-- cross-references are readable in this file.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Reference taxonomy — safe/appropriate to seed in every environment,
-- including production, since these are platform configuration rather
-- than editorial content.
-- ---------------------------------------------------------------------------
insert into public.wisdom_categories (id, name, slug, description) values
  ('00000000-0000-0000-0000-000000000101', 'Learning', 'learning', 'Lifelong learning and the discipline of study.'),
  ('00000000-0000-0000-0000-000000000102', 'Leadership', 'leadership', 'Guiding others and holding responsibility well.'),
  ('00000000-0000-0000-0000-000000000103', 'Ethics', 'ethics', 'Right action and discernment.'),
  ('00000000-0000-0000-0000-000000000104', 'Decision-Making', 'decision-making', 'Clarity under uncertainty.'),
  ('00000000-0000-0000-0000-000000000105', 'Career', 'career', 'Professional growth and vocation.')
on conflict (id) do nothing;

insert into public.tags (id, name, slug) values
  ('00000000-0000-0000-0000-000000000201', 'Artificial Intelligence', 'artificial-intelligence'),
  ('00000000-0000-0000-0000-000000000202', 'Cloud', 'cloud'),
  ('00000000-0000-0000-0000-000000000203', 'Cybersecurity', 'cybersecurity'),
  ('00000000-0000-0000-0000-000000000204', 'Career Development', 'career-development')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Development-only seed data below this line. Guarded so it never runs
-- against a database that already has real users/publications — this
-- migration is written to be safe to include in the standard migration
-- chain for every environment, but the actual insertion of demo content is
-- skipped automatically once genuine data exists.
-- ---------------------------------------------------------------------------
do $$
declare
  v_should_seed boolean;
  v_admin_user_id uuid := '00000000-0000-0000-0000-000000000001';
  v_editor_user_id uuid := '00000000-0000-0000-0000-000000000002';
  v_writer_user_id uuid := '00000000-0000-0000-0000-000000000003';
  v_publication_id uuid := '00000000-0000-0000-0000-000000000301';
  v_issue_id uuid := '00000000-0000-0000-0000-000000000401';
  v_section_id uuid := '00000000-0000-0000-0000-000000000501';
  v_technology_id uuid := '00000000-0000-0000-0000-000000000601';
  v_company_id uuid := '00000000-0000-0000-0000-000000000701';
  v_wisdom_entry_id uuid := '00000000-0000-0000-0000-000000000801';
begin
  select not exists (select 1 from public.publications) into v_should_seed;
  if not v_should_seed then
    raise notice 'Skipping development seed data: publications table already has rows.';
    return;
  end if;

  -- Demo auth users (local/dev only — a real Supabase project populates
  -- auth.users via the Auth API, never via direct insert in production).
  insert into auth.users (id, email) values
    (v_admin_user_id, 'admin@example.com'),
    (v_editor_user_id, 'editor@example.com'),
    (v_writer_user_id, 'writer@example.com')
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role) values
    (v_admin_user_id, 'Ada Admin', 'super_admin'),
    (v_editor_user_id, 'Eve Editor', 'editor_in_chief'),
    (v_writer_user_id, 'Wes Writer', 'writer')
  on conflict (id) do nothing;

  insert into public.publications (id, name, slug, description, cadence, status, created_by) values
    (v_publication_id, 'The Witness', 'the-witness', '48-hour technology intelligence.', '48h', 'active', v_admin_user_id)
  on conflict (id) do nothing;

  insert into public.publication_members (publication_id, user_id, role) values
    (v_publication_id, v_editor_user_id, 'editor_in_chief'),
    (v_publication_id, v_writer_user_id, 'writer')
  on conflict do nothing;

  insert into public.issues (id, publication_id, title, slug, status, created_by) values
    (v_issue_id, v_publication_id, 'Welcome to The Witness', 'welcome-to-the-witness', 'draft', v_writer_user_id)
  on conflict (id) do nothing;

  insert into public.sections (id, issue_id, title, position) values
    (v_section_id, v_issue_id, 'Opening', 0)
  on conflict (id) do nothing;

  insert into public.blocks (section_id, type, position, payload, created_by) values
    (v_section_id, 'heading', 0, '{"text": "Know the Signals. Ignore the Noise."}'::jsonb, v_writer_user_id),
    (v_section_id, 'paragraph', 1, '{"text": "This is the first issue of The Witness, seeded for local development."}'::jsonb, v_writer_user_id)
  on conflict do nothing;

  insert into public.technologies (id, name, slug, category, description) values
    (v_technology_id, 'Retrieval-Augmented Generation', 'retrieval-augmented-generation', 'AI', 'Combining LLM generation with retrieval over an external knowledge source.')
  on conflict (id) do nothing;

  insert into public.companies (id, name, slug, description) values
    (v_company_id, 'Example AI Labs', 'example-ai-labs', 'A placeholder company record for local development.')
  on conflict (id) do nothing;

  insert into public.wisdom_entries (
    id, category_id, title, source_type, translation, context, commentary,
    tech_lens, career_lens, leadership_lens, decision_lens,
    review_status, reviewed_by, created_by
  ) values (
    v_wisdom_entry_id,
    '00000000-0000-0000-0000-000000000104',
    'Act without attachment to outcome',
    'gita_verse',
    'You have a right to your actions, but never to the fruits of your actions.',
    'Bhagavad G\u012Bt\u0101, Chapter 2.',
    'A reminder to focus on doing the work well rather than fixating on results, which sharpens judgment under uncertainty.',
    'Ship the best work you can with the information available; do not let fear of an uncertain outcome stall a well-reasoned decision.',
    'Do the work that is yours to do; a promotion or outcome is not fully within your control.',
    'Make the right call for the team even when credit or blame is uncertain.',
    'Separates the quality of a decision from the quality of its result — useful when evaluating decisions retrospectively.',
    'approved',
    v_editor_user_id,
    v_editor_user_id
  )
  on conflict (id) do nothing;

  insert into public.gita_verses (wisdom_entry_id, chapter, verse) values
    (v_wisdom_entry_id, 2, 47)
  on conflict (wisdom_entry_id) do nothing;

  raise notice 'Development seed data inserted.';
end $$;

-- ============================================================
-- Source: 013_rbac_and_audit.sql
-- ============================================================
-- =============================================================================
-- 013_rbac_and_audit.sql
-- The Witness — Database Schema
-- Milestone 2: Authentication and User Management
--
-- Two changes:
--   1. Updates platform_role and membership_role to the role set finalized
--      for this milestone: adds premium_subscriber, removes designer (not
--      part of the finalized RBAC role list). Postgres enums can't drop a
--      value in place, so both types are recreated using the standard
--      rename-create-migrate-drop pattern, safe to run against a database
--      that already has rows (any existing 'designer' value is remapped
--      to 'writer' during the column type change, rather than erroring).
--   2. Adds the audit-logging triggers that 002_identity_and_access.sql
--      reserved audit_logs for but did not yet populate — every role
--      change on profiles, organization_members, and publication_members
--      now writes an audit_logs row automatically, not only when
--      application code remembers to call an API.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1a. platform_role: recreate without 'designer', with 'premium_subscriber'
--
-- current_platform_role() and publication_role(uuid) (002_identity_and_
-- access.sql) declare platform_role/membership_role as their RETURNS type,
-- which Postgres records as a hard catalog dependency — CREATE OR REPLACE
-- cannot change a function's return type, and the enum can't be dropped
-- while a function still returns it. Both are dropped here and recreated
-- against the new type further down.
--
-- RLS policies that CALL these functions also register a catalog
-- dependency on them (confirmed by testing this migration against a live
-- database, not assumed) — every one of the 7 affected policies is
-- dropped here and recreated verbatim (identical logic, unchanged from
-- their original migration) once the functions exist again below.
-- ---------------------------------------------------------------------------
drop policy audit_logs_select_admin on public.audit_logs;
drop policy publications_insert_editorial on public.publications;
drop policy wisdom_entries_update_author_or_reviewer on public.wisdom_entries;
drop policy wisdom_entries_delete_editorial on public.wisdom_entries;
drop policy issues_insert_member on public.issues;
drop policy articles_insert_member on public.articles;
drop policy ai_jobs_insert_member on public.ai_jobs;
-- References profiles.role directly in its WITH CHECK clause (not merely
-- via a function call), which blocks ALTER COLUMN ... TYPE the same way a
-- function-level dependency does — confirmed by testing, not assumed.
drop policy profiles_update_self on public.profiles;

drop function public.current_platform_role();
drop function public.publication_role(uuid);

alter type platform_role rename to platform_role_old;

create type platform_role as enum (
  'super_admin',
  'editor_in_chief',
  'editor',
  'writer',
  'researcher',
  'subscriber',
  'premium_subscriber'
);
comment on type platform_role is 'Global role stored on profiles. Finalized role set per Milestone 2 (Authentication and User Management). Organization-scoped administration is modeled separately via organization_members.role = admin, not as a platform_role value — see Design System / RBAC documentation for the rationale.';

alter table public.profiles
  alter column role drop default,
  alter column role type platform_role
    using (case when role::text = 'designer' then 'writer' else role::text end)::platform_role,
  alter column role set default 'subscriber';

drop type platform_role_old;

-- ---------------------------------------------------------------------------
-- 1b. membership_role: recreate without 'designer'
-- ---------------------------------------------------------------------------
alter type membership_role rename to membership_role_old;

create type membership_role as enum (
  'editor_in_chief',
  'editor',
  'writer',
  'researcher'
);
comment on type membership_role is 'Role a user holds within a specific publication. Finalized role set per Milestone 2 — see platform_role comment for the parallel change.';

alter table public.publication_members
  alter column role type membership_role
    using (case when role::text = 'designer' then 'writer' else role::text end)::membership_role;

drop type membership_role_old;

-- ---------------------------------------------------------------------------
-- 1c. Recreate the two functions dropped in step 1a, now against the new
-- types. Bodies are unchanged from 002_identity_and_access.sql.
-- ---------------------------------------------------------------------------
create or replace function public.current_platform_role()
returns platform_role
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;
comment on function public.current_platform_role() is 'Returns the calling user''s platform_role, or null if not authenticated / no profile row.';

create or replace function public.publication_role(p_publication_id uuid)
returns membership_role
language sql stable security definer
set search_path = public
as $$
  select role from public.publication_members
  where publication_id = p_publication_id and user_id = auth.uid();
$$;
comment on function public.publication_role(uuid) is 'Returns the calling user''s membership_role on the given publication, or null if not a member.';

-- ---------------------------------------------------------------------------
-- 1d. Recreate the 8 policies dropped in step 1a — identical logic to
-- their original definitions in 002/003/004/005/006, unchanged.
-- ---------------------------------------------------------------------------
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
comment on policy profiles_update_self on public.profiles is 'Users may update their own display fields but the with-check re-reads the stored role so this policy alone cannot be used to self-elevate; role changes go through profiles_update_role_admin.';

create policy audit_logs_select_admin on public.audit_logs
  for select using (public.is_super_admin() or public.current_platform_role() = 'editor_in_chief');

create policy publications_insert_editorial on public.publications
  for insert with check (public.is_super_admin() or public.current_platform_role() = 'editor_in_chief');

create policy wisdom_entries_update_author_or_reviewer on public.wisdom_entries
  for update using (
    public.is_super_admin() or
    created_by = auth.uid() or
    public.current_platform_role() in ('editor_in_chief','editor')
  );

create policy wisdom_entries_delete_editorial on public.wisdom_entries
  for delete using (public.current_platform_role() in ('editor_in_chief','editor') or public.is_super_admin());

create policy issues_insert_member on public.issues
  for insert with check (
    public.is_super_admin() or
    public.publication_role(publication_id) in ('editor_in_chief','editor','writer','researcher')
  );

create policy articles_insert_member on public.articles
  for insert with check (
    public.is_super_admin() or
    public.publication_role(publication_id) in ('editor_in_chief','editor','writer','researcher')
  );

create policy ai_jobs_insert_member on public.ai_jobs
  for insert with check (
    public.is_super_admin() or
    public.publication_role(publication_id) in ('editor_in_chief','editor','writer','researcher')
  );

-- ---------------------------------------------------------------------------
-- 2. Audit logging triggers
--
-- Fires on UPDATE where the tracked column actually changed (not on every
-- update to the row), and on INSERT for membership grants / DELETE for
-- membership revocations, so the audit trail reads as a real history of
-- "who changed what" rather than a noisy log of unrelated field edits.
-- actor_id is read from the Postgres session's request.jwt.claim.sub GUC,
-- the same mechanism auth.uid() itself resolves from — set by whichever
-- authenticated Supabase session executes the statement. When a change is
-- made by the service role (no end-user session, e.g. a backend job),
-- actor_id is left null rather than guessed at.
-- ---------------------------------------------------------------------------
create or replace function public.current_actor_id()
returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
comment on function public.current_actor_id() is 'Resolves the acting user for audit_logs the same way auth.uid() resolves the RLS-checked user. Null when executed by the service role or another non-session context.';

create or replace function public.audit_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
    values (
      public.current_actor_id(),
      'role_changed',
      'profiles',
      new.id,
      jsonb_build_object('role', old.role),
      jsonb_build_object('role', new.role)
    );
  end if;
  return new;
end;
$$;

create trigger audit_profile_role_change
  after update on public.profiles
  for each row execute function public.audit_profile_role_change();

create or replace function public.audit_organization_membership_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
    values (public.current_actor_id(), 'organization_member_added', 'organization_members', new.organization_id,
      jsonb_build_object('user_id', new.user_id, 'role', new.role));
    return new;
  elsif tg_op = 'UPDATE' and new.role is distinct from old.role then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
    values (public.current_actor_id(), 'organization_member_role_changed', 'organization_members', new.organization_id,
      jsonb_build_object('user_id', old.user_id, 'role', old.role),
      jsonb_build_object('user_id', new.user_id, 'role', new.role));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, before)
    values (public.current_actor_id(), 'organization_member_removed', 'organization_members', old.organization_id,
      jsonb_build_object('user_id', old.user_id, 'role', old.role));
    return old;
  end if;
  return new;
end;
$$;

create trigger audit_organization_membership_change
  after insert or update or delete on public.organization_members
  for each row execute function public.audit_organization_membership_change();

create or replace function public.audit_publication_membership_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
    values (public.current_actor_id(), 'publication_member_added', 'publication_members', new.publication_id,
      jsonb_build_object('user_id', new.user_id, 'role', new.role));
    return new;
  elsif tg_op = 'UPDATE' and new.role is distinct from old.role then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
    values (public.current_actor_id(), 'publication_member_role_changed', 'publication_members', new.publication_id,
      jsonb_build_object('user_id', old.user_id, 'role', old.role),
      jsonb_build_object('user_id', new.user_id, 'role', new.role));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, before)
    values (public.current_actor_id(), 'publication_member_removed', 'publication_members', old.publication_id,
      jsonb_build_object('user_id', old.user_id, 'role', old.role));
    return old;
  end if;
  return new;
end;
$$;

create trigger audit_publication_membership_change
  after insert or update or delete on public.publication_members
  for each row execute function public.audit_publication_membership_change();

-- ---------------------------------------------------------------------------
-- 3. Auto-create a profile row when a new auth.users row is created.
--
-- Without this, a user who completes Supabase Auth sign-up has no
-- public.profiles row until something else creates one — which is exactly
-- the race the dashboard layout's defensive .single() read (Milestone 1)
-- was written to tolerate, but it's better to close the race than merely
-- tolerate it. full_name is read from the sign-up form's options.data
-- payload (see src/components/auth/sign-up-form.tsx), falling back to null.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data ->> 'full_name', 'subscriber')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- 4. RLS: audit_logs currently has no insert policy for the authenticated
-- role by design (002_identity_and_access.sql) — the triggers above insert
-- via security definer, which bypasses RLS on the trigger's own insert
-- regardless. No policy change needed; this comment documents why that
-- insert succeeds despite no authenticated-role insert policy existing.
-- ---------------------------------------------------------------------------

-- ============================================================
-- Source: 014_publication_management.sql
-- ============================================================
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
comment on column storage.buckets.file_size_limit is 'publication-logos capped at 2MB — logos are UI chrome, not editorial media; the general media library (Milestone 4 content tables, future) is not subject to this limit.';

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
comment on policy publication_logos_manage_editor on storage.objects is 'Upload path convention: <publication_id>/<filename> — storage.foldername(name) splits the object path so the first segment (the publication_id) can be checked against publication membership, the same authorization function used everywhere else in the schema.';

-- ============================================================
-- Source: 015_fix_is_platform_editorial.sql
-- ============================================================
-- =============================================================================
-- 015_fix_is_platform_editorial.sql
-- The Witness — Database Schema
-- Bugfix, surfaced during Milestone 4 testing.
--
-- is_platform_editorial() (002_identity_and_access.sql) still compared
-- profiles.role against the literal 'designer', which stopped being a
-- valid platform_role value once 013_rbac_and_audit.sql recreated that
-- enum. Unlike current_platform_role()/publication_role() — which
-- 013 already fixed because Postgres refuses to DROP TYPE while a
-- function's RETURNS clause still references it — this function has no
-- such hard catalog dependency (it returns boolean, not platform_role),
-- so nothing caught the stale literal at migration-apply time. It only
-- surfaced when a query actually evaluated the comparison, which is
-- exactly what happened running this milestone's prompt_templates RLS
-- tests: `role in (..., 'designer')` forces Postgres to cast the literal
-- 'designer' to platform_role to perform the comparison, and that cast
-- now fails because the label doesn't exist.
--
-- This is a real, verified bug, not a hypothetical — see
-- docs/PUBLICATION_MANAGEMENT.md, "A latent bug this milestone found,"
-- for the exact failing query and how it was caught.
-- =============================================================================

create or replace function public.is_platform_editorial()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('super_admin','editor_in_chief','editor','researcher','writer')
     from public.profiles where id = auth.uid()),
    false
  );
$$;
comment on function public.is_platform_editorial() is 'True if the calling user holds any editorial platform_role (not merely a subscriber). Role list corrected in Migration 015 to match the platform_role enum as finalized in Migration 013 (designer removed).';

-- ============================================================
-- Source: 016_issue_builder_collaboration.sql
-- ============================================================
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

-- ============================================================
-- Source: 017_ai_workspace_functions.sql
-- ============================================================
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

-- ============================================================
-- Source: 018_wisdom_engine_sources.sql
-- ============================================================
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
COMMIT;
alter type wisdom_source_type add value 'chanakya_niti_verse';
COMMIT;
alter type wisdom_source_type add value 'panchatantra_tale';
COMMIT;
alter type wisdom_source_type add value 'hitopadesha_story';
COMMIT;

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
COMMIT;

-- ---------------------------------------------------------------------------
-- 6. review_notes — a rejection reason an author can actually act on.
-- wisdom_entries had reviewed_by/reviewed_at (006_wisdom_engine.sql) but
-- nowhere to record why an entry was rejected; without this, a rejected
-- entry tells its author nothing they can fix.
-- ---------------------------------------------------------------------------
alter table public.wisdom_entries add column review_notes text;


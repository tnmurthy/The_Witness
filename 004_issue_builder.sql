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

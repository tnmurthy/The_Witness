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

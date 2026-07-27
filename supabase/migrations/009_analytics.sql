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

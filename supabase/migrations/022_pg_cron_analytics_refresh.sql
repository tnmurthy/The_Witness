-- =============================================================================
-- 022_pg_cron_analytics_refresh.sql
-- The Witness — Analytics Materialized View Refresh
--
-- pg_cron is enabled by default on Supabase hosted projects.
-- This migration configures two scheduled jobs to keep analytics
-- materialized views current (F-008 from the CTO Production Report).
--
-- Without these jobs, every analytics metric shown to users is stale
-- from the moment the application goes live — the views reflect data
-- as of their last manual refresh only.
--
-- Run via: paste into Supabase SQL Editor, or include in bootstrap
-- =============================================================================

-- Enable pg_cron extension (safe to run if already enabled)
create extension if not exists pg_cron;

-- Grant cron usage to the postgres role
grant usage on schema cron to postgres;

-- Remove any existing jobs with these names (idempotent)
select cron.unschedule('refresh-daily-publication-metrics')
  where exists (
    select 1 from cron.job where jobname = 'refresh-daily-publication-metrics'
  );

select cron.unschedule('refresh-content-engagement-summary')
  where exists (
    select 1 from cron.job where jobname = 'refresh-content-engagement-summary'
  );

-- Refresh daily_publication_metrics every hour on the hour
-- CONCURRENTLY means readers are not blocked during the refresh
select cron.schedule(
  'refresh-daily-publication-metrics',
  '0 * * * *',
  $$
    refresh materialized view concurrently public.daily_publication_metrics;
  $$
);

-- Refresh content_engagement_summary every 6 hours
-- (less frequently — this view is heavier and engagement data changes slower)
select cron.schedule(
  'refresh-content-engagement-summary',
  '0 */6 * * *',
  $$
    refresh materialized view concurrently public.content_engagement_summary;
  $$
);

comment on extension pg_cron is
  'Scheduled analytics refresh jobs:
   refresh-daily-publication-metrics  — every hour
   refresh-content-engagement-summary — every 6 hours
   Added in Migration 022 (F-008: Analytics views had no refresh mechanism).';

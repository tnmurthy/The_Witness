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

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

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

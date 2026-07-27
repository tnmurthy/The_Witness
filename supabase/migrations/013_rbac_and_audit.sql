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

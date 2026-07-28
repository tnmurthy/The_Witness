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

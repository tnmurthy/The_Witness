# Role-Based Access Control — Milestone 2

## Two layers of enforcement

1. **Row Level Security** (`supabase/migrations/002_identity_and_access.sql`, `013_rbac_and_audit.sql`) is the actual security boundary. Every table has RLS enabled; a request the database itself won't allow is refused regardless of what any application code above it does or forgets to do.
2. **Application-layer checks** (`src/lib/auth/permissions.ts`, `src/lib/auth/require-role.ts`) exist for UX — hiding a button the user can't use, redirecting cleanly instead of rendering a confusing empty page, returning a proper 403 with a message instead of a bare RLS denial. These are kept in sync with the RLS policies by hand and annotated with which policy each one mirrors, but **if the two ever disagree, the database wins** — a bug in the application-layer check is a worse user experience, not a security hole.

This was verified directly, not just asserted: a `writer`-role user attempting to set their own `role` to `super_admin` via a direct database update is rejected with a genuine RLS policy violation (tested against a live PostgreSQL instance — see the migration's own test log). The frontend never even offers this as an option, but the database refuses it either way.

## Role matrix

| Role | Scope | Can do |
|---|---|---|
| **Super Admin** | Platform-wide | Everything. Only role that can change another user's `platform_role` (`canManageUsers`). |
| **Editor-in-Chief** | Platform-wide (role) + Publication (membership) | Views the full audit log (`canViewAuditLog`). Creates publications (`canCreatePublication`). As a *publication member* with this role, manages that publication's other members and content. |
| **Editor** | Publication (membership) | Manages content and (per-publication) membership within publications they belong to at this role. |
| **Writer** | Publication (membership) | Authors content within publications they belong to. Peer to Researcher — neither manages the other. |
| **Researcher** | Publication (membership) | Same standing as Writer. |
| **Subscriber** | Platform-wide (role) | Default role for a new sign-up. Read access to published content only. |
| **Premium Subscriber** | Platform-wide (role) | Everything a Subscriber can, plus premium content access (`hasPremiumAccess`). |
| **Organization Admin** | One Organization | *Not* a `platform_role` value — see below. |

### Why "Organization Admin" isn't a platform_role

An Organization Admin manages one enterprise/university/company account's seats — inviting members, setting their `organization_role`. This is orthogonal to a person's platform-wide editorial standing: someone can be their employer's Organization Admin while also being a bare Subscriber on the platform, or an Editor-in-Chief who *also* happens to administer their university's seats. Modeling "Organization Admin" as a `platform_role` value would conflate two independent scopes (platform-wide vs. one organization) into a single enum, which breaks the moment a person needs to be an admin of *one* organization but not implicitly of every organization. Instead, it's `organization_members.role = 'admin'`, checked via `canManageOrganization(orgRole)` — always scoped to a specific `organization_id`, never global.

### Why Editor-in-Chief role changes aren't Super-Admin-only for publications, but platform_role changes are

The original Implementation Plan noted role assignment as "Super Admin and Editor-in-Chief" — refined here specifically for **platform-wide** role changes (the `/admin/users` screen): those are Super Admin only. Rationale: a platform_role change is the highest-privilege action in the system (it can grant `super_admin` itself), and concentrating it in one clearly-accountable role reduces privilege-escalation surface. An Editor-in-Chief still has full role-management authority *within a publication they belong to* — granting/changing `publication_members.role` for Editor, Writer, Researcher on that publication — which is Milestone 3/4 territory and already covered by the `is_publication_editor_or_above()` RLS helper from Migration 002.

### Why Writer and Researcher are peers, not ranked

`hasEditorialRankAtLeast()` (`src/lib/auth/permissions.ts`) gives both the same rank. Neither role manages the other's content or membership — they're differentiated by *specialty* (original reporting vs. research/sourcing), not seniority. Treating them as a strict hierarchy would misrepresent how editorial teams actually work.

## Audit logging

Every role change writes an `audit_logs` row **automatically**, via database triggers (Migration 013) — not by remembering to call a logging function from application code:

- `audit_profile_role_change` — fires on `profiles.role` UPDATE, only when the value actually changed.
- `audit_organization_membership_change` — fires on INSERT/UPDATE/DELETE of `organization_members`.
- `audit_publication_membership_change` — same, for `publication_members`.

`actor_id` resolves from the same session claim `auth.uid()` itself reads (`current_actor_id()`), so a normal user-initiated change is correctly attributed. **One documented exception**: when Super Admin changes another user's role via `/api/admin/users/[id]/role`, that specific write goes through the service-role client (RLS has no path for one user's session to write another user's `role` column, by design), which has no `auth.uid()` session — the trigger's `actor_id` is `null` for that specific row. The API route itself logs the real actor via the structured logger (`src/lib/logger.ts`) as a deliberate second record, so the "who did this" information isn't lost, just split across two log sources for this one privileged action. This is called out explicitly rather than left as a silent gap.

Verified end-to-end against a live database: signing up (inserting into `auth.users`) auto-creates a `profiles` row (`handle_new_auth_user` trigger); changing that row's role produces a `role_changed` audit_logs entry with the correct before/after values; adding an organization member produces an `organization_member_added` entry.

## Testing

```bash
npm test            # src/__tests__/roles.test.ts, permissions.test.ts, validation.test.ts
```

`roles.test.ts` specifically pins the exact `PLATFORM_ROLES` list — if the TypeScript list and the `platform_role` Postgres enum ever drift apart, this is the test that should fail first, before it becomes a rejected insert in production.

RLS itself is tested by executing real SQL against a live PostgreSQL 16 instance (not unit-testable from Vitest, since it's a database-layer guarantee) — see the verification log in `supabase/migrations/013_rbac_and_audit.sql`'s commit history / this milestone's delivery notes for the exact test transactions run (self-elevation rejected, legitimate self-update accepted, cross-user role change rejected for non-admins, organization membership audit trail confirmed).

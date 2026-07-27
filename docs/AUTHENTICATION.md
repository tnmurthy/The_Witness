# Authentication — Milestone 2

Four sign-in methods, all backed by Supabase Auth, all landing through one callback route.

## The four methods

| Method | Where | Notes |
|---|---|---|
| Email + password | `/sign-in`, `/sign-up` | Standard `signInWithPassword` / `signUp`. Sign-up requires email confirmation (`enable_confirmations = true` in `supabase/config.toml`) before the account can sign in. |
| Magic link | `/sign-in` → "Sign in without a password" | `signInWithOtp`, with `shouldCreateUser: false` — deliberately cannot be used to create a new account, only to sign an existing, already-confirmed user in. |
| Password reset | `/forgot-password` → email → `/reset-password` | `resetPasswordForEmail` then, after the recovery session is established via the callback, `updateUser({ password })`. |
| OAuth (Google, GitHub) | `/sign-in`, `/sign-up` | `signInWithOAuth`. Requires provider configuration — see below. |

## The callback route

`src/app/auth/callback/route.ts` is the single landing point for all four flows except plain password sign-in (which never leaves the app). OAuth, magic link, email confirmation, and password recovery all redirect back with a `?code=` param; Supabase's `exchangeCodeForSession(code)` handles all four identically. The route reads a `?next=` param to decide where to send the user afterward — `/dashboard` by default, `/reset-password` for the password-recovery flow specifically (set as the `redirectTo` when requesting the reset email).

## Configuring OAuth providers

Required for local development (`supabase/config.toml`) and again, separately, for any real Supabase project (staging/production) via the dashboard — these are not the same configuration and both need to be set up.

### Google

1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → Create OAuth client ID → Web application.
2. Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback` (production/staging) and, for local development against the Supabase CLI, `http://127.0.0.1:54321/auth/v1/callback`.
3. Set `SUPABASE_AUTH_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_GOOGLE_SECRET` in `.env.local` (local) or your hosting platform's environment variables (staging/production) — `supabase/config.toml` reads them via `env(...)` for local dev; a real Supabase project needs the same two values entered in Authentication → Providers → Google in the dashboard.

### GitHub

1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.
2. Authorization callback URL: same pattern as above (`https://<your-project-ref>.supabase.co/auth/v1/callback` or the local `127.0.0.1:54321` equivalent).
3. Set `SUPABASE_AUTH_GITHUB_CLIENT_ID` and `SUPABASE_AUTH_GITHUB_SECRET`, same as Google above.

Until these are configured, clicking the Google/GitHub buttons surfaces Supabase's own "provider is not enabled" error via a toast — this fails loudly and specifically, not silently.

## Session management

- `src/lib/supabase/client.ts` — browser client, anon key only.
- `src/lib/supabase/server.ts` — server client for Server Components/Actions/Route Handlers, reads/writes the session via Next's cookie store.
- `src/lib/supabase/middleware.ts` — refreshes the session on every request (Supabase access tokens are short-lived; without this, a Server Component could read a stale cookie) and redirects unauthenticated requests away from protected paths.
- `src/lib/supabase/admin.ts` — service-role client, bypasses RLS entirely. Server-only (enforced at build time via the `server-only` package). Used only for actions no user session can legitimately perform on their own, e.g. Super Admin changing another user's role.

Supabase itself handles JWT/refresh-token rotation; this app does not implement its own session/token logic beyond keeping the cookie fresh.

## Protected routes

`middleware.ts` protects everything under `/dashboard`, `/organizations`, `/admin`, and `/settings` at the edge (redirects unauthenticated requests to `/sign-in?next=<original path>` before the page ever renders). Every one of those pages/layouts *also* re-checks auth server-side independently (see `src/app/(dashboard)/layout.tsx`) — the middleware list has to be maintained by hand since Next.js route groups don't appear in the URL and can't be introspected at the Edge runtime, so a path missing from that list is a slower redirect, not a security hole; the page-level check is the real backstop.

Role-restricted pages (like `/admin/users`) additionally call `requireRole()` (`src/lib/auth/require-role.ts`), which redirects to `/dashboard?error=insufficient_role` if the signed-in user's role isn't in the allowed list.

## Testing this locally without real email delivery

Local Supabase (`npx supabase start`) includes Inbucket, a mail catcher, at `http://localhost:54324` — every confirmation, magic link, and password reset email sent during local development lands there instead of a real inbox, so you can test all four auth methods end-to-end without any ESP configured.

# Troubleshooting Guide — The Witness

## Auth issues

### "Invalid login credentials" on sign-in

- The user may not have confirmed their email. Check Supabase Auth →
  Users and look for an unconfirmed user.
- In development, disable email confirmation: Auth → Settings → "Confirm
  email" → disable.
- In production, verify your SMTP is configured (see DEPLOYMENT.md §2).

### "Email not confirmed" on sign-in after confirmation

- The confirmation link may have expired (default: 1 hour in Supabase).
- Resend confirmation email from Auth → Users → [user] → Send magic link.

### OAuth redirect goes to wrong URL ("site not allowed" error)

- Add your URL to Supabase Auth → Settings → Redirect URLs.
- Both `https://your-app.vercel.app/auth/callback` and
  `http://localhost:3000/auth/callback` must be listed.
- Your `NEXT_PUBLIC_SITE_URL` must match what the OAuth button sends as
  `redirectTo` in `OAuthButtons.tsx`.

### Password reset email arrives but link gives "code exchange failed"

- The reset link is single-use and expires in 1 hour. If the user
  waited, resend via Auth → Users → [user] → Send password recovery.
- Verify your Redirect URL includes `/auth/callback`.

### "provider is not enabled" when clicking Google/GitHub sign-in

- Enable the provider in Supabase Auth → Providers.
- Verify the client ID and secret are saved.
- Verify the authorized redirect URI in Google/GitHub matches the
  Supabase callback URL exactly.

---

## Database / RLS issues

### "permission denied for table profiles" (or similar)

- RLS is blocking a query that doesn't have an active session. Every
  server-side API route should use `createClient()` (which reads the
  user's session cookie), not create an unauthenticated client.
- Confirm the middleware is running: every request to a protected route
  should refresh the session (see `src/lib/supabase/middleware.ts`).

### Query returns empty array but data exists

- RLS is filtering it out. Check which policy should grant access.
- To debug: run the same query from the Supabase SQL Editor (which uses
  the service role and bypasses RLS) — if data appears there but not via
  the app, it's an RLS gap, not missing data.
- Run `node scripts/validate-rls.js` to check every major policy.

### Admin routes fail with "SUPABASE_SERVICE_ROLE_KEY is not set"

- This key is required for `createAdminClient()` (role changes, etc.).
- In Vercel: add `SUPABASE_SERVICE_ROLE_KEY` to Environment Variables.
- Locally: add to `.env.local`.
- Add `REQUIRE_SERVICE_ROLE=true` to your production Vercel env to catch
  this at startup rather than only when the admin route is first called.

### Migration fails: "relation X already exists" or "type X already exists"

- This is normal for a re-run. The bootstrap script marks migrations as
  applied after the first run and skips them on re-runs.
- If a migration genuinely needs to re-run (e.g. you edited it), delete
  its row from `public._witness_migrations` and run bootstrap again.

### "insufficient_privilege" on storage.objects COMMENT ON

- This is a known, intentional Supabase hosted restriction. The migration
  handles it gracefully (the comment-equivalent is written as a SQL
  comment in the migration file instead). The bootstrap script marks this
  as a non-fatal warning and continues.

### The vector extension is missing

- Enable it: Supabase Dashboard → Database → Extensions → Search
  "vector" → Enable.
- Then re-run `npm run bootstrap` — it will detect and enable it.

---

## Storage issues

### Logo upload fails with "Object not found in bucket"

- Confirm the `publication-logos` bucket exists in Storage → Buckets.
- If missing, run `npm run bootstrap` — it creates the bucket if absent.

### Logo upload fails with "Row Level Security policy violation"

- The user must be an editor-or-above for the publication, and the
  upload path must be `<publication_id>/<filename>`.
- Check `publication_logos_manage_editor` in Storage → Policies.

### Uploaded image not showing (shows broken image icon)

- Verify `next.config.ts` has `*.supabase.co` in `images.remotePatterns`.
- The bucket must be public (`publication-logos` is). Check Storage →
  Buckets → publication-logos → Public: yes.

---

## Realtime issues

### Issue Builder doesn't show other editors' cursor/presence

- Confirm the `issues` table is in the `supabase_realtime` publication:
  ```sql
  select * from pg_publication_tables where pubname = 'supabase_realtime';
  ```
  If `issues` is missing, run bootstrap again.
- Enable Realtime in the Supabase Dashboard → Database → Replication →
  confirm `issues`, `ai_jobs`, and `delivery_logs` are toggled on.

### AI job status doesn't update in real time

- Same as above — verify `ai_jobs` is in the Realtime publication.
- Check the browser console for WebSocket connection errors.
- The `NEXT_PUBLIC_SUPABASE_URL` must be correct (WSS connections use
  it too).

---

## AI Workspace issues

### "No AI provider is configured on this deployment" (503)

- Add `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` to your environment.
- Anthropic is preferred if both are set (`src/lib/ai/registry.ts`).
- Locally: add to `.env.local`. In Vercel: add to Environment Variables.

### AI generation returns 502 with `retryable: true`

- The provider returned a rate-limit or server error.
- The client should retry after a short delay (built into the UI).
- If persistent: check your API key quotas/billing in the provider's
  dashboard.

### "Unknown AI function" (422)

- The function ID isn't registered. Valid IDs are listed at
  `GET /api/ai/run` — call that endpoint to see the full list.
- Use the exact `functionId` string shown there.

---

## Health check fails (`/api/health` returns error)

### `checks.database.status: "error"`

- The `SUPABASE_SERVICE_ROLE_KEY` may be missing or wrong in production.
- The Supabase project may be paused (check the Supabase dashboard).
- If the project is on the free tier and inactive >7 days, it pauses.
  Resume it from the dashboard.

### Everything looks right but the app is slow

- Verify you're using the **pooler URL** (port 6543) for the running
  app, not the direct URL (5432). On Vercel with many concurrent
  functions, the direct URL can exhaust connection limits.
- Run load testing (k6) against staging to identify the bottleneck.

---

## Local development issues

### "Invalid environment variables" on `npm run dev`

- Copy `.env.example` → `.env.local` and fill in real values.
- Check for stray quotes or spaces around `=` signs.
- The Zod schema in `src/lib/env.ts` will print exactly which variable
  is wrong and what format it expects.

### `npm run bootstrap` fails: "pg not installed"

- Run `npm install` first. `pg` is a devDependency added in Milestone 9.

### Migrations fail locally but pass on Supabase hosted

- Your local Postgres version may differ. Migrations target PostgreSQL 15+.
- Check that `pgvector` is installed: `SELECT * FROM pg_extension WHERE extname = 'vector'`.

# Deployment Guide — The Witness

## Prerequisites

- A Supabase project (free tier works; upgrade to Pro for PITR + bigger
  database for production)
- A Vercel account (or any Node.js hosting platform)
- Node.js 18+
- An email provider for transactional email (Resend recommended)
- Optional but recommended: Anthropic or OpenAI API key for AI Workspace

---

## Step 1 — Provision a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project.
2. Note your **project reference** (the `ref` in your project URL).
3. From **Project Settings → API**:
   - Copy `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - Copy `anon / public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**keep secret**)
4. From **Project Settings → Database → Connection string → URI**:
   - Copy the **direct** connection URL (port 5432) → `SUPABASE_DB_URL`
   - Note: use port **6543** (pgbouncer/pooler) for the running app in
     Vercel. Port 5432 is for migration scripts only.
5. Enable the **vector** extension:
   - Dashboard → Database → Extensions → search "vector" → Enable.
   - (`uuid-ossp` and `pgcrypto` are enabled by default on new projects.)

---

## Step 2 — Configure authentication

### Email auth (required)

In **Authentication → Settings**:

- **Site URL**: `https://your-app.vercel.app` (or your custom domain)
- **Redirect URLs**: Add both:
  - `https://your-app.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback` (for local dev)
- **Email provider**: Enabled by default.
- **SMTP (production)**: Supabase's built-in SMTP has a 3/hour limit —
  configure a real provider:
  ```
  Provider: Resend (recommended)
  Host: smtp.resend.com
  Port: 587
  Username: resend
  Password: your-resend-api-key
  Sender name: The Witness
  Sender email: noreply@your-domain.com
  ```

### Google OAuth (optional)

1. [Google Cloud Console](https://console.cloud.google.com) → APIs &
   Services → Credentials → Create OAuth 2.0 Client ID (Web application).
2. Authorized redirect URIs: `https://[ref].supabase.co/auth/v1/callback`
3. Copy Client ID and Client Secret.
4. In Supabase: **Authentication → Providers → Google** → Enable → paste.

### GitHub OAuth (optional)

1. GitHub Settings → Developer settings → OAuth Apps → New OAuth App.
2. Authorization callback URL: `https://[ref].supabase.co/auth/v1/callback`
3. Copy Client ID. Generate Client Secret.
4. In Supabase: **Authentication → Providers → GitHub** → Enable → paste.

---

## Step 3 — Run the bootstrap script

```bash
# Copy and fill in the template
cp .env.example .env.local
# Edit .env.local with your real values

# Run bootstrap (applies all 20 migrations + verifies setup)
npm run bootstrap
```

Bootstrap performs:

1. Environment variable validation
2. Database connection test
3. PostgreSQL extension verification
4. All 20 migrations (idempotent — safe to re-run)
5. Storage bucket creation/verification
6. Realtime publication verification
7. Auth trigger and helper function verification
8. RLS smoke tests

Review all output, especially any `WARN` lines, before proceeding.

---

## Step 4 — Verify RLS against real infrastructure

After bootstrap, run the RLS validation suite against your real project:

```bash
node scripts/validate-rls.js
```

This creates a real test user, exercises every major RLS policy (anon
blocked, authenticated subscriber, service role), then deletes the test
user. All checks must pass before considering the deployment secure.

---

## Step 5 — Deploy to Vercel

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Link to your project
vercel link

# Set environment variables (production)
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add NEXT_PUBLIC_SITE_URL production
vercel env add REQUIRE_SERVICE_ROLE production   # value: true
# Add ANTHROPIC_API_KEY or OPENAI_API_KEY if using AI Workspace

# Deploy
vercel --prod
```

Or via the Vercel dashboard: import the GitHub repo and add environment
variables in Project → Settings → Environment Variables.

### Production connection pooling

In your Vercel environment variables, set the **DATABASE_URL** (or
however your app connects for the running server) to the **pooler URL**
at port 6543, not the direct URL at port 5432. Direct connections exhaust
the Postgres connection limit under concurrent serverless invocations.

The pooler URL format:

```
postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

Found at: Supabase Dashboard → Project Settings → Database → Connection
string → URI (toggle to "Transaction" mode).

---

## Step 6 — Verify the deployment

```bash
# Check the health endpoint
curl https://your-app.vercel.app/api/health | jq .
```

Expected response:

```json
{
  "status": "ok",
  "latencyMs": 45,
  "checks": {
    "database": { "status": "ok" },
    "ai": { "status": "ok", "detail": "anthropic" }
  }
}
```

If `status` is `"error"`, check the `checks.database` field and the
Vercel deployment logs.

---

## Post-deployment checklist

- [ ] `/api/health` returns `status: ok`
- [ ] Sign up with email creates an account and sends confirmation email
- [ ] Email confirmation link opens the app and signs you in
- [ ] Sign in with email/password works
- [ ] OAuth (if configured): sign in with Google/GitHub works
- [ ] Password reset email arrives and allows setting a new password
- [ ] Dashboard loads after sign-in
- [ ] Create a publication → publication appears in the list
- [ ] Wisdom Engine: create a wisdom entry, submit for review, approve it
- [ ] Issue Builder: create an issue, add a block, verify autosave
- [ ] Knowledge Graph: add a connection, verify it appears in the explorer
- [ ] AI Workspace: run a rewrite (if AI key is configured)
- [ ] Upload a publication logo (tests Storage)
- [ ] Issue Builder: open two browser sessions, verify Realtime sync

---

## Scaling checklist (before significant traffic)

- [ ] Supabase plan: upgrade to Pro for connection pooling limits > 60
- [ ] Configure Supabase connection pooler (port 6543) in production
- [ ] Set up log draining (Vercel → Project → Logs → Drain → Axiom/Logtail)
- [ ] Add APM: install Sentry (`@sentry/nextjs`) for error tracking
- [ ] Configure uptime monitoring: point UptimeRobot at `/api/health`
- [ ] Set alert rules in Sentry/APM for error-rate spikes
- [ ] Add rate limiting (Upstash Ratelimit) to AI Workspace routes

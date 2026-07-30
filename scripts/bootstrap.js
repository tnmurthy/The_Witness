#!/usr/bin/env node
/**
 * scripts/bootstrap.js — The Witness: Supabase Bootstrap
 *
 * Run once against a freshly-provisioned Supabase project.
 * Usage: node scripts/bootstrap.js
 *
 * Required env vars (copy .env.example → .env.local and fill in):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_DB_URL  (postgresql://postgres:[pw]@db.[ref].supabase.co:5432/postgres)
 */
"use strict";

const fs = require("fs");

async function resolveIPv4(url) {
  // Parse the connection URL, resolve the hostname to an IPv4 address,
  // and return a new URL with the IP substituted. This forces IPv4 on
  // Windows hosts where db.[ref].supabase.co resolves to IPv6 by default.
  const dns = require("dns").promises;
  const parsed = new URL(url);
  try {
    const addrs = await dns.resolve4(parsed.hostname);
    if (addrs && addrs.length > 0) {
      parsed.hostname = addrs[0];
    }
  } catch {
    // DNS lookup failed — return original URL and let pg handle it
  }
  return parsed.toString();
}

const path = require("path");

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};
const PASS = c.green("OK");
const FAIL = c.red("FAIL");
const WARN = c.yellow("WARN");

function loadDotEnv() {
  const envFile = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envFile)) {
    console.log(`${WARN}  No .env.local found.`);
    return;
  }
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    const val = t
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
  console.log(`${PASS}  Loaded .env.local`);
}

function validateEnv() {
  console.log(`\n${c.bold("Step 1: Environment variables")}`);
  const required = {
    NEXT_PUBLIC_SUPABASE_URL: "https://[ref].supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "Project Settings -> API -> anon key",
    SUPABASE_SERVICE_ROLE_KEY: "Project Settings -> API -> service_role key",
    SUPABASE_DB_URL: "postgresql://postgres:[pw]@db.[ref].supabase.co:5432/postgres",
  };
  let ok = true;
  for (const [key, hint] of Object.entries(required)) {
    const v = process.env[key];
    if (!v || v.includes("your-") || v.includes("[pw]") || v.includes("[ref]")) {
      console.log(`  ${FAIL}  ${key}  (hint: ${hint})`);
      ok = false;
    } else {
      const display = v.length > 50 ? v.slice(0, 20) + "..." + v.slice(-8) : v;
      console.log(`  ${PASS}  ${key} = ${c.dim(display)}`);
    }
  }
  for (const [key, hint] of [
    ["OPENAI_API_KEY", "AI Workspace (OpenAI)"],
    ["ANTHROPIC_API_KEY", "AI Workspace (Anthropic)"],
  ]) {
    if (!process.env[key]) console.log(`  ${WARN}  ${key} not set - needed for: ${hint}`);
  }
  if (!ok) {
    console.log(`\n${c.red("Aborting.")}`);
    process.exit(1);
  }
}

async function checkDatabase() {
  console.log(`\n${c.bold("Step 2-3: Database connection and extensions")}`);
  let pg;
  try {
    pg = require("pg");
  } catch {
    console.log(`  ${FAIL}  pg not installed - run npm install`);
    process.exit(1);
  }
  const resolvedUrl = await resolveIPv4(process.env.SUPABASE_DB_URL);
  const client = new pg.Client({
    connectionString: resolvedUrl,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    const { rows } = await client.query("select version()");
    console.log(`  ${PASS}  ${rows[0].version.match(/PostgreSQL [\d.]+/)?.[0] ?? "Connected"}`);
  } catch (err) {
    console.log(`  ${FAIL}  ${err.message}`);
    console.log(`       Use the DIRECT URL (port 5432), not the pooler.`);
    process.exit(1);
  }
  for (const ext of ["uuid-ossp", "pgcrypto", "vector"]) {
    const { rows } = await client.query("select 1 from pg_extension where extname = $1", [ext]);
    if (rows.length) {
      console.log(`  ${PASS}  extension ${ext}`);
    } else {
      try {
        await client.query(`create extension if not exists "${ext}"`);
        console.log(`  ${PASS}  extension ${ext} (just enabled)`);
      } catch {
        console.log(`  ${FAIL}  extension ${ext} - enable in Dashboard -> Database -> Extensions`);
      }
    }
  }
  await client.end();
}

async function applyMigrations() {
  console.log(`\n${c.bold("Step 4: Migrations")}`);
  const pg = require("pg");
  const migrationsDir = path.join(__dirname, "..", "supabase", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  console.log(`  Found ${files.length} migration files`);

  const resolvedUrl = await resolveIPv4(process.env.SUPABASE_DB_URL);
  const client = new pg.Client({
    connectionString: resolvedUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query(`
    create table if not exists public._witness_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  let applied = 0,
    skipped = 0,
    warnings = 0;
  for (const filename of files) {
    const { rows } = await client.query("select 1 from public._witness_migrations where filename = $1", [
      filename,
    ]);
    if (rows.length) {
      console.log(`  --  ${filename} (already applied)`);
      skipped++;
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, filename), "utf8");
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into public._witness_migrations (filename) values ($1)", [filename]);
      await client.query("commit");
      console.log(`  ${PASS}  ${filename}`);
      applied++;
    } catch (err) {
      await client.query("rollback");
      const isNonFatal = err.message.includes("42501") || err.message.includes("already exists");
      if (isNonFatal) {
        console.log(`  ${WARN}  ${filename} - non-fatal: ${err.message.slice(0, 80)}`);
        warnings++;
        try {
          await client.query(
            "insert into public._witness_migrations (filename) values ($1) on conflict do nothing",
            [filename]
          );
        } catch {
          /* ignore */
        }
      } else {
        console.log(`  ${FAIL}  ${filename}`);
        console.log(`       ${c.red(err.message)}`);
        await client.end();
        process.exit(1);
      }
    }
  }
  await client.end();
  console.log(`  Summary: ${applied} applied, ${skipped} skipped, ${warnings} warnings`);
}

async function verifyStorage() {
  console.log(`\n${c.bold("Step 5: Storage buckets")}`);
  const { createClient } = require("@supabase/supabase-js");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) {
    console.log(`  ${FAIL}  ${error.message}`);
    return;
  }
  const pub = buckets?.find((b) => b.id === "publication-logos");
  if (pub) {
    console.log(`  ${PASS}  publication-logos bucket (public=${pub.public})`);
  } else {
    const { error: ce } = await admin.storage.createBucket("publication-logos", {
      public: true,
      fileSizeLimit: 2097152,
      allowedMimeTypes: ["image/png", "image/jpeg", "image/svg+xml", "image/webp"],
    });
    ce ? console.log(`  ${FAIL}  ${ce.message}`) : console.log(`  ${PASS}  publication-logos bucket created`);
  }
}

async function verifyRealtime() {
  console.log(`\n${c.bold("Step 6: Realtime")}`);
  const pg = require("pg");
  const resolvedUrl = await resolveIPv4(process.env.SUPABASE_DB_URL);
  const client = new pg.Client({
    connectionString: resolvedUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  for (const table of ["ai_jobs", "delivery_logs", "issues"]) {
    const { rows } = await client.query(
      "select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = $1",
      [table]
    );
    if (rows.length) {
      console.log(`  ${PASS}  ${table} in supabase_realtime`);
    } else {
      try {
        await client.query(`alter publication supabase_realtime add table public.${table}`);
        console.log(`  ${PASS}  ${table} added to supabase_realtime`);
      } catch (err) {
        console.log(`  ${WARN}  ${table}: ${err.message}`);
      }
    }
  }
  await client.end();
}

async function verifyAuthTrigger() {
  console.log(`\n${c.bold("Step 7: Auth trigger and helper functions")}`);
  const pg = require("pg");
  const resolvedUrl = await resolveIPv4(process.env.SUPABASE_DB_URL);
  const client = new pg.Client({
    connectionString: resolvedUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const { rows } = await client.query(
    "select 1 from information_schema.triggers where trigger_name='on_auth_user_created' and event_object_schema='auth'"
  );
  rows.length
    ? console.log(`  ${PASS}  on_auth_user_created trigger`)
    : console.log(`  ${FAIL}  on_auth_user_created trigger missing - Migration 013`);
  const fns = [
    "current_platform_role",
    "is_super_admin",
    "is_platform_editorial",
    "publication_role",
    "is_publication_member",
    "is_publication_editor_or_above",
  ];
  const { rows: found } = await client.query(
    "select routine_name from information_schema.routines where routine_schema='public' and routine_name = any($1)",
    [fns]
  );
  const foundSet = new Set(found.map((r) => r.routine_name));
  for (const fn of fns) {
    foundSet.has(fn) ? console.log(`  ${PASS}  ${fn}()`) : console.log(`  ${FAIL}  ${fn}() missing`);
  }
  const { rows: rls } = await client.query(
    "select count(*) from pg_tables where schemaname='public' and rowsecurity=true"
  );
  console.log(`  ${PASS}  RLS enabled on ${rls[0].count} tables`);
  await client.end();
}

async function rlsSmokeTest() {
  console.log(`\n${c.bold("Step 8: RLS smoke tests")}`);
  const { createClient } = require("@supabase/supabase-js");
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: anonData } = await anon.from("profiles").select("id").limit(1);
  !anonData || anonData.length === 0
    ? console.log(`  ${PASS}  Anon blocked from profiles (RLS working)`)
    : console.log(`  ${FAIL}  Anon can read profiles - RLS NOT working!`);

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: adminErr } = await admin.from("profiles").select("id").limit(1);
  !adminErr
    ? console.log(`  ${PASS}  Service role bypasses RLS`)
    : console.log(`  ${WARN}  Service role issue: ${adminErr.message}`);

  const { data: cats } = await admin.from("wisdom_categories").select("id");
  cats && cats.length > 0
    ? console.log(`  ${PASS}  Seed data present (${cats.length} wisdom_categories)`)
    : console.log(`  ${WARN}  No wisdom_categories - check Migration 012`);

  const { error: kgErr } = await admin.from("knowledge_graph_edges").select("id").limit(1);
  !kgErr
    ? console.log(`  ${PASS}  knowledge_graph_edges accessible`)
    : console.log(`  ${WARN}  ${kgErr.message}`);
}

function printManualSteps() {
  console.log(`\n${c.bold("Step 9: Manual dashboard steps")}`);
  const steps = `
  Authentication -> Settings:
    [ ] Site URL: https://your-app.vercel.app
    [ ] Redirect URLs: https://your-app.vercel.app/auth/callback
                       http://localhost:3000/auth/callback
    [ ] SMTP (production): Host smtp.resend.com, Port 587, use Resend API key

  Authentication -> Providers -> Google:
    [ ] Enable, add Client ID + Secret from Google Cloud Console
    [ ] Authorized redirect: https://[ref].supabase.co/auth/v1/callback

  Authentication -> Providers -> GitHub:
    [ ] Enable, add Client ID + Secret from GitHub OAuth App
    [ ] Callback URL: https://[ref].supabase.co/auth/v1/callback

  Vercel -> Environment Variables (Production):
    NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL,
    OPENAI_API_KEY or ANTHROPIC_API_KEY

  Production database connection:
    Use the POOLER URL (port 6543, pgbouncer) for the running app.
    Set DATABASE_URL or update SUPABASE_DB_URL to pooler URL in Vercel.
`;
  console.log(steps);
}

async function main() {
  console.log(c.bold("\n== The Witness - Supabase Bootstrap ==\n"));
  loadDotEnv();
  validateEnv();
  await checkDatabase();
  await applyMigrations();
  await verifyStorage();
  await verifyRealtime();
  await verifyAuthTrigger();
  await rlsSmokeTest();
  printManualSteps();
  console.log(`\n${c.green(c.bold("Bootstrap complete."))}\n`);
}

main().catch((err) => {
  console.error(c.red("Error:"), err.message);
  process.exit(1);
});

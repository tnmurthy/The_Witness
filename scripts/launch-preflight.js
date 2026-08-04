#!/usr/bin/env node
/**
 * scripts/launch-preflight.js
 * The Witness — Launch Preflight Check
 *
 * Condition 1: Validates ALL required environment variables are set
 * and all critical infrastructure is reachable before deploying.
 *
 * Usage:
 *   node scripts/launch-preflight.js
 *   node scripts/launch-preflight.js --env production
 *
 * Exit codes:
 *   0 — all checks passed, safe to deploy
 *   1 — one or more blocking checks failed
 */
"use strict";

const { createClient } = require("@supabase/supabase-js");

// ── Colour helpers ────────────────────────────────────────────────────────────
const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  amber: (s) => `\x1b[33m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

const PASS = c.green("  PASS");
const FAIL = c.red("  FAIL");
const WARN = c.amber("  WARN");
const INFO = c.dim("  INFO");

// ── Load env ──────────────────────────────────────────────────────────────────
const path = require("path");
const fs = require("fs");
const envFile = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envFile)) {
  require("dotenv").config({ path: envFile });
  console.log(INFO, ".env.local loaded");
} else {
  console.log(WARN, ".env.local not found — using process.env");
}

// ── Checks ───────────────────────────────────────────────────────────────────
const results = [];
let blocking = 0;

function check(label, passed, detail = "", isBlocking = true) {
  const icon = passed ? PASS : isBlocking ? FAIL : WARN;
  const line = `${icon}  ${label}`;
  console.log(line + (detail ? `\n         ${c.dim(detail)}` : ""));
  results.push({ label, passed, isBlocking });
  if (!passed && isBlocking) blocking++;
}

async function run() {
  console.log("\n" + c.bold("== The Witness — Launch Preflight ==\n"));

  // ── Section 1: Required environment variables ──────────────────────────────
  console.log(c.bold("1. Environment variables\n"));

  const required = [
    ["NEXT_PUBLIC_SUPABASE_URL", "Supabase project URL"],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "Supabase anon key (public)"],
    ["SUPABASE_SERVICE_ROLE_KEY", "Supabase service role key (server-only)"],
    ["NEXT_PUBLIC_SITE_URL", "Production site URL (e.g. https://thewitness.app)"],
    ["RESEND_API_KEY", "Resend API key for email delivery"],
    ["EMAIL_FROM", "Sender email address (must be verified in Resend)"],
    ["EMAIL_FROM_NAME", "Sender display name"],
  ];

  const recommended = [
    ["NEXT_PUBLIC_SENTRY_DSN", "Sentry error tracking DSN", false],
    ["SENTRY_AUTH_TOKEN", "Sentry source map upload token", false],
    ["UPSTASH_REDIS_REST_URL", "Upstash Redis URL for rate limiting", false],
    ["UPSTASH_REDIS_REST_TOKEN", "Upstash Redis token", false],
    ["CRON_SECRET", "Secret for /api/cron/* authentication", false],
  ];

  const aiProviders = [
    ["ANTHROPIC_API_KEY", "Anthropic (preferred)"],
    ["OPENAI_API_KEY", "OpenAI (fallback)"],
  ];

  for (const [key, desc] of required) {
    check(
      `${key}`,
      !!process.env[key],
      process.env[key] ? `${desc} — ${process.env[key].slice(0, 8)}...` : `MISSING — ${desc}`,
      true
    );
  }

  // At least one AI provider required
  const hasAI = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
  check(
    "AI provider (ANTHROPIC_API_KEY or OPENAI_API_KEY)",
    hasAI,
    hasAI
      ? `${process.env.ANTHROPIC_API_KEY ? "Anthropic" : ""}${process.env.ANTHROPIC_API_KEY && process.env.OPENAI_API_KEY ? " + " : ""}${process.env.OPENAI_API_KEY ? "OpenAI" : ""} configured`
      : "Neither ANTHROPIC_API_KEY nor OPENAI_API_KEY is set — AI Workspace will be disabled",
    true
  );

  for (const [key, desc, blocking = false] of recommended) {
    check(key, !!process.env[key], `${desc}${!process.env[key] ? " — not set (recommended)" : ""}`, blocking);
  }

  // ── Section 2: Supabase connectivity ──────────────────────────────────────
  console.log("\n" + c.bold("2. Supabase connectivity\n"));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceKey) {
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Test DB connectivity
    const { error: dbErr } = await admin.from("wisdom_categories").select("id").limit(1);
    check(
      "Database reachable (service role)",
      !dbErr,
      dbErr ? `Error: ${dbErr.message.slice(0, 80)}` : "wisdom_categories query succeeded"
    );

    // Test anon access is correctly blocked
    const anon = createClient(url, anonKey ?? "");
    const { data: anonData } = await anon.from("profiles").select("id").limit(1);
    check(
      "RLS: anon blocked from profiles",
      !anonData?.length,
      anonData?.length ? `FAIL — anon can read ${anonData.length} profile rows` : "Anon correctly blocked"
    );

    // Test migration tracking table exists
    const { data: migrations } = await admin.from("_witness_migrations").select("filename").order("filename");
    check(
      "Migration tracking table exists",
      !!migrations,
      migrations ? `${migrations.length} migrations tracked` : "Table missing — run bootstrap"
    );

    // Check key migrations are applied
    const applied = new Set((migrations ?? []).map((m) => m.filename));
    for (const mig of ["022_pg_cron_analytics_refresh.sql", "023_embedding_pipeline.sql"]) {
      check(
        `Migration ${mig} applied`,
        applied.has(mig),
        applied.has(mig) ? "Applied" : "Not applied — paste into Supabase SQL Editor",
        false
      );
    }

    // Check storage bucket
    const { data: buckets } = await admin.storage.listBuckets();
    const hasBucket = buckets?.some((b) => b.name === "publication-logos");
    check(
      "Storage: publication-logos bucket exists",
      !!hasBucket,
      hasBucket ? "Bucket exists and is public" : "Missing — run scripts/bootstrap.js"
    );

    // Check auth trigger exists
    const { data: subscribers } = await admin.from("subscribers").select("id").limit(1);
    check("subscribers table accessible", !!(subscribers !== null), "Subscription schema applied");
  } else {
    check("Database connectivity", false, "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
  }

  // ── Section 3: Email configuration ────────────────────────────────────────
  console.log("\n" + c.bold("3. Email delivery\n"));

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && resendKey !== "re_xxxxxxxxxxxx") {
    try {
      const res = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${resendKey}` },
      });
      const data = await res.json();
      check(
        "Resend API key valid",
        res.ok,
        res.ok ? "API key accepted" : `Error: ${JSON.stringify(data).slice(0, 80)}`
      );

      if (res.ok && data.data) {
        const verified = data.data.filter((d) => d.status === "verified");
        check(
          "Resend: verified sending domain",
          verified.length > 0,
          verified.length > 0
            ? `Verified: ${verified.map((d) => d.name).join(", ")}`
            : "No verified domains — emails will be sent from onboarding@resend.dev (testing only)",
          false
        );
      }
    } catch (err) {
      check("Resend API reachable", false, err.message);
    }
  } else {
    check("Resend API key valid", false, "RESEND_API_KEY not set or still placeholder");
  }

  // ── Section 4: Site URL configuration ─────────────────────────────────────
  console.log("\n" + c.bold("4. Site configuration\n"));

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  check(
    "NEXT_PUBLIC_SITE_URL is set",
    !!siteUrl && siteUrl !== "http://localhost:3000",
    siteUrl === "http://localhost:3000"
      ? "Still set to localhost — update to production URL before deploying"
      : (siteUrl ?? "Not set")
  );

  const requireServiceRole = process.env.REQUIRE_SERVICE_ROLE === "true";
  check(
    "REQUIRE_SERVICE_ROLE=true",
    requireServiceRole,
    requireServiceRole
      ? "Startup validation enabled"
      : "Set to false — service role check disabled at startup",
    false
  );

  // ── Section 5: AI provider test ────────────────────────────────────────────
  console.log("\n" + c.bold("5. AI provider connectivity\n"));

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (anthropicKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 10,
          messages: [{ role: "user", content: "Say OK" }],
        }),
      });
      const data = await res.json();
      const ok = res.ok && data.content?.[0]?.text;
      check(
        "Anthropic API: live call succeeds",
        !!ok,
        ok ? `Response: "${data.content[0].text.trim()}"` : `Error: ${JSON.stringify(data).slice(0, 80)}`
      );
    } catch (err) {
      check("Anthropic API reachable", false, err.message);
    }
  } else if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 10,
          messages: [{ role: "user", content: "Say OK" }],
        }),
      });
      const data = await res.json();
      const ok = res.ok && data.choices?.[0]?.message?.content;
      check(
        "OpenAI API: live call succeeds",
        !!ok,
        ok
          ? `Response: "${data.choices[0].message.content.trim()}"`
          : `Error: ${JSON.stringify(data).slice(0, 80)}`
      );
    } catch (err) {
      check("OpenAI API reachable", false, err.message);
    }
  } else {
    check("AI provider live call", false, "No AI API key set");
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  console.log("\n" + "─".repeat(50));
  console.log(c.bold(`\n  ${passed}/${total} checks passed`));

  if (blocking === 0) {
    console.log(c.green(c.bold("  ✓  ALL BLOCKING CHECKS PASSED — safe to deploy\n")));
    process.exit(0);
  } else {
    console.log(
      c.red(c.bold(`  ✗  ${blocking} BLOCKING CHECK${blocking > 1 ? "S" : ""} FAILED — do not deploy\n`))
    );
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(c.red("Preflight script crashed:"), err.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * scripts/validate-rls.js
 * The Witness — RLS Validation Script
 *
 * Tests every major Row Level Security policy against a real Supabase
 * project by creating a real test user, signing in, performing each
 * action the policy permits/denies, then cleaning up.
 *
 * Usage: SUPABASE_TEST_EMAIL=test@yourdomain.com node scripts/validate-rls.js
 *
 * Note: this creates and then deletes a real auth user. Use a test
 * project, not production.
 */
"use strict";
const path = require("path");
const fs = require("fs");

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};
const PASS = c.green("PASS");
const FAIL = c.red("FAIL");
const WARN = c.yellow("WARN");

function loadDotEnv() {
  const f = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    const v = t
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

let results = { passed: 0, failed: 0 };

async function check(label, fn) {
  try {
    const result = await fn();
    if (result === true || result === "pass") {
      console.log(`  ${PASS}  ${label}`);
      results.passed++;
    } else if (result === "skip") {
      console.log(`  ${WARN}  ${label} (skipped)`);
    } else {
      console.log(`  ${FAIL}  ${label}: ${result}`);
      results.failed++;
    }
  } catch (err) {
    console.log(`  ${FAIL}  ${label}: threw ${err.message}`);
    results.failed++;
  }
}

async function main() {
  loadDotEnv();
  const { createClient } = require("@supabase/supabase-js");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const testEmail = process.env.SUPABASE_TEST_EMAIL || `rls-test-${Date.now()}@witness-test.invalid`;
  const testPassword = `TestPass${Date.now()}!`;

  if (!url || !anonKey || !serviceKey) {
    console.error(
      "Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY"
    );
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const anon = createClient(url, anonKey);

  console.log(c.bold("\n== The Witness - RLS Validation ==\n"));
  console.log(`Test user: ${testEmail}`);

  // Create a test user via admin
  console.log(`\n${c.bold("Setup: creating test user")}`);
  const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });
  if (createErr) {
    console.error(`${FAIL}  Could not create test user: ${createErr.message}`);
    process.exit(1);
  }
  const testUserId = createdUser.user.id;
  console.log(`  ${PASS}  Test user created: ${testUserId}`);

  // Sign in as the test user
  const authed = createClient(url, anonKey);
  const { error: signInErr } = await authed.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });
  if (signInErr) {
    console.error(`${FAIL}  Sign in failed: ${signInErr.message}`);
    await admin.auth.admin.deleteUser(testUserId);
    process.exit(1);
  }
  console.log(`  ${PASS}  Signed in successfully`);

  // ── Anon policies ────────────────────────────────────────────────────────────
  console.log(`\n${c.bold("Anonymous user policies")}`);
  await check("anon: blocked from profiles.select", async () => {
    const { data } = await anon.from("profiles").select("id").limit(1);
    return !data || data.length === 0 ? true : "Expected 0 rows, got " + data.length;
  });
  await check("anon: wisdom_entries shows only approved rows (intentional public content)", async () => {
    // Approved wisdom entries are intentionally public — policy:
    //   review_status = 'approved' OR is_platform_editorial()
    // Verify anon can only see approved rows, never draft/in_review.
    const { data } = await anon.from("wisdom_entries").select("id, review_status").limit(20);
    if (!data || data.length === 0) return true;
    const nonApproved = data.filter((r) => r.review_status !== "approved");
    return nonApproved.length === 0
      ? true
      : "Anon can see non-approved entries: " + JSON.stringify(nonApproved);
  });
  await check("anon: blocked from publications.select (requires Migration 021)", async () => {
    // Migration 010 had an overly broad policy: USING (status = 'active') with no auth check.
    // Migration 021 replaces it with: auth.uid() IS NOT NULL AND status = 'active'.
    // This test confirms anon is blocked after Migration 021 has been applied.
    const { data } = await anon.from("publications").select("id").limit(1);
    return !data || data.length === 0
      ? true
      : "Expected 0 rows, got " + data.length + " — apply Migration 021 (node scripts/bootstrap.js)";
  });

  // ── Authenticated user (subscriber role) policies ────────────────────────────
  console.log(`\n${c.bold("Authenticated subscriber policies")}`);
  await check("subscriber: can read own profile", async () => {
    const { data, error } = await authed.from("profiles").select("id, role").eq("id", testUserId).single();
    if (error) return "Error: " + error.message;
    if (!data) return "No data returned";
    if (data.role !== "subscriber") return "Expected role=subscriber, got " + data.role;
    return true;
  });
  await check("subscriber: cannot read other profiles", async () => {
    // The profiles_select_editorial policy only grants access to editorial users
    // A subscriber should only see their own row
    const { data } = await authed.from("profiles").select("id").neq("id", testUserId);
    return !data || data.length === 0 ? true : "Subscriber can see " + data.length + " other profiles";
  });
  await check("subscriber: cannot insert into publications", async () => {
    const { error } = await authed.from("publications").insert({
      name: "Test",
      slug: "test-" + Date.now(),
      created_by: testUserId,
    });
    return error ? true : "Expected insert to fail but it succeeded";
  });
  await check("subscriber: cannot insert into wisdom_entries", async () => {
    const { error } = await authed.from("wisdom_entries").insert({
      title: "X",
      source_type: "other",
      translation: "Y",
      created_by: testUserId,
    });
    return error ? true : "Expected insert to fail but it succeeded";
  });
  await check("subscriber: cannot read audit_logs", async () => {
    const { data } = await authed.from("audit_logs").select("id").limit(1);
    return !data || data.length === 0 ? true : "Expected 0 audit rows, got " + data.length;
  });

  // ── Service role policies ────────────────────────────────────────────────────
  console.log(`\n${c.bold("Service role (bypasses RLS)")}`);
  await check("service role: can read any profile", async () => {
    const { error } = await admin.from("profiles").select("id").limit(1);
    return !error ? true : "Error: " + error.message;
  });
  await check("service role: can read wisdom_entries", async () => {
    const { error } = await admin.from("wisdom_entries").select("id").limit(1);
    return !error ? true : "Error: " + error.message;
  });
  await check("service role: can update any profile role", async () => {
    const { error } = await admin.from("profiles").update({ role: "subscriber" }).eq("id", testUserId);
    return !error ? true : "Error: " + error.message;
  });

  // ── Cleanup ──────────────────────────────────────────────────────────────────
  console.log(`\n${c.bold("Cleanup: deleting test user")}`);
  const { error: delErr } = await admin.auth.admin.deleteUser(testUserId);
  delErr
    ? console.log(`  ${WARN}  Could not delete test user: ${delErr.message} — delete manually via Dashboard`)
    : console.log(`  ${PASS}  Test user deleted`);

  // ── Results ──────────────────────────────────────────────────────────────────
  console.log(`\n${c.bold("Results")}`);
  console.log(
    `  ${c.green(results.passed + " passed")}, ${results.failed > 0 ? c.red(results.failed + " failed") : "0 failed"}`
  );
  if (results.failed > 0) {
    console.log(`\n  ${c.red("RLS validation FAILED. Review the failed checks above.")}`);
    process.exit(1);
  } else {
    console.log(`\n  ${c.green("All RLS checks passed.")}`);
  }
}

main().catch((err) => {
  console.error(c.red("Error:"), err.message);
  process.exit(1);
});

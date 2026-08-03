/**
 * scripts/load-test/k6-load-test.js
 *
 * k6 load test for The Witness — Sprint 4 (F-006)
 * Tests the highest-traffic endpoints under realistic concurrent load.
 *
 * Usage:
 *   npm install -g k6          # or: brew install k6
 *   k6 run scripts/load-test/k6-load-test.js \
 *     --env BASE_URL=https://staging.thewitness.app \
 *     --env AUTH_TOKEN=<supabase-anon-key>
 *
 * Thresholds (all must pass for QA sign-off):
 *   p95 response time < 2000ms
 *   p99 response time < 5000ms
 *   Error rate < 1%
 *   /api/health p95 < 500ms
 *
 * Ramp profile: 0 → 50 VUs over 2 minutes, hold for 5 minutes, ramp down.
 * This simulates a realistic burst (e.g. everyone logging in after an email
 * goes out) without the cost of a sustained spike test.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const AUTH_TOKEN = __ENV.AUTH_TOKEN || "";
const ANON_KEY = __ENV.ANON_KEY || "";

// ── Custom metrics ────────────────────────────────────────────────────────────
const errorRate = new Rate("errors");
const healthLatency = new Trend("health_latency");
const publicPageLatency = new Trend("public_page_latency");
const apiLatency = new Trend("api_latency");

// ── Thresholds ─────────────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: "1m", target: 10 }, // Warm up: 0 → 10 VUs
    { duration: "2m", target: 50 }, // Ramp up: 10 → 50 VUs
    { duration: "5m", target: 50 }, // Hold at 50 VUs
    { duration: "1m", target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000", "p(99)<5000"],
    errors: ["rate<0.01"],
    health_latency: ["p(95)<500"],
    public_page_latency: ["p(95)<2000"],
    api_latency: ["p(95)<2000"],
  },
};

// ── Shared headers ─────────────────────────────────────────────────────────────
const baseHeaders = {
  "Content-Type": "application/json",
  apikey: ANON_KEY,
};

const authHeaders = {
  ...baseHeaders,
  Authorization: `Bearer ${AUTH_TOKEN}`,
};

// ── Test scenarios (weighted by expected real-world frequency) ─────────────────
export default function () {
  const scenario = Math.random();

  if (scenario < 0.2) {
    // 20% — Health check (monitoring pings)
    testHealthCheck();
  } else if (scenario < 0.45) {
    // 25% — Public reader (most anonymous traffic)
    testPublicReader();
  } else if (scenario < 0.6) {
    // 15% — Issue list (authenticated editors loading their work)
    testIssueList();
  } else if (scenario < 0.75) {
    // 15% — Wisdom entries (search/browse during content creation)
    testWisdomEntries();
  } else if (scenario < 0.85) {
    // 10% — Publications list
    testPublicationsList();
  } else if (scenario < 0.92) {
    // 7% — Subscribe form submission
    testSubscribeFlow();
  } else {
    // 8% — Search
    testSearch();
  }

  sleep(1 + Math.random() * 2); // 1–3 second think time between requests
}

function testHealthCheck() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/health`);
  healthLatency.add(Date.now() - start);

  const ok = check(res, {
    "health: status 200": (r) => r.status === 200,
    "health: returns ok": (r) => {
      try {
        return JSON.parse(r.body).status === "ok";
      } catch {
        return false;
      }
    },
    "health: < 500ms": (r) => r.timings.duration < 500,
  });
  errorRate.add(!ok);
}

function testPublicReader() {
  const start = Date.now();
  // Test the public publication home — no auth required
  const res = http.get(`${BASE_URL}/p/bmsit-tech-review`, { headers: baseHeaders });
  publicPageLatency.add(Date.now() - start);

  const ok = check(res, {
    "public reader: not 500": (r) => r.status !== 500,
    "public reader: not auth redirect": (r) => r.status !== 302,
    "public reader: < 2s": (r) => r.timings.duration < 2000,
  });
  errorRate.add(!ok);
}

function testIssueList() {
  if (!AUTH_TOKEN) return;
  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/issues?limit=25`, { headers: authHeaders });
  apiLatency.add(Date.now() - start);

  const ok = check(res, {
    "issues list: 200": (r) => r.status === 200,
    "issues list: has pagination": (r) => {
      try {
        const b = JSON.parse(r.body);
        return b.pagination !== undefined;
      } catch {
        return false;
      }
    },
    "issues list: < 2s": (r) => r.timings.duration < 2000,
  });
  errorRate.add(!ok);
}

function testWisdomEntries() {
  if (!AUTH_TOKEN) return;
  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/wisdom-entries?limit=25`, { headers: authHeaders });
  apiLatency.add(Date.now() - start);

  const ok = check(res, {
    "wisdom: 200": (r) => r.status === 200,
    "wisdom: < 2s": (r) => r.timings.duration < 2000,
  });
  errorRate.add(!ok);
}

function testPublicationsList() {
  if (!AUTH_TOKEN) return;
  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/publications`, { headers: authHeaders });
  apiLatency.add(Date.now() - start);

  const ok = check(res, {
    "publications: 200": (r) => r.status === 200,
    "publications: < 2s": (r) => r.timings.duration < 2000,
  });
  errorRate.add(!ok);
}

function testSubscribeFlow() {
  // Use a test email that won't actually receive mail
  const email = `loadtest-${Date.now()}@witness-loadtest.invalid`;
  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/api/publications/00000000-0000-0000-0000-000000000001/subscribe`,
    JSON.stringify({ email }),
    { headers: baseHeaders }
  );
  apiLatency.add(Date.now() - start);

  // 404 is acceptable (test publication doesn't exist in staging)
  // 422 is acceptable (invalid email domain rejected)
  // 429 is acceptable (rate limited — correct behaviour)
  // 500 is not acceptable
  const ok = check(res, {
    "subscribe: not 500": (r) => r.status !== 500,
    "subscribe: < 2s": (r) => r.timings.duration < 2000,
  });
  errorRate.add(!ok);
}

function testSearch() {
  if (!AUTH_TOKEN) return;
  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/graph/entities?type=technology&q=react&limit=10`, {
    headers: authHeaders,
  });
  apiLatency.add(Date.now() - start);

  const ok = check(res, {
    "search: not 500": (r) => r.status !== 500,
    "search: < 2s": (r) => r.timings.duration < 2000,
  });
  errorRate.add(!ok);
}

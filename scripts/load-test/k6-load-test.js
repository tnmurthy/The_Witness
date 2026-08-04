/**
 * scripts/load-test/k6-load-test.js
 *
 * k6 Load Test — The Witness
 * Tests the highest-risk routes under concurrent load:
 *   - Issue Builder autosave (highest write frequency)
 *   - AI Workspace (most expensive per request)
 *   - Public reader (most likely to get real traffic spikes)
 *   - Authentication (shared by every user session)
 *
 * Prerequisites:
 *   brew install k6           (macOS)
 *   choco install k6          (Windows)
 *   or: https://k6.io/docs/getting-started/installation/
 *
 * Usage:
 *   # Smoke test (1 user, 30s) — basic sanity check
 *   TARGET_URL=https://staging.thewitness.app k6 run scripts/load-test/k6-load-test.js
 *
 *   # Load test (50 users, 5 min ramp) — pre-launch validation
 *   TARGET_URL=https://staging.thewitness.app \
 *   TEST_EMAIL=loadtest@yourdomain.com \
 *   TEST_PASSWORD=LoadTest123! \
 *   k6 run --vus 50 --duration 5m scripts/load-test/k6-load-test.js
 *
 *   # Stress test (ramp to 200 users) — find the breaking point
 *   k6 run --stage 1m:50,3m:200,2m:200,1m:0 scripts/load-test/k6-load-test.js
 *
 * Thresholds (fail the test if these are exceeded):
 *   p95 response time < 800ms  (all routes)
 *   error rate < 2%
 *   checks pass rate > 98%
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// ── Configuration ─────────────────────────────────────────────────────────────
const BASE_URL = __ENV.TARGET_URL || "http://localhost:3000";
const TEST_EMAIL = __ENV.TEST_EMAIL || "loadtest@witness-test.invalid";
const TEST_PASSWORD = __ENV.TEST_PASSWORD || "LoadTest123!";
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || "";
const SUPABASE_URL = __ENV.SUPABASE_URL || "";
const PUB_SLUG = __ENV.PUB_SLUG || "bmsit-tech-review";
const ISSUE_SLUG = __ENV.ISSUE_SLUG || "test-issue";

// ── Custom metrics ─────────────────────────────────────────────────────────────
const errorRate = new Rate("error_rate");
const autosaveLatency = new Trend("autosave_latency", true);
const publicReaderLatency = new Trend("public_reader_latency", true);
const aiRouteLatency = new Trend("ai_route_latency", true);

// ── Thresholds ─────────────────────────────────────────────────────────────────
export const options = {
  thresholds: {
    http_req_duration: ["p(95)<800"], // 95th percentile < 800ms
    error_rate: ["rate<0.02"], // error rate < 2%
    http_req_failed: ["rate<0.02"], // HTTP failures < 2%
    autosave_latency: ["p(95)<600"], // autosave should be fast
    public_reader_latency: ["p(95)<1000"], // reader pages can be slightly slower
    checks: ["rate>0.98"], // 98%+ checks should pass
  },
  // Default: smoke test profile. Override with --vus and --duration flags.
  vus: 5,
  duration: "30s",
};

// ── Scenario helpers ───────────────────────────────────────────────────────────
let authToken = null;

function authenticate() {
  if (!SUPABASE_URL || !ANON_KEY) return null;

  const res = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    {
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
      },
    }
  );

  const ok = check(res, {
    "auth: status 200": (r) => r.status === 200,
    "auth: access_token present": (r) => {
      try {
        return !!JSON.parse(r.body).access_token;
      } catch {
        return false;
      }
    },
  });

  if (ok) {
    try {
      return JSON.parse(res.body).access_token;
    } catch {
      return null;
    }
  }
  return null;
}

function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
}

// ── Scenario: Public reader ────────────────────────────────────────────────────
function testPublicReader() {
  const start = Date.now();

  // Publication home page
  const pubRes = http.get(`${BASE_URL}/p/${PUB_SLUG}`, { tags: { name: "public_pub_page" } });
  check(pubRes, {
    "public pub: status 200 or 404": (r) => r.status === 200 || r.status === 404,
    "public pub: not 500": (r) => r.status < 500,
  });
  errorRate.add(pubRes.status >= 500 ? 1 : 0);

  // Issue page
  const issueRes = http.get(`${BASE_URL}/p/${PUB_SLUG}/${ISSUE_SLUG}`, {
    tags: { name: "public_issue_page" },
  });
  check(issueRes, {
    "public issue: not 500": (r) => r.status < 500,
  });
  errorRate.add(issueRes.status >= 500 ? 1 : 0);

  publicReaderLatency.add(Date.now() - start);
  sleep(1);
}

// ── Scenario: Health check ─────────────────────────────────────────────────────
function testHealthCheck() {
  const res = http.get(`${BASE_URL}/api/health`, { tags: { name: "health_check" } });
  check(res, {
    "health: status 200": (r) => r.status === 200,
    "health: database ok": (r) => {
      try {
        return JSON.parse(r.body).checks?.database?.status === "ok";
      } catch {
        return false;
      }
    },
  });
  errorRate.add(res.status !== 200 ? 1 : 0);
  sleep(0.5);
}

// ── Scenario: Authenticated autosave ──────────────────────────────────────────
function testAutosave(token) {
  if (!token) return;

  const start = Date.now();

  // PATCH a block (simulates Issue Builder autosave)
  // Using a dummy ID — will 404, but tests auth middleware and route latency
  const res = http.patch(
    `${BASE_URL}/api/blocks/00000000-0000-0000-0000-000000000001`,
    JSON.stringify({ payload: { text: `Load test content ${Date.now()}` } }),
    { headers: authHeaders(token), tags: { name: "autosave" } }
  );

  check(res, {
    "autosave: not 500": (r) => r.status < 500,
    "autosave: not 401": (r) => r.status !== 401, // auth must work
  });
  errorRate.add(res.status >= 500 ? 1 : 0);
  autosaveLatency.add(Date.now() - start);
  sleep(0.5);
}

// ── Scenario: Issues list ─────────────────────────────────────────────────────
function testIssuesList(token) {
  if (!token) return;

  const res = http.get(`${BASE_URL}/api/issues`, {
    headers: authHeaders(token),
    tags: { name: "issues_list" },
  });

  check(res, {
    "issues list: 200": (r) => r.status === 200,
    "issues list: has pagination": (r) => {
      try {
        return !!JSON.parse(r.body).pagination;
      } catch {
        return false;
      }
    },
  });
  errorRate.add(res.status !== 200 ? 1 : 0);
  sleep(1);
}

// ── Scenario: AI route (rate-limited, low frequency) ──────────────────────────
function testAIRoute(token) {
  if (!token) return;

  const start = Date.now();
  // Calling the AI route with a missing/invalid functionId to avoid
  // actually calling the provider — we're testing the middleware layer
  const res = http.post(`${BASE_URL}/api/ai/run`, JSON.stringify({ functionId: "nonexistent_function" }), {
    headers: authHeaders(token),
    tags: { name: "ai_route" },
  });

  check(res, {
    "ai route: not 500": (r) => r.status < 500,
    "ai route: not 401": (r) => r.status !== 401,
    "ai route: rate limit handled": (r) => r.status === 422 || r.status === 429,
  });
  errorRate.add(res.status >= 500 ? 1 : 0);
  aiRouteLatency.add(Date.now() - start);
  sleep(6); // respect rate limit: 10 req/min = 1 every 6 seconds
}

// ── Main VU loop ──────────────────────────────────────────────────────────────
export function setup() {
  console.log(`Load test target: ${BASE_URL}`);
  console.log(`Public slug: ${PUB_SLUG}`);
}

export default function () {
  // Authenticate once at VU start (k6 runs this function per VU iteration)
  // In real k6, you'd use setup() for shared auth but per-VU auth is simpler
  if (!authToken && SUPABASE_URL && ANON_KEY) {
    authToken = authenticate();
  }

  // Weighted scenario distribution matching expected real traffic
  const scenario = Math.random();

  if (scenario < 0.4) {
    testPublicReader(); // 40% — public readers (no auth)
  } else if (scenario < 0.6) {
    testHealthCheck(); // 20% — uptime monitoring
  } else if (scenario < 0.8) {
    testAutosave(authToken); // 20% — editors autosaving
  } else if (scenario < 0.95) {
    testIssuesList(authToken); // 15% — editors browsing issues
  } else {
    testAIRoute(authToken); // 5%  — AI Workspace usage
  }
}

# Load Testing — The Witness

## Setup

Install k6: https://k6.io/docs/getting-started/installation/

```bash
# macOS
brew install k6

# Windows
choco install k6
# or download from https://github.com/grafana/k6/releases
```

## Running tests

Set env vars before running (or export them):

| Variable            | Description                                      |
| ------------------- | ------------------------------------------------ |
| `TARGET_URL`        | Base URL (default: http://localhost:3000)        |
| `SUPABASE_URL`      | Your Supabase project URL (for auth)             |
| `SUPABASE_ANON_KEY` | Your Supabase anon key                           |
| `TEST_EMAIL`        | Email of a test user with publication membership |
| `TEST_PASSWORD`     | Password for the test user                       |
| `PUB_SLUG`          | Slug of a published test publication             |
| `ISSUE_SLUG`        | Slug of a published test issue                   |

### Smoke test (1 min, 5 users)

```bash
TARGET_URL=https://staging.thewitness.app k6 run scripts/load-test/k6-load-test.js
```

### Pre-launch load test (5 min, 50 concurrent users)

```bash
TARGET_URL=https://staging.thewitness.app \
SUPABASE_URL=https://qfonrbwphrlejphcaiwx.supabase.co \
SUPABASE_ANON_KEY=eyJ... \
TEST_EMAIL=loadtest@yourdomain.com \
TEST_PASSWORD=LoadTest123! \
PUB_SLUG=bmsit-tech-review \
k6 run --vus 50 --duration 5m scripts/load-test/k6-load-test.js
```

### Stress test (find the breaking point)

```bash
k6 run \
  --stage 1m:10,2m:50,2m:100,2m:200,1m:0 \
  --env TARGET_URL=https://staging.thewitness.app \
  scripts/load-test/k6-load-test.js
```

## Thresholds

The test fails if any threshold is exceeded:

| Metric            | Threshold |
| ----------------- | --------- |
| p95 response time | < 800ms   |
| Error rate        | < 2%      |
| Autosave p95      | < 600ms   |
| Checks pass rate  | > 98%     |

## What's being tested

| Scenario                | Weight | Why                                  |
| ----------------------- | ------ | ------------------------------------ |
| Public reader pages     | 40%    | Most likely to spike on real traffic |
| Health check            | 20%    | Baseline / uptime monitor simulation |
| Issue Builder autosave  | 20%    | Highest write frequency in the app   |
| Issues list (paginated) | 15%    | Validates pagination under load      |
| AI route (middleware)   | 5%     | Tests rate limiting middleware       |

## Interpreting results

- **http_req_duration p95 > 800ms**: database connection pool exhaustion or cold starts. Check Supabase → Database → Connections (should use pooler URL).
- **error_rate > 2%**: check Sentry for 500 errors. Common cause: Supabase connection timeout.
- **autosave_latency p95 > 600ms**: PATCH /api/blocks/[id] is slow. Add an index on blocks(section_id, position).
- **429 responses from AI route**: rate limiting is working correctly (expected).

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

/**
 * GET /api/health
 *
 * Real dependency health check. Previously returned a static "ok"
 * without testing anything meaningful — PRR finding 14.2.
 *
 * Checks:
 *   1. The Supabase Postgres connection is reachable
 *   2. The SUPABASE_SERVICE_ROLE_KEY is configured
 *   3. Optionally: which AI providers are configured
 *
 * Returns 200 if all required dependencies are healthy,
 * 503 if any required dependency is down.
 *
 * Designed for external uptime monitors (UptimeRobot, etc.) — checks
 * that genuinely fail in the most common real failure mode (database
 * unreachable), not just that the Node process is running.
 */
export async function GET() {
  const start = Date.now();
  const checks: Record<string, { status: "ok" | "degraded" | "error"; detail?: string }> = {};
  let overallOk = true;

  // 1. Database connectivity via service role (fastest real check)
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("wisdom_categories").select("id").limit(1);
    if (error) {
      checks.database = { status: "error", detail: error.message };
      overallOk = false;
    } else {
      checks.database = { status: "ok" };
    }
  } catch (err) {
    checks.database = { status: "error", detail: err instanceof Error ? err.message : String(err) };
    overallOk = false;
  }

  // 2. AI provider configuration (degraded, not fatal — app works without AI)
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  if (hasOpenAI || hasAnthropic) {
    checks.ai = {
      status: "ok",
      detail: [hasAnthropic && "anthropic", hasOpenAI && "openai"].filter(Boolean).join(", "),
    };
  } else {
    checks.ai = { status: "degraded", detail: "No AI provider configured — AI Workspace unavailable" };
    // Not fatal — the rest of the app works without an AI key
  }

  const latencyMs = Date.now() - start;

  if (!overallOk) {
    logger.error("Health check failed", { checks, latencyMs });
    return NextResponse.json(
      { status: "error", latencyMs, checks, timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { status: "ok", latencyMs, checks, timestamp: new Date().toISOString() },
    {
      headers: {
        // 10-second max-age prevents CDN/proxy caching of health status
        // while allowing a tiny window to avoid slamming the database on
        // high-frequency uptime monitoring pings.
        "Cache-Control": "public, max-age=10",
      },
    }
  );
}

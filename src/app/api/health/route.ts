import { NextResponse } from "next/server";

/**
 * Liveness/readiness endpoint (Milestone 1 acceptance criterion, per the
 * Implementation Plan). Deliberately has no dependencies — it does not
 * check Supabase connectivity — so uptime monitoring can distinguish
 * "the Next.js server process is up" from "the database is reachable"
 * rather than conflating the two into one signal.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "the-witness",
    timestamp: new Date().toISOString(),
  });
}

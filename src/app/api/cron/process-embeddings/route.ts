/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * POST /api/cron/process-embeddings
 *
 * Vercel Cron Job — processes the embedding_jobs queue.
 * Triggered every 5 minutes by Vercel's cron scheduler (vercel.json).
 *
 * Security: validates the CRON_SECRET header to prevent unauthorised
 * queue processing. Vercel sets this automatically when calling cron routes.
 *
 * Flow:
 *   1. Fetch up to BATCH_SIZE pending jobs from embedding_jobs
 *   2. Mark them as 'processing'
 *   3. Fetch the actual content from the source table
 *   4. Generate embeddings via OpenAI text-embedding-3-small
 *   5. Write embeddings back to the source table
 *   6. Mark jobs as 'completed' or 'failed'
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateEmbeddings, extractEmbeddingText } from "@/lib/embeddings/generate";
import { logger } from "@/lib/logger";

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 3;

export async function POST(request: Request) {
  // Validate cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    logger.warn("process-embeddings: OPENAI_API_KEY not configured, skipping");
    return NextResponse.json({ skipped: true, reason: "OPENAI_API_KEY not set" });
  }

  const admin = createAdminClient() as any; // table not yet in generated types

  // 1. Fetch pending jobs (skip items that have exceeded max attempts)
  const { data: jobs, error: fetchErr } = await admin
    .from("embedding_jobs")
    .select("id, table_name, record_id")
    .eq("status", "pending")
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at")
    .limit(BATCH_SIZE);

  if (fetchErr) {
    logger.error("process-embeddings: failed to fetch jobs", { error: fetchErr });
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }

  if (!jobs?.length) {
    return NextResponse.json({ processed: 0, message: "No pending jobs" });
  }

  const jobIds = jobs.map((j: any) => j.id);

  // 2. Mark as processing
  await admin.from("embedding_jobs").update({ status: "processing", attempts: 1 }).in("id", jobIds);

  // 3. Group by table and fetch content
  const byTable = jobs.reduce(
    (acc: Record<string, any[]>, job: any) => {
      (acc[job.table_name] ??= []).push(job);
      return acc;
    },
    {} as Record<string, typeof jobs>
  );

  let completed = 0;
  let failed = 0;

  for (const [tableName, tableJobs] of Object.entries(byTable) as [string, any[]][]) {
    const recordIds = tableJobs.map((j) => j.record_id);

    const { data: rows } = await admin
      .from(tableName as "issues")
      .select("*")
      .in("id", recordIds);

    if (!rows?.length) continue;

    const items = rows
      .map((row: any) => ({
        id: String(row.id),
        text: extractEmbeddingText(tableName, row as Record<string, unknown>),
      }))
      .filter((item: any) => item.text.trim().length > 0);

    try {
      const embeddings = await generateEmbeddings(items);

      for (const result of embeddings as any[]) {
        if (!result) continue;

        // Write embedding back to source table
        const { error: updateErr } = await admin
          .from(tableName as "issues")
          .update({ embedding: result.embedding } as Record<string, unknown>)
          .eq("id", result.id);

        const job = tableJobs.find((j) => j.record_id === result.id);
        if (job) {
          if (updateErr) {
            await admin
              .from("embedding_jobs")
              .update({ status: "failed", error: updateErr.message, processed_at: new Date().toISOString() })
              .eq("id", job.id);
            failed++;
          } else {
            await admin
              .from("embedding_jobs")
              .update({ status: "completed", processed_at: new Date().toISOString() })
              .eq("id", job.id);
            completed++;
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("process-embeddings: embedding generation failed", { tableName, error: message });

      // Mark all jobs for this table as failed
      const failedIds = tableJobs.map((j: any) => j.id);
      await admin
        .from("embedding_jobs")
        .update({ status: "failed", error: message.slice(0, 500), processed_at: new Date().toISOString() })
        .in("id", failedIds);
      failed += tableJobs.length;
    }
  }

  logger.info("process-embeddings: batch complete", { completed, failed, total: jobs.length });
  return NextResponse.json({ processed: jobs.length, completed, failed });
}

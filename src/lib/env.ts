import { z } from "zod";

/**
 * Environment variable management (Milestone 1).
 *
 * Every environment variable the app reads is declared here, once, with a
 * zod schema. Importing from "@/lib/env" instead of reading
 * `process.env.X` directly gets you two things a raw `process.env` read
 * cannot: a build-time/startup failure with a clear message when a
 * required variable is missing or malformed, and full TypeScript
 * autocomplete on `env.NEXT_PUBLIC_SUPABASE_URL` etc. instead of `string |
 * undefined` everywhere.
 *
 * Client-exposed variables MUST be prefixed NEXT_PUBLIC_ (Next.js's own
 * rule) and are validated separately from server-only variables so a
 * server secret can never accidentally end up in the client schema.
 */

const serverSchema = z.object({
  // SUPABASE_SERVICE_ROLE_KEY bypasses Row Level Security by design and
  // must only ever be read on the server. Required at runtime in any
  // deployment where admin-privileged routes are reachable (set
  // REQUIRE_SERVICE_ROLE=true in Vercel environment variables for
  // staging/production). Optional locally and during `next build` in CI
  // where only static analysis runs — the build itself doesn't need admin
  // credentials. PRR finding 2.5 identified this as optional when it
  // should be conditionally required; the REQUIRE_SERVICE_ROLE flag is
  // the correct hook for runtime enforcement without breaking CI builds.
  SUPABASE_SERVICE_ROLE_KEY:
    process.env.REQUIRE_SERVICE_ROLE === "true"
      ? z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required (REQUIRE_SERVICE_ROLE=true)")
      : z.string().min(1).optional(),

  OPENAI_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url({
    message: "NEXT_PUBLIC_SUPABASE_URL must be a valid URL, e.g. https://xyzcompany.supabase.co",
  }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
});

function parseEnv() {
  const serverResult = serverSchema.safeParse(process.env);
  const clientResult = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });

  if (!serverResult.success || !clientResult.success) {
    const issues = [
      ...(serverResult.success ? [] : serverResult.error.issues),
      ...(clientResult.success ? [] : clientResult.error.issues),
    ];
    const formatted = issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    // Thrown at import time so a missing/invalid env var fails fast at
    // startup (or at `next build`) instead of surfacing as a confusing
    // runtime error deep in a Supabase client call.
    throw new Error(
      `Invalid environment variables:\n${formatted}\n\nCopy .env.example to .env.local and fill in real values.`
    );
  }

  return { ...serverResult.data, ...clientResult.data };
}

// In test environments, allow a lazily-mocked env rather than requiring
// every unit test to stub a full Supabase project.
export const env =
  process.env.NODE_ENV === "test" ? (process.env as unknown as ReturnType<typeof parseEnv>) : parseEnv();

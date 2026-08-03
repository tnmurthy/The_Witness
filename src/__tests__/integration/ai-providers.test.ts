/**
 * Real AI provider integration tests.
 * NOT in default test suite — makes real paid API calls.
 *
 * Run with:
 *   ANTHROPIC_API_KEY=sk-ant-... npx vitest run src/__tests__/integration/
 *   OPENAI_API_KEY=sk-...       npx vitest run src/__tests__/integration/
 */
import { describe, it, expect } from "vitest";

const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
const hasOpenAI = !!process.env.OPENAI_API_KEY;

describe.skipIf(!hasAnthropic && !hasOpenAI)("Real AI provider calls — requires API keys", () => {
  describe.skipIf(!hasAnthropic)("Anthropic", () => {
    it("rewrite: produces string output from a real model call", async () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = "placeholder";
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://placeholder.supabase.co";

      const { createClient } = await import("@supabase/supabase-js");
      const { runAIFunction } = await import("@/lib/ai/orchestrator");

      const client = createClient("https://placeholder.supabase.co", "placeholder");
      const result = await runAIFunction(client as never, {
        functionId: "rewrite",
        input: { text: "AI is changing software engineering. Developers need to adapt their workflows." },
        publicationId: "00000000-0000-0000-0000-000000000001",
        actorId: "00000000-0000-0000-0000-000000000002",
        providerId: "anthropic",
      });

      expect(typeof result.output).toBe("string");
      expect((result.output as string).length).toBeGreaterThan(20);
      expect(result.costUsd).toBeGreaterThan(0);
      console.warn("Anthropic rewrite output:", (result.output as string).slice(0, 100));
    }, 30000);
  });

  describe.skipIf(!hasOpenAI)("OpenAI", () => {
    it("rewrite: produces string output from a real model call", async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const { runAIFunction } = await import("@/lib/ai/orchestrator");

      const client = createClient("https://placeholder.supabase.co", "placeholder");
      const result = await runAIFunction(client as never, {
        functionId: "rewrite",
        input: { text: "Machine learning is now embedded in everyday developer tools." },
        publicationId: "00000000-0000-0000-0000-000000000001",
        actorId: "00000000-0000-0000-0000-000000000002",
        providerId: "openai",
      });

      expect(typeof result.output).toBe("string");
      expect((result.output as string).length).toBeGreaterThan(20);
      console.warn("OpenAI rewrite output:", (result.output as string).slice(0, 100));
    }, 30000);
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

describe("cn", () => {
  it("merges class names and resolves Tailwind conflicts in favor of the later class", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("drops falsy values", () => {
    expect(cn("text-sm", false && "hidden", undefined, "font-medium")).toBe("text-sm font-medium");
  });
});

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits a single structured JSON line with level, message, and timestamp", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("hello world", { publicationId: "abc-123" });

    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0]?.[0] as string);
    expect(parsed.level).toBe("info");
    expect(parsed.message).toBe("hello world");
    expect(parsed.context).toEqual({ publicationId: "abc-123" });
    expect(typeof parsed.timestamp).toBe("string");
  });

  it("serializes an Error's stack trace instead of logging an empty object", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("something broke", { error: new Error("boom") });

    const parsed = JSON.parse(spy.mock.calls[0]?.[0] as string);
    expect(parsed.context.error.message).toBe("boom");
    expect(typeof parsed.context.error.stack).toBe("string");
  });
});

import { describe, it, expect } from "vitest";
import {
  createPublicationSchema,
  publishingScheduleSchema,
  updateBrandingSchema,
  createAiPromptTemplateSchema,
} from "@/lib/validation/publications";
import { canCreatePublicationRole } from "@/lib/auth/publication-permissions";

describe("createPublicationSchema", () => {
  it("accepts a valid publication", () => {
    const result = createPublicationSchema.safeParse({
      name: "The Witness",
      slug: "the-witness",
      description: "48-hour technology intelligence.",
      cadence: "48h",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a slug with uppercase letters or spaces", () => {
    expect(createPublicationSchema.safeParse({ name: "The Witness", slug: "The Witness" }).success).toBe(
      false
    );
    expect(createPublicationSchema.safeParse({ name: "The Witness", slug: "The-Witness" }).success).toBe(
      false
    );
  });

  it("accepts a slug with hyphens between lowercase segments", () => {
    expect(
      createPublicationSchema.safeParse({ name: "Career Compass", slug: "career-compass" }).success
    ).toBe(true);
  });

  it("rejects a name shorter than 2 characters", () => {
    expect(createPublicationSchema.safeParse({ name: "X", slug: "valid-slug" }).success).toBe(false);
  });
});

describe("publishingScheduleSchema", () => {
  it("accepts a well-formed schedule", () => {
    const result = publishingScheduleSchema.safeParse({
      frequency: "weekly",
      daysOfWeek: ["tuesday", "thursday"],
      timeOfDay: "07:00",
      timezone: "America/New_York",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid frequency", () => {
    expect(publishingScheduleSchema.safeParse({ frequency: "hourly" }).success).toBe(false);
  });

  it("rejects a malformed time (not 24-hour HH:MM)", () => {
    expect(publishingScheduleSchema.safeParse({ frequency: "daily", timeOfDay: "7am" }).success).toBe(false);
    expect(publishingScheduleSchema.safeParse({ frequency: "daily", timeOfDay: "25:00" }).success).toBe(
      false
    );
  });

  it("defaults daysOfWeek to an empty array and timezone to UTC", () => {
    const result = publishingScheduleSchema.parse({ frequency: "monthly" });
    expect(result.daysOfWeek).toEqual([]);
    expect(result.timezone).toBe("UTC");
  });
});

describe("updateBrandingSchema", () => {
  it("accepts valid 6-digit hex colors", () => {
    expect(updateBrandingSchema.safeParse({ primaryColor: "#2E3A59", accentColor: "#8A6600" }).success).toBe(
      true
    );
  });

  it("rejects a 3-digit hex shorthand or a named color", () => {
    expect(updateBrandingSchema.safeParse({ primaryColor: "#fff" }).success).toBe(false);
    expect(updateBrandingSchema.safeParse({ primaryColor: "navy" }).success).toBe(false);
  });

  it("allows an empty object — every field is optional for partial updates", () => {
    expect(updateBrandingSchema.safeParse({}).success).toBe(true);
  });
});

describe("createAiPromptTemplateSchema", () => {
  it("accepts a valid template", () => {
    const result = createAiPromptTemplateSchema.safeParse({
      blockType: "hero_story",
      name: "Analytical hero story",
      templateText: "Write about {{topic}}",
    });
    expect(result.success).toBe(true);
  });

  it("defaults variables to an empty array", () => {
    const result = createAiPromptTemplateSchema.parse({
      blockType: "hero_story",
      name: "X",
      templateText: "Y",
    });
    expect(result.variables).toEqual([]);
  });

  it("rejects an empty template text", () => {
    expect(
      createAiPromptTemplateSchema.safeParse({ blockType: "x", name: "y", templateText: "" }).success
    ).toBe(false);
  });
});

describe("canCreatePublicationRole", () => {
  it("allows super_admin and editor_in_chief", () => {
    expect(canCreatePublicationRole("super_admin")).toBe(true);
    expect(canCreatePublicationRole("editor_in_chief")).toBe(true);
  });

  it("denies every other role, including editor", () => {
    expect(canCreatePublicationRole("editor")).toBe(false);
    expect(canCreatePublicationRole("writer")).toBe(false);
    expect(canCreatePublicationRole("researcher")).toBe(false);
    expect(canCreatePublicationRole("subscriber")).toBe(false);
    expect(canCreatePublicationRole("premium_subscriber")).toBe(false);
  });

  it("denies when role is undefined (no profile row yet)", () => {
    expect(canCreatePublicationRole(undefined)).toBe(false);
  });
});

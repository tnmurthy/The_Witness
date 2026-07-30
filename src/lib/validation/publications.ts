import { z } from "zod";

/**
 * Publishing schedule shape — deliberately loose at the database level
 * (jsonb, no check constraint; see Migration 014's column comment) but
 * validated strictly here at the application boundary. This is the
 * single place that shape is enforced; the API routes and forms both
 * import from here rather than re-declaring it.
 */
export const publishingScheduleSchema = z.object({
  frequency: z.enum(["daily", "weekly", "biweekly", "monthly", "custom"]),
  daysOfWeek: z
    .array(z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]))
    .default([]),
  timeOfDay: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM format")
    .optional(),
  timezone: z.string().default("UTC"),
});
export type PublishingSchedule = z.infer<typeof publishingScheduleSchema>;

export const createPublicationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(200),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, numbers, and hyphens only"),
  description: z.string().max(500).optional(),
  cadence: z.string().max(100).optional(),
});
export type CreatePublicationInput = z.infer<typeof createPublicationSchema>;

export const updatePublicationGeneralSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(500).optional().nullable(),
  cadence: z.string().max(100).optional().nullable(),
});
export type UpdatePublicationGeneralInput = z.infer<typeof updatePublicationGeneralSchema>;

export const updateBrandingSchema = z.object({
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Use a 6-digit hex color")
    .optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Use a 6-digit hex color")
    .optional(),
  fontVoice: z.string().max(100).optional(),
});
export type UpdateBrandingInput = z.infer<typeof updateBrandingSchema>;

export const updateEditorialGuidelinesSchema = z.object({
  editorialGuidelines: z.string().max(20000).optional(),
});
export type UpdateEditorialGuidelinesInput = z.infer<typeof updateEditorialGuidelinesSchema>;

export const updatePublishingScheduleSchema = publishingScheduleSchema;

export const templateChannelSchema = z.enum(["email", "pdf", "web"]);

export const updateTemplateConfigSchema = z.object({
  channel: templateChannelSchema,
  config: z.record(z.string(), z.unknown()),
});
export type UpdateTemplateConfigInput = z.infer<typeof updateTemplateConfigSchema>;

export const createAiPromptTemplateSchema = z.object({
  blockType: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  templateText: z.string().min(1).max(10000),
  variables: z.array(z.string()).default([]),
});
export type CreateAiPromptTemplateInput = z.infer<typeof createAiPromptTemplateSchema>;

export const updateAiPromptTemplateSchema = createAiPromptTemplateSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateAiPromptTemplateInput = z.infer<typeof updateAiPromptTemplateSchema>;

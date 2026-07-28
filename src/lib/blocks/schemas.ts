import { z } from "zod";

/**
 * One payload schema per implemented block type. This is the concrete
 * enforcement of blocks_payload_is_object's design intent (Database
 * Schema Design doc, Section 7.2): the database only guarantees payload
 * is *a* JSON object; per-type shape validation happens here, at the
 * application boundary, exactly as that section says it would.
 */

export const headingPayloadSchema = z.object({
  text: z.string().min(1, "Heading text is required").max(200),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
});

export const paragraphPayloadSchema = z.object({
  text: z.string().min(1, "Paragraph text is required").max(5000),
});

export const imagePayloadSchema = z.object({
  url: z.string().url("Enter a valid image URL"),
  alt: z.string().min(1, "Alt text is required for accessibility").max(300),
  caption: z.string().max(300).optional(),
});

export const tableBlockPayloadSchema = z.object({
  headers: z.array(z.string().max(100)).min(1, "At least one column is required"),
  rows: z.array(z.array(z.string().max(500))),
});

export const heroStoryPayloadSchema = z.object({
  eyebrow: z.string().max(60).optional(),
  headline: z.string().min(1, "Headline is required").max(200),
  dek: z.string().max(400).optional(),
  body: z.string().min(1, "Body is required").max(10000),
  imageUrl: z.string().url().optional().or(z.literal("")),
});

export const signalCardPayloadSchema = z.object({
  eyebrow: z.string().max(60).default("Signal"),
  headline: z.string().min(1, "Headline is required").max(200),
  body: z.string().min(1, "Body is required").max(2000),
});

export const careerInsightPayloadSchema = z.object({
  headline: z.string().min(1, "Headline is required").max(200),
  body: z.string().min(1, "Body is required").max(3000),
  actionItems: z.array(z.string().max(300)).default([]),
});

export const researchSummaryPayloadSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  authors: z.string().max(300).optional(),
  url: z.string().url().optional().or(z.literal("")),
  summary: z.string().min(1, "Summary is required").max(3000),
});

export const githubRepositoryBlockPayloadSchema = z.object({
  owner: z.string().min(1, "Owner is required").max(100),
  repo: z.string().min(1, "Repository name is required").max(100),
  url: z.string().url("Enter a valid GitHub URL"),
  description: z.string().max(500).optional(),
});

export const companyProfilePayloadSchema = z.object({
  name: z.string().min(1, "Company name is required").max(200),
  url: z.string().url().optional().or(z.literal("")),
  description: z.string().min(1, "Description is required").max(2000),
});

export const timelineEventSchema = z.object({
  date: z.string().min(1, "Date is required").max(60),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
});
export const timelinePayloadSchema = z.object({
  events: z.array(timelineEventSchema).min(1, "Add at least one event"),
});

export const quotePayloadSchema = z.object({
  text: z.string().min(1, "Quote text is required").max(2000),
  attribution: z.string().max(200).optional(),
});

export const reflectionPayloadSchema = z.object({
  question: z.string().min(1, "Reflection question is required").max(500),
  promptHelp: z.string().max(1000).optional(),
});

export const todaysWisdomPayloadSchema = z.object({
  sourceText: z.string().max(2000).optional(),
  iast: z.string().max(2000).optional(),
  translation: z.string().min(1, "Translation is required").max(2000),
  context: z.string().max(500).optional(),
  source: z.string().max(200).optional(),
  wisdomEntryId: z.string().uuid().optional(),
});

export const checklistItemSchema = z.object({
  text: z.string().min(1).max(300),
  done: z.boolean().default(false),
});
export const actionChecklistPayloadSchema = z.object({
  items: z.array(checklistItemSchema).min(1, "Add at least one item"),
});

/** Central lookup — every place that needs "the schema for type X" imports from here rather than re-deriving the mapping. */
export const BLOCK_PAYLOAD_SCHEMAS = {
  heading: headingPayloadSchema,
  paragraph: paragraphPayloadSchema,
  image: imagePayloadSchema,
  table_block: tableBlockPayloadSchema,
  hero_story: heroStoryPayloadSchema,
  signal_card: signalCardPayloadSchema,
  career_insight: careerInsightPayloadSchema,
  research_summary: researchSummaryPayloadSchema,
  github_repository_block: githubRepositoryBlockPayloadSchema,
  company_profile: companyProfilePayloadSchema,
  timeline: timelinePayloadSchema,
  quote: quotePayloadSchema,
  reflection: reflectionPayloadSchema,
  todays_wisdom: todaysWisdomPayloadSchema,
  action_checklist: actionChecklistPayloadSchema,
} as const;

export type HeadingPayload = z.infer<typeof headingPayloadSchema>;
export type ParagraphPayload = z.infer<typeof paragraphPayloadSchema>;
export type ImagePayload = z.infer<typeof imagePayloadSchema>;
export type TableBlockPayload = z.infer<typeof tableBlockPayloadSchema>;
export type HeroStoryPayload = z.infer<typeof heroStoryPayloadSchema>;
export type SignalCardPayload = z.infer<typeof signalCardPayloadSchema>;
export type CareerInsightPayload = z.infer<typeof careerInsightPayloadSchema>;
export type ResearchSummaryPayload = z.infer<typeof researchSummaryPayloadSchema>;
export type GithubRepositoryBlockPayload = z.infer<typeof githubRepositoryBlockPayloadSchema>;
export type CompanyProfilePayload = z.infer<typeof companyProfilePayloadSchema>;
export type TimelinePayload = z.infer<typeof timelinePayloadSchema>;
export type QuotePayload = z.infer<typeof quotePayloadSchema>;
export type ReflectionPayload = z.infer<typeof reflectionPayloadSchema>;
export type TodaysWisdomPayload = z.infer<typeof todaysWisdomPayloadSchema>;
export type ActionChecklistPayload = z.infer<typeof actionChecklistPayloadSchema>;

/**
 * Validates a raw jsonb payload against its type's schema. Used both
 * server-side (API routes, before persisting) and client-side (form
 * validation in the block editor). Returns a discriminated result rather
 * than throwing, since a malformed payload from a pre-validation-era row
 * or a partially-written AI draft should degrade to a visible error state
 * in the UI, not crash the canvas.
 */
export function validateBlockPayload(type: string, payload: unknown) {
  const schema = BLOCK_PAYLOAD_SCHEMAS[type as keyof typeof BLOCK_PAYLOAD_SCHEMAS];
  if (!schema) {
    return { success: false as const, error: `No schema registered for block type "${type}"` };
  }
  const result = schema.safeParse(payload);
  if (!result.success) {
    return { success: false as const, error: result.error.issues.map((i) => i.message).join("; ") };
  }
  return { success: true as const, data: result.data };
}

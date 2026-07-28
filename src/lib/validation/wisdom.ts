import { z } from "zod";

/**
 * Wisdom Engine validation (Milestone 7). One schema per source type's
 * specialization fields, so the API layer validates the right shape for
 * whichever source_type the caller sent — a Panchatantra entry without
 * tantra_number is rejected the same way a Gītā verse without a chapter
 * is.
 */

export const wisdomSourceTypeSchema = z.enum([
  "subhashitam",
  "gita_verse",
  "advaita_principle",
  "upanishad_verse",
  "chanakya_niti_verse",
  "panchatantra_tale",
  "hitopadesha_story",
  "other",
]);
export type WisdomSourceType = z.infer<typeof wisdomSourceTypeSchema>;

export const WISDOM_SOURCE_LABELS: Record<WisdomSourceType, string> = {
  gita_verse: "Bhagavad Gītā",
  advaita_principle: "Advaita Vedānta",
  upanishad_verse: "Upaniṣads",
  subhashitam: "Sanskrit Subhāṣitam",
  chanakya_niti_verse: "Chanakya Nīti",
  panchatantra_tale: "Panchatantra",
  hitopadesha_story: "Hitopadeśa",
  other: "Other",
};

const gitaVerseFieldsSchema = z.object({ chapter: z.number().int().min(1), verse: z.number().int().min(1) });
const advaitaFieldsSchema = z.object({ sourceWork: z.string().max(200).optional(), traditionNote: z.string().max(1000).optional() });
const subhashitamFieldsSchema = z.object({ meter: z.string().max(100).optional(), attributedTo: z.string().max(200).optional() });
const upanishadFieldsSchema = z.object({ upanishadName: z.string().min(1).max(200), chapter: z.number().int().min(1).optional(), verse: z.number().int().min(1).optional() });
const chanakyaFieldsSchema = z.object({ chapter: z.number().int().min(1), verse: z.number().int().min(1) });
const panchatantraFieldsSchema = z.object({
  tantraNumber: z.number().int().min(1).max(5),
  tantraName: z.string().min(1).max(200),
  taleTitle: z.string().min(1).max(300),
});
const hitopadeshaFieldsSchema = z.object({ sectionName: z.string().min(1).max(200), storyTitle: z.string().min(1).max(300) });

export function sourceFieldsSchemaFor(sourceType: WisdomSourceType) {
  switch (sourceType) {
    case "gita_verse":
      return gitaVerseFieldsSchema;
    case "advaita_principle":
      return advaitaFieldsSchema;
    case "subhashitam":
      return subhashitamFieldsSchema;
    case "upanishad_verse":
      return upanishadFieldsSchema;
    case "chanakya_niti_verse":
      return chanakyaFieldsSchema;
    case "panchatantra_tale":
      return panchatantraFieldsSchema;
    case "hitopadesha_story":
      return hitopadeshaFieldsSchema;
    case "other":
      return null;
  }
}

export const wisdomCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, numbers, and hyphens only"),
  description: z.string().max(500).optional(),
});
export type WisdomCategoryInput = z.infer<typeof wisdomCategorySchema>;

/**
 * The full entry — all 13 fields this milestone's brief lists: Sanskrit
 * (sourceText), Transliteration (iast), Translation, Commentary, Source
 * (source_type + the specialization fields + the free-text `source`
 * display label), Keywords, Category, Technology/Career/Leadership
 * Lens, Reflection (reflectionQuestions), Practical Exercise (exercises),
 * Related Wisdom (relatedWisdomIds — stored via knowledge_graph_edges,
 * see docs/WISDOM_ENGINE.md). Decision Lens exists in the schema
 * (006_wisdom_engine.sql) but isn't one of the four lenses this
 * milestone's brief names (Technology/Career/Leadership only) — kept
 * optional here for backward compatibility with the existing column
 * rather than removed.
 */
export const createWisdomEntrySchema = z.object({
  categoryId: z.string().uuid().optional(),
  title: z.string().min(1, "Title is required").max(300),
  sourceType: wisdomSourceTypeSchema,
  sourceText: z.string().max(2000).optional(),
  iast: z.string().max(2000).optional(),
  translation: z.string().min(1, "Translation is required").max(2000),
  context: z.string().max(1000).optional(),
  commentary: z.string().max(5000).optional(),
  source: z.string().max(200).optional(),
  keywords: z.array(z.string().max(60)).default([]),
  techLens: z.string().max(2000).optional(),
  careerLens: z.string().max(2000).optional(),
  leadershipLens: z.string().max(2000).optional(),
  decisionLens: z.string().max(2000).optional(),
  reflectionQuestions: z.array(z.string().min(1).max(500)).default([]),
  exercises: z.array(z.string().min(1).max(500)).default([]),
  relatedWisdomIds: z.array(z.string().uuid()).default([]),
  sourceFields: z.record(z.string(), z.unknown()).optional(),
});
export type CreateWisdomEntryInput = z.infer<typeof createWisdomEntrySchema>;

export const updateWisdomEntrySchema = createWisdomEntrySchema.partial();
export type UpdateWisdomEntryInput = z.infer<typeof updateWisdomEntrySchema>;

export const wisdomReviewStatusSchema = z.enum(["draft", "in_review", "approved", "rejected"]);

export const recommendWisdomRequestSchema = z.object({
  count: z.number().int().min(1).max(5).default(3),
});

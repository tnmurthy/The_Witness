import type { SupabaseClient } from "@supabase/supabase-js";
import type { WisdomSourceType } from "@/lib/validation/wisdom";

const TABLE_BY_SOURCE_TYPE: Partial<Record<WisdomSourceType, string>> = {
  gita_verse: "gita_verses",
  advaita_principle: "advaita_principles",
  subhashitam: "subhashitams",
  upanishad_verse: "upanishad_verses",
  chanakya_niti_verse: "chanakya_niti_verses",
  panchatantra_tale: "panchatantra_tales",
  hitopadesha_story: "hitopadesha_stories",
};

const COLUMN_MAP: Record<string, string> = {
  sourceWork: "source_work",
  traditionNote: "tradition_note",
  attributedTo: "attributed_to",
  upanishadName: "upanishad_name",
  tantraNumber: "tantra_number",
  tantraName: "tantra_name",
  taleTitle: "tale_title",
  sectionName: "section_name",
  storyTitle: "story_title",
};

function toSnakeCaseFields(fields: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    result[COLUMN_MAP[key] ?? key] = value;
  }
  return result;
}

/**
 * Upserts the source-specific specialization row (gita_verses,
 * panchatantra_tales, etc.) for a wisdom entry — the 1:1 child-table
 * pattern established in 006_wisdom_engine.sql and extended to all 7
 * sources by Migration 018. 'other' has no specialization table and is a
 * deliberate no-op here, not an error.
 */
export async function upsertWisdomSourceFields(
  supabase: SupabaseClient,
  wisdomEntryId: string,
  sourceType: WisdomSourceType,
  fields: Record<string, unknown> | undefined
): Promise<{ error: string | null }> {
  const table = TABLE_BY_SOURCE_TYPE[sourceType];
  if (!table) return { error: null };

  if (!fields) return { error: `sourceFields is required for source type "${sourceType}"` };

  const { error } = await supabase
    .from(table)
    .upsert({ wisdom_entry_id: wisdomEntryId, ...toSnakeCaseFields(fields) });

  return { error: error?.message ?? null };
}

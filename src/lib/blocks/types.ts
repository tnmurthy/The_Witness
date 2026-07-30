/**
 * Block types — Milestone 5 (Issue Builder).
 *
 * Mirrors the `block_type` Postgres enum exactly (supabase/migrations/
 * 001_extensions_and_conventions.sql). That enum has 19 values; this
 * milestone implements editors/renderers for the 15 named in its brief.
 * The remaining four (chart, book_recommendation, technology_radar,
 * decision_framework) remain valid database values — a row with one of
 * those types won't be rejected — they just render as an "unsupported
 * block type" fallback (see block-renderer.tsx) until a later milestone
 * adds them, the same incremental pattern the rest of this schema
 * follows.
 *
 * Two labels intentionally differ from their enum value, per this
 * milestone's brief using different names than the original schema
 * design: `signal_card` displays as "Technology Signal" and
 * `research_summary` displays as "Research Paper." The enum values
 * themselves are unchanged — renaming a Postgres enum label that other
 * code and existing rows may reference is exactly the kind of migration
 * risk documented in Migration 013's rename-recreate dance; a display
 * label is a free, zero-risk way to reconcile naming without touching
 * the database at all.
 */
export const IMPLEMENTED_BLOCK_TYPES = [
  "heading",
  "paragraph",
  "image",
  "table_block",
  "hero_story",
  "signal_card",
  "career_insight",
  "research_summary",
  "github_repository_block",
  "company_profile",
  "timeline",
  "quote",
  "reflection",
  "todays_wisdom",
  "action_checklist",
] as const;

export type ImplementedBlockType = (typeof IMPLEMENTED_BLOCK_TYPES)[number];

/** Every block_type the database enum accepts, including the four not yet implemented in the UI — used to type raw rows read from the database so an unimplemented type doesn't fail to typecheck, only to render richly. */
export const ALL_BLOCK_TYPES = [
  ...IMPLEMENTED_BLOCK_TYPES,
  "chart",
  "book_recommendation",
  "technology_radar",
  "decision_framework",
] as const;

export function isImplementedBlockType(type: string): type is ImplementedBlockType {
  return (IMPLEMENTED_BLOCK_TYPES as readonly string[]).includes(type);
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createWisdomEntrySchema, sourceFieldsSchemaFor } from "@/lib/validation/wisdom";
import { upsertWisdomSourceFields } from "@/lib/wisdom/source-fields";
import { logger } from "@/lib/logger";

/**
 * GET /api/wisdom-entries?search=&category=&sourceType=&reviewStatus=
 *
 * `search` uses wisdom_entries.search_vector (the generated tsvector
 * column Migration 008 already added) via Postgres full-text search —
 * this is the "Search" this milestone's brief asks for, deliberately
 * scoped to the Wisdom Engine library rather than building a second,
 * separate global search system ahead of Milestone 8. RLS
 * (wisdom_entries_select_approved, 006_wisdom_engine.sql) already
 * restricts non-approved entries to editorial staff, so this route adds
 * no additional visibility logic beyond the filters themselves.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const categoryId = searchParams.get("category");
  const sourceType = searchParams.get("sourceType");
  const reviewStatus = searchParams.get("reviewStatus");

  let query = supabase
    .from("wisdom_entries")
    .select("id, title, source_type, translation, category_id, keywords, review_status, created_at, wisdom_categories(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (search) query = query.textSearch("search_vector", search, { type: "websearch" });
  if (categoryId) query = query.eq("category_id", categoryId);
  if (sourceType) query = query.eq("source_type", sourceType);
  if (reviewStatus) query = query.eq("review_status", reviewStatus);

  const { data, error } = await query;

  if (error) {
    logger.error("Failed to list wisdom entries", { error, userId: user.id });
    return NextResponse.json({ error: "Failed to load wisdom entries" }, { status: 500 });
  }

  return NextResponse.json({ entries: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const editorialRoles = ["super_admin", "editor_in_chief", "editor", "writer", "researcher"];
  if (!profile?.role || !editorialRoles.includes(profile.role)) {
    return NextResponse.json({ error: "Editorial staff only" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createWisdomEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  const sourceSchema = sourceFieldsSchemaFor(parsed.data.sourceType);
  if (sourceSchema) {
    const sourceValidation = sourceSchema.safeParse(parsed.data.sourceFields ?? {});
    if (!sourceValidation.success) {
      return NextResponse.json({ error: "Invalid source-specific fields", issues: sourceValidation.error.issues }, { status: 422 });
    }
  }

  const { data: entry, error } = await supabase
    .from("wisdom_entries")
    .insert({
      category_id: parsed.data.categoryId ?? null,
      title: parsed.data.title,
      source_type: parsed.data.sourceType,
      source_text: parsed.data.sourceText ?? null,
      iast: parsed.data.iast ?? null,
      translation: parsed.data.translation,
      context: parsed.data.context ?? null,
      commentary: parsed.data.commentary ?? null,
      tech_lens: parsed.data.techLens ?? null,
      career_lens: parsed.data.careerLens ?? null,
      leadership_lens: parsed.data.leadershipLens ?? null,
      decision_lens: parsed.data.decisionLens ?? null,
      keywords: parsed.data.keywords,
      references_json: parsed.data.source ? [{ label: parsed.data.source }] : [],
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !entry) {
    logger.error("Failed to create wisdom entry", { error, userId: user.id });
    return NextResponse.json({ error: "Failed to create wisdom entry" }, { status: 500 });
  }

  const { error: sourceFieldsError } = await upsertWisdomSourceFields(supabase, entry.id, parsed.data.sourceType, parsed.data.sourceFields);
  if (sourceFieldsError) {
    logger.error("Wisdom entry created but source fields failed", { error: sourceFieldsError, entryId: entry.id });
  }

  if (parsed.data.reflectionQuestions.length > 0) {
    await supabase
      .from("wisdom_reflection_questions")
      .insert(parsed.data.reflectionQuestions.map((question, position) => ({ wisdom_entry_id: entry.id, question, position })));
  }
  if (parsed.data.exercises.length > 0) {
    await supabase.from("wisdom_exercises").insert(parsed.data.exercises.map((exercise, position) => ({ wisdom_entry_id: entry.id, exercise, position })));
  }
  if (parsed.data.relatedWisdomIds.length > 0) {
    await supabase.from("knowledge_graph_edges").insert(
      parsed.data.relatedWisdomIds.map((targetId) => ({
        source_type: "wisdom_entry",
        source_id: entry.id,
        target_type: "wisdom_entry",
        target_id: targetId,
        relation_type: "related",
        created_by: user.id,
      }))
    );
  }

  return NextResponse.json({ entry }, { status: 201 });
}

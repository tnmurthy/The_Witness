import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  updateWisdomEntrySchema,
  sourceFieldsSchemaFor,
  type WisdomSourceType,
} from "@/lib/validation/wisdom";
import { upsertWisdomSourceFields } from "@/lib/wisdom/source-fields";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const SOURCE_TABLE_BY_TYPE: Partial<Record<WisdomSourceType, string>> = {
  gita_verse: "gita_verses",
  advaita_principle: "advaita_principles",
  subhashitam: "subhashitams",
  upanishad_verse: "upanishad_verses",
  chanakya_niti_verse: "chanakya_niti_verses",
  panchatantra_tale: "panchatantra_tales",
  hitopadesha_story: "hitopadesha_stories",
};

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: entry, error } = await supabase
    .from("wisdom_entries")
    .select(
      "*, wisdom_categories(id, name), wisdom_reflection_questions(id, question, position), wisdom_exercises(id, exercise, position)"
    )
    .eq("id", id)
    .single();

  if (error || !entry) {
    return NextResponse.json({ error: "Wisdom entry not found" }, { status: 404 });
  }

  // Fetch whichever specialization table matches this entry's source_type
  // — a single-row lookup, not a join across all 7 tables for the 6 that
  // will always be empty for a given entry.
  let sourceFields: Record<string, unknown> | null = null;
  const table = SOURCE_TABLE_BY_TYPE[entry.source_type as WisdomSourceType];
  if (table) {
    const { data } = await supabase.from(table).select("*").eq("wisdom_entry_id", id).maybeSingle();
    sourceFields = data;
  }

  const { data: relatedEdges } = await supabase
    .from("knowledge_graph_edges")
    .select("target_id")
    .eq("source_type", "wisdom_entry")
    .eq("source_id", id)
    .eq("target_type", "wisdom_entry");

  return NextResponse.json({
    entry,
    sourceFields,
    relatedWisdomIds: (relatedEdges ?? []).map((e) => e.target_id),
  });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
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
  const parsed = updateWisdomEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.categoryId !== undefined) update.category_id = parsed.data.categoryId;
  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.sourceType !== undefined) update.source_type = parsed.data.sourceType;
  if (parsed.data.sourceText !== undefined) update.source_text = parsed.data.sourceText;
  if (parsed.data.iast !== undefined) update.iast = parsed.data.iast;
  if (parsed.data.translation !== undefined) update.translation = parsed.data.translation;
  if (parsed.data.context !== undefined) update.context = parsed.data.context;
  if (parsed.data.commentary !== undefined) update.commentary = parsed.data.commentary;
  if (parsed.data.techLens !== undefined) update.tech_lens = parsed.data.techLens;
  if (parsed.data.careerLens !== undefined) update.career_lens = parsed.data.careerLens;
  if (parsed.data.leadershipLens !== undefined) update.leadership_lens = parsed.data.leadershipLens;
  if (parsed.data.decisionLens !== undefined) update.decision_lens = parsed.data.decisionLens;
  if (parsed.data.keywords !== undefined) update.keywords = parsed.data.keywords;

  const { data: entry, error } = await supabase
    .from("wisdom_entries")
    .update(update)
    .eq("id", id)
    .select("id, source_type")
    .single();

  if (error || !entry) {
    logger.error("Failed to update wisdom entry", { error, entryId: id });
    return NextResponse.json({ error: "Failed to update wisdom entry" }, { status: 500 });
  }

  if (parsed.data.sourceFields) {
    const sourceType = (parsed.data.sourceType ?? entry.source_type) as WisdomSourceType;
    const sourceSchema = sourceFieldsSchemaFor(sourceType);
    if (sourceSchema) {
      const validation = sourceSchema.safeParse(parsed.data.sourceFields);
      if (!validation.success) {
        return NextResponse.json(
          { error: "Invalid source-specific fields", issues: validation.error.issues },
          { status: 422 }
        );
      }
      await upsertWisdomSourceFields(supabase, id, sourceType, parsed.data.sourceFields);
    }
  }

  if (parsed.data.reflectionQuestions !== undefined) {
    await supabase.from("wisdom_reflection_questions").delete().eq("wisdom_entry_id", id);
    if (parsed.data.reflectionQuestions.length > 0) {
      await supabase.from("wisdom_reflection_questions").insert(
        parsed.data.reflectionQuestions.map((question, position) => ({
          wisdom_entry_id: id,
          question,
          position,
        }))
      );
    }
  }
  if (parsed.data.exercises !== undefined) {
    await supabase.from("wisdom_exercises").delete().eq("wisdom_entry_id", id);
    if (parsed.data.exercises.length > 0) {
      await supabase
        .from("wisdom_exercises")
        .insert(
          parsed.data.exercises.map((exercise, position) => ({ wisdom_entry_id: id, exercise, position }))
        );
    }
  }
  if (parsed.data.relatedWisdomIds !== undefined) {
    await supabase
      .from("knowledge_graph_edges")
      .delete()
      .eq("source_type", "wisdom_entry")
      .eq("source_id", id)
      .eq("target_type", "wisdom_entry");
    if (parsed.data.relatedWisdomIds.length > 0) {
      await supabase.from("knowledge_graph_edges").insert(
        parsed.data.relatedWisdomIds.map((targetId) => ({
          source_type: "wisdom_entry",
          source_id: id,
          target_type: "wisdom_entry",
          target_id: targetId,
          relation_type: "related",
          created_by: user.id,
        }))
      );
    }
  }

  return NextResponse.json({ entry });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile?.role || !["super_admin", "editor_in_chief", "editor"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("wisdom_entries").delete().eq("id", id);
  if (error) {
    logger.error("Failed to delete wisdom entry", { error, entryId: id });
    return NextResponse.json({ error: "Failed to delete wisdom entry" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WisdomEntryForm } from "@/components/wisdom/wisdom-entry-form";
import { RelatedContentPanel } from "@/components/graph/related-content-panel";
import { WisdomReviewActions } from "@/components/wisdom/wisdom-review-actions";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { H1 } from "@/components/ui/typography";
import type { PlatformRole } from "@/lib/auth/roles";

export const metadata = { title: "Wisdom entry" };

const SOURCE_FIELD_KEY_MAP: Record<string, string> = {
  source_work: "sourceWork",
  tradition_note: "traditionNote",
  attributed_to: "attributedTo",
  upanishad_name: "upanishadName",
  tantra_number: "tantraNumber",
  tantra_name: "tantraName",
  tale_title: "taleTitle",
  section_name: "sectionName",
  story_title: "storyTitle",
};

function toCamelCaseFields(fields: Record<string, unknown> | null): Record<string, unknown> {
  if (!fields) return {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key === "wisdom_entry_id") continue;
    result[SOURCE_FIELD_KEY_MAP[key] ?? key] = value;
  }
  return result;
}

export default async function WisdomEntryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: entry } = await supabase
    .from("wisdom_entries")
    .select("*, wisdom_reflection_questions(question, position), wisdom_exercises(exercise, position)")
    .eq("id", id)
    .single();
  if (!entry) notFound();

  const { data: categories } = await supabase.from("wisdom_categories").select("id, name").order("name");

  const sourceTableMap: Record<string, string> = {
    gita_verse: "gita_verses",
    advaita_principle: "advaita_principles",
    subhashitam: "subhashitams",
    upanishad_verse: "upanishad_verses",
    chanakya_niti_verse: "chanakya_niti_verses",
    panchatantra_tale: "panchatantra_tales",
    hitopadesha_story: "hitopadesha_stories",
  };
  const table = sourceTableMap[entry.source_type];
  const { data: sourceFieldsRow } = table
    ? await supabase.from(table).select("*").eq("wisdom_entry_id", id).maybeSingle()
    : { data: null };

  const { data: relatedEdges } = await supabase
    .from("knowledge_graph_edges")
    .select("target_id")
    .eq("source_type", "wisdom_entry")
    .eq("source_id", id)
    .eq("target_type", "wisdom_entry");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role as PlatformRole | undefined;
  const canReview = role ? ["super_admin", "editor_in_chief", "editor"].includes(role) : false;

  const referencesList = entry.references_json as unknown as { label?: string }[] | null;

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/wisdom">Wisdom Engine</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{entry.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <H1 className="text-xl">{entry.title}</H1>

      <WisdomReviewActions
        entryId={id}
        reviewStatus={entry.review_status}
        isAuthor={entry.created_by === user.id}
        canReview={canReview}
        reviewNotes={entry.review_notes}
      />

      <WisdomEntryForm
        categories={categories ?? []}
        entryId={id}
        initial={{
          title: entry.title,
          sourceType: entry.source_type,
          sourceText: entry.source_text ?? undefined,
          iast: entry.iast ?? undefined,
          translation: entry.translation,
          context: entry.context ?? undefined,
          commentary: entry.commentary ?? undefined,
          source: referencesList?.[0]?.label,
          categoryId: entry.category_id ?? undefined,
          keywords: entry.keywords ?? [],
          techLens: entry.tech_lens ?? undefined,
          careerLens: entry.career_lens ?? undefined,
          leadershipLens: entry.leadership_lens ?? undefined,
          reflectionQuestions: (entry.wisdom_reflection_questions ?? [])
            .slice()
            .sort((a: { position: number }, b: { position: number }) => a.position - b.position)
            .map((q: { question: string }) => q.question),
          exercises: (entry.wisdom_exercises ?? [])
            .slice()
            .sort((a: { position: number }, b: { position: number }) => a.position - b.position)
            .map((e: { exercise: string }) => e.exercise),
          relatedWisdomIds: (relatedEdges ?? []).map((e) => e.target_id),
        }}
        initialSourceFields={toCamelCaseFields(sourceFieldsRow)}
      />

      <div className="max-w-3xl">
        <RelatedContentPanel entityType="wisdom_entry" entityId={id} />
      </div>
    </div>
  );
}

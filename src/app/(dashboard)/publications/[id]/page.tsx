import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { H1, Muted } from "@/components/ui/typography";
import { GeneralSettingsForm } from "@/components/publications/general-settings-form";
import { BrandingForm } from "@/components/publications/branding-form";
import { EditorialGuidelinesForm } from "@/components/publications/editorial-guidelines-form";
import { ScheduleForm } from "@/components/publications/schedule-form";
import { TemplatesPanel } from "@/components/publications/templates-panel";
import { AiPromptTemplatesPanel } from "@/components/publications/ai-prompt-templates-panel";

export const metadata = { title: "Publication settings" };

export default async function PublicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: publication } = await supabase.from("publications").select("*").eq("id", id).single();
  if (!publication) notFound();

  const { data: templateRows } = await supabase
    .from("publication_templates")
    .select("channel, config")
    .eq("publication_id", id);

  const { data: aiTemplates } = await supabase
    .from("prompt_templates")
    .select("id, block_type, name, template_text, variables, is_active")
    .eq("publication_id", id)
    .order("block_type");

  const templateConfigs = {
    email: templateRows?.find((t) => t.channel === "email")?.config ?? {},
    pdf: templateRows?.find((t) => t.channel === "pdf")?.config ?? {},
    web: templateRows?.find((t) => t.channel === "web")?.config ?? {},
  };

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/publications">Publications</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{publication.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-3">
        <H1 className="text-xl">{publication.name}</H1>
        <Badge variant={publication.status === "active" ? "success" : "neutral"}>{publication.status}</Badge>
      </div>
      <Muted>/{publication.slug}</Muted>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="guidelines">Editorial Guidelines</TabsTrigger>
          <TabsTrigger value="schedule">Publishing Schedule</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="ai-prompts">AI Prompt Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralSettingsForm
            publicationId={id}
            initial={{ name: publication.name, description: publication.description, cadence: publication.cadence }}
          />
        </TabsContent>

        <TabsContent value="branding">
          <BrandingForm
            publicationId={id}
            publicationName={publication.name}
            initialLogoUrl={publication.logo_url}
            initialBranding={publication.branding ?? {}}
          />
        </TabsContent>

        <TabsContent value="guidelines">
          <EditorialGuidelinesForm publicationId={id} initial={publication.editorial_guidelines} />
        </TabsContent>

        <TabsContent value="schedule">
          <ScheduleForm publicationId={id} initial={publication.publishing_schedule ?? {}} />
        </TabsContent>

        <TabsContent value="templates">
          <TemplatesPanel publicationId={id} initialConfigs={templateConfigs} />
        </TabsContent>

        <TabsContent value="ai-prompts">
          <AiPromptTemplatesPanel publicationId={id} initialTemplates={aiTemplates ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

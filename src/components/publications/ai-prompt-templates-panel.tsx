"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { createAiPromptTemplateSchema, type CreateAiPromptTemplateInput } from "@/lib/validation/publications";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Muted } from "@/components/ui/typography";

interface AiPromptTemplate {
  id: string;
  block_type: string;
  name: string;
  template_text: string;
  variables: string[];
  is_active: boolean;
}

function CreateTemplateDialog({ publicationId, onCreated }: { publicationId: string; onCreated: (t: AiPromptTemplate) => void }) {
  const [open, setOpen] = React.useState(false);
  const form = useForm<CreateAiPromptTemplateInput>({
    resolver: zodResolver(createAiPromptTemplateSchema),
    defaultValues: { blockType: "hero_story", name: "", templateText: "", variables: [] },
  });

  async function onSubmit(values: CreateAiPromptTemplateInput) {
    try {
      const res = await fetch(`/api/publications/${publicationId}/ai-prompt-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create template");

      onCreated(body.template);
      toast.success("AI prompt template created");
      form.reset();
      setOpen(false);
    } catch (error) {
      logger.error("AI prompt template creation failed in UI", { error, publicationId });
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> New template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New AI prompt template</DialogTitle>
          <DialogDescription>
            Overrides the platform default for this block type, for this publication only.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
            <FormField
              control={form.control}
              name="blockType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Block type</FormLabel>
                  <FormControl>
                    <Input placeholder="hero_story" {...field} />
                  </FormControl>
                  <FormDescription>Matches a block_type from the Issue Builder (e.g. hero_story, signal_card).</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Hero story — analytical tone" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="templateText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prompt text</FormLabel>
                  <FormControl>
                    <Textarea rows={6} placeholder="Write a hero story about {{topic}}…" className="font-mono text-xs" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function AiPromptTemplatesPanel({ publicationId, initialTemplates }: { publicationId: string; initialTemplates: AiPromptTemplate[] }) {
  const router = useRouter();
  const [templates, setTemplates] = React.useState(initialTemplates);

  async function handleToggleActive(template: AiPromptTemplate) {
    const nextActive = !template.is_active;
    setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, is_active: nextActive } : t)));

    try {
      const res = await fetch(`/api/publications/${publicationId}/ai-prompt-templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to update template");
      router.refresh();
    } catch (error) {
      logger.error("Toggle AI prompt template active failed in UI", { error, publicationId, templateId: template.id });
      toast.error(error instanceof Error ? error.message : "Something went wrong");
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, is_active: template.is_active } : t)));
    }
  }

  async function handleDelete(templateId: string) {
    const previous = templates;
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));

    try {
      const res = await fetch(`/api/publications/${publicationId}/ai-prompt-templates/${templateId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to delete template");
      }
      toast.success("Template deleted");
    } catch (error) {
      logger.error("AI prompt template deletion failed in UI", { error, publicationId, templateId });
      toast.error(error instanceof Error ? error.message : "Something went wrong");
      setTemplates(previous);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Muted>
          Publication-specific overrides only. Platform-wide defaults (managed by Super Admin) apply automatically
          wherever no override exists here.
        </Muted>
        <CreateTemplateDialog publicationId={publicationId} onCreated={(t) => setTemplates((prev) => [...prev, t])} />
      </div>

      {templates.length === 0 ? (
        <Muted>No publication-specific AI prompt templates yet — platform defaults are in effect.</Muted>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-sm">{t.name}</CardTitle>
                  <Badge variant="neutral" className="mt-1">
                    {t.block_type}
                  </Badge>
                </div>
                <Switch checked={t.is_active} onCheckedChange={() => handleToggleActive(t)} aria-label={`Active: ${t.name}`} />
              </CardHeader>
              <CardContent>
                <p className="line-clamp-3 font-mono text-xs text-muted-foreground">{t.template_text}</p>
              </CardContent>
              <CardFooter>
                <Button variant="ghost" size="sm" className="text-danger-700" onClick={() => handleDelete(t.id)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

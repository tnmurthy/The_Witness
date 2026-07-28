"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import {
  createWisdomEntrySchema,
  WISDOM_SOURCE_LABELS,
  type CreateWisdomEntryInput,
  type WisdomSourceType,
} from "@/lib/validation/wisdom";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";

interface CategoryOption {
  id: string;
  name: string;
}

interface StringListFieldProps {
  label: string;
  helpText?: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

function StringListField({ label, helpText, values, onChange, placeholder }: StringListFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
      {values.map((v, i) => (
        <div key={i} className="flex gap-2">
          <Input placeholder={placeholder} value={v} onChange={(e) => onChange(values.map((x, idx) => (idx === i ? e.target.value : x)))} />
          <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => onChange(values.filter((_, idx) => idx !== i))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...values, ""])}>
        <Plus className="h-3.5 w-3.5" /> Add
      </Button>
    </div>
  );
}

function SourceSpecificFields({
  sourceType,
  fields,
  onChange,
}: {
  sourceType: WisdomSourceType;
  fields: Record<string, unknown>;
  onChange: (fields: Record<string, unknown>) => void;
}) {
  const set = (patch: Record<string, unknown>) => onChange({ ...fields, ...patch });

  switch (sourceType) {
    case "gita_verse":
    case "chanakya_niti_verse":
      return (
        <div className="flex gap-3">
          <div className="space-y-1.5">
            <Label>Chapter</Label>
            <Input type="number" value={(fields.chapter as number) ?? ""} onChange={(e) => set({ chapter: Number(e.target.value) })} className="w-28" />
          </div>
          <div className="space-y-1.5">
            <Label>Verse</Label>
            <Input type="number" value={(fields.verse as number) ?? ""} onChange={(e) => set({ verse: Number(e.target.value) })} className="w-28" />
          </div>
        </div>
      );
    case "advaita_principle":
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Source work</Label>
            <Input placeholder="Vivekachudamani" value={(fields.sourceWork as string) ?? ""} onChange={(e) => set({ sourceWork: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Tradition note</Label>
            <Textarea rows={2} value={(fields.traditionNote as string) ?? ""} onChange={(e) => set({ traditionNote: e.target.value })} />
          </div>
        </div>
      );
    case "subhashitam":
      return (
        <div className="flex gap-3">
          <div className="space-y-1.5">
            <Label>Meter</Label>
            <Input placeholder="Anushtubh" value={(fields.meter as string) ?? ""} onChange={(e) => set({ meter: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Attributed to</Label>
            <Input value={(fields.attributedTo as string) ?? ""} onChange={(e) => set({ attributedTo: e.target.value })} />
          </div>
        </div>
      );
    case "upanishad_verse":
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Upaniṣad name</Label>
            <Input placeholder="Chandogya Upanishad" value={(fields.upanishadName as string) ?? ""} onChange={(e) => set({ upanishadName: e.target.value })} />
          </div>
          <div className="flex gap-3">
            <div className="space-y-1.5">
              <Label>Chapter (optional)</Label>
              <Input type="number" value={(fields.chapter as number) ?? ""} onChange={(e) => set({ chapter: Number(e.target.value) })} className="w-28" />
            </div>
            <div className="space-y-1.5">
              <Label>Verse (optional)</Label>
              <Input type="number" value={(fields.verse as number) ?? ""} onChange={(e) => set({ verse: Number(e.target.value) })} className="w-28" />
            </div>
          </div>
        </div>
      );
    case "panchatantra_tale":
      return (
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="space-y-1.5">
              <Label>Tantra number (1-5)</Label>
              <Input type="number" min={1} max={5} value={(fields.tantraNumber as number) ?? ""} onChange={(e) => set({ tantraNumber: Number(e.target.value) })} className="w-28" />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label>Tantra name</Label>
              <Input placeholder="Mitrabheda" value={(fields.tantraName as string) ?? ""} onChange={(e) => set({ tantraName: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tale title</Label>
            <Input value={(fields.taleTitle as string) ?? ""} onChange={(e) => set({ taleTitle: e.target.value })} />
          </div>
        </div>
      );
    case "hitopadesha_story":
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Section</Label>
            <Select value={(fields.sectionName as string) ?? ""} onValueChange={(v) => set({ sectionName: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select a section" />
              </SelectTrigger>
              <SelectContent>
                {["Mitralabha", "Suhridbheda", "Vigraha", "Sandhi"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Story title</Label>
            <Input value={(fields.storyTitle as string) ?? ""} onChange={(e) => set({ storyTitle: e.target.value })} />
          </div>
        </div>
      );
    case "other":
      return <p className="text-sm text-muted-foreground">No source-specific fields for &quot;Other.&quot;</p>;
  }
}

interface WisdomEntryFormProps {
  categories: CategoryOption[];
  entryId?: string;
  initial?: Partial<CreateWisdomEntryInput>;
  initialSourceFields?: Record<string, unknown>;
}

export function WisdomEntryForm({ categories, entryId, initial, initialSourceFields }: WisdomEntryFormProps) {
  const router = useRouter();
  const isEditing = !!entryId;

  const form = useForm<CreateWisdomEntryInput>({
    resolver: zodResolver(createWisdomEntrySchema),
    defaultValues: {
      title: initial?.title ?? "",
      sourceType: initial?.sourceType ?? "gita_verse",
      sourceText: initial?.sourceText ?? "",
      iast: initial?.iast ?? "",
      translation: initial?.translation ?? "",
      context: initial?.context ?? "",
      commentary: initial?.commentary ?? "",
      source: initial?.source ?? "",
      categoryId: initial?.categoryId,
      keywords: initial?.keywords ?? [],
      techLens: initial?.techLens ?? "",
      careerLens: initial?.careerLens ?? "",
      leadershipLens: initial?.leadershipLens ?? "",
      reflectionQuestions: initial?.reflectionQuestions ?? [],
      exercises: initial?.exercises ?? [],
      relatedWisdomIds: initial?.relatedWisdomIds ?? [],
      sourceFields: initialSourceFields ?? {},
    },
  });

  const sourceType = form.watch("sourceType");
  const sourceFields = form.watch("sourceFields") ?? {};
  const keywords = form.watch("keywords");
  const reflectionQuestions = form.watch("reflectionQuestions");
  const exercises = form.watch("exercises");

  async function onSubmit(values: CreateWisdomEntryInput) {
    try {
      const res = await fetch(isEditing ? `/api/wisdom-entries/${entryId}` : "/api/wisdom-entries", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save wisdom entry");

      toast.success(isEditing ? "Saved" : "Wisdom entry created");
      router.push(isEditing ? `/wisdom/${entryId}` : `/wisdom/${body.entry.id}`);
      router.refresh();
    } catch (error) {
      logger.error("Wisdom entry save failed in UI", { error, entryId });
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="max-w-3xl space-y-6">
        <Tabs defaultValue="content">
          <TabsList>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="source">Source</TabsTrigger>
            <TabsTrigger value="lenses">Lenses</TabsTrigger>
            <TabsTrigger value="reflection">Reflection &amp; Exercise</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="On detachment from outcomes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sourceText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sanskrit</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Original-language text" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="iast"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transliteration (IAST)</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="translation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Translation <span className="text-gold-700">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="commentary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Commentary</FormLabel>
                  <FormControl>
                    <Textarea rows={5} placeholder="Editorial interpretation and context" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <StringListField label="Keywords" values={keywords} onChange={(v) => form.setValue("keywords", v)} placeholder="decision-making" />
          </TabsContent>

          <TabsContent value="source" className="space-y-4">
            <FormField
              control={form.control}
              name="sourceType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(WISDOM_SOURCE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="rounded-md border border-neutral-200 p-4">
              <SourceSpecificFields sourceType={sourceType} fields={sourceFields} onChange={(f) => form.setValue("sourceFields", f)} />
            </div>
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display source label</FormLabel>
                  <FormControl>
                    <Input placeholder="Bhagavad Gītā 2.47" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormDescription>Shown to readers — e.g. on the Today&apos;s Wisdom block.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="context"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Context</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>

          <TabsContent value="lenses" className="space-y-4">
            <FormField
              control={form.control}
              name="techLens"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Technology lens</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="How does this apply to a technology decision?" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="careerLens"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Career lens</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="leadershipLens"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Leadership lens</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>

          <TabsContent value="reflection" className="space-y-4">
            <StringListField
              label="Reflection questions"
              helpText="Shown as prompts for the reader to sit with."
              values={reflectionQuestions}
              onChange={(v) => form.setValue("reflectionQuestions", v)}
              placeholder="Where in your work are you attached to a specific outcome?"
            />
            <StringListField
              label="Practical exercises"
              helpText="Concrete actions a reader can try."
              values={exercises}
              onChange={(v) => form.setValue("exercises", v)}
              placeholder="Before your next 1:1, write down the outcome you're attached to — then set it aside."
            />
          </TabsContent>
        </Tabs>

        <Button type="submit" variant="signal" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : isEditing ? "Save changes" : "Create entry"}
        </Button>
      </form>
    </Form>
  );
}

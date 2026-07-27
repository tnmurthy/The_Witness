"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { updateEditorialGuidelinesSchema, type UpdateEditorialGuidelinesInput } from "@/lib/validation/publications";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";

export function EditorialGuidelinesForm({ publicationId, initial }: { publicationId: string; initial: string | null }) {
  const router = useRouter();
  const form = useForm<UpdateEditorialGuidelinesInput>({
    resolver: zodResolver(updateEditorialGuidelinesSchema),
    defaultValues: { editorialGuidelines: initial ?? "" },
  });

  async function onSubmit(values: UpdateEditorialGuidelinesInput) {
    try {
      const res = await fetch(`/api/publications/${publicationId}/editorial-guidelines`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save");

      toast.success("Editorial guidelines saved");
      router.refresh();
    } catch (error) {
      logger.error("Editorial guidelines update failed in UI", { error, publicationId });
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="max-w-2xl space-y-5">
        <FormField
          control={form.control}
          name="editorialGuidelines"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Editorial guidelines</FormLabel>
              <FormControl>
                <Textarea rows={16} placeholder="Tone, sourcing standards, style conventions…" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormDescription>
                Shown to contributors in the Issue Builder and referenced by the AI Workspace when drafting content
                for this publication (Milestone 5).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : "Save guidelines"}
        </Button>
      </form>
    </Form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import {
  updatePublicationGeneralSchema,
  type UpdatePublicationGeneralInput,
} from "@/lib/validation/publications";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";

interface GeneralSettingsFormProps {
  publicationId: string;
  initial: { name: string; description: string | null; cadence: string | null };
}

export function GeneralSettingsForm({ publicationId, initial }: GeneralSettingsFormProps) {
  const router = useRouter();
  const form = useForm<UpdatePublicationGeneralInput>({
    resolver: zodResolver(updatePublicationGeneralSchema),
    defaultValues: {
      name: initial.name,
      description: initial.description ?? "",
      cadence: initial.cadence ?? "",
    },
  });

  async function onSubmit(values: UpdatePublicationGeneralInput) {
    try {
      const res = await fetch(`/api/publications/${publicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save");

      toast.success("Saved");
      router.refresh();
    } catch (error) {
      logger.error("General settings update failed in UI", { error, publicationId });
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="max-w-lg space-y-5">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="cadence"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cadence label</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Form>
  );
}

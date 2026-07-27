"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { createPublicationSchema, type CreatePublicationInput } from "@/lib/validation/publications";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function CreatePublicationForm() {
  const router = useRouter();
  const [slugEdited, setSlugEdited] = React.useState(false);

  const form = useForm<CreatePublicationInput>({
    resolver: zodResolver(createPublicationSchema),
    defaultValues: { name: "", slug: "", description: "", cadence: "" },
  });

  const nameValue = form.watch("name");
  React.useEffect(() => {
    if (!slugEdited) form.setValue("slug", slugify(nameValue || ""));
  }, [nameValue, slugEdited, form]);

  async function onSubmit(values: CreatePublicationInput) {
    try {
      const res = await fetch("/api/publications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json();

      if (!res.ok) throw new Error(body.error ?? "Failed to create publication");

      toast.success("Publication created");
      router.push(`/publications/${body.publication.id}`);
      router.refresh();
    } catch (error) {
      logger.error("Publication creation failed in UI", { error });
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
                <Input placeholder="The Witness" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  onChange={(e) => {
                    setSlugEdited(true);
                    field.onChange(e);
                  }}
                />
              </FormControl>
              <FormDescription>Used in URLs — lowercase letters, numbers, and hyphens only.</FormDescription>
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
                <Textarea placeholder="48-hour technology intelligence." {...field} />
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
                <Input placeholder="48h, weekly, monthly…" {...field} />
              </FormControl>
              <FormDescription>
                Human-readable label shown to readers. The structured publishing schedule (days, time, timezone) is
                set after creation, from the publication&apos;s Schedule tab.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Creating…" : "Create publication"}
        </Button>
      </form>
    </Form>
  );
}

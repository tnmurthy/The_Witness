"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { createIssueSchema, type CreateIssueInput } from "@/lib/validation/issue-builder";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

interface PublicationOption {
  id: string;
  name: string;
}

export function CreateIssueForm({ publications }: { publications: PublicationOption[] }) {
  const router = useRouter();
  const form = useForm<CreateIssueInput>({
    resolver: zodResolver(createIssueSchema),
    defaultValues: { publicationId: publications[0]?.id ?? "", title: "" },
  });

  async function onSubmit(values: CreateIssueInput) {
    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create issue");

      router.push(`/issues/${body.issue.id}`);
    } catch (error) {
      logger.error("Issue creation failed in UI", { error });
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    }
  }

  if (publications.length === 0) {
    return <p className="text-sm text-muted-foreground">You need to be a member of a publication before creating an issue.</p>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="max-w-lg space-y-5">
        <FormField
          control={form.control}
          name="publicationId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Publication</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {publications.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
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
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="The RAG reckoning" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Creating…" : "Create issue"}
        </Button>
      </form>
    </Form>
  );
}

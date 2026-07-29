"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { createPersonSchema, type CreatePersonInput } from "@/lib/validation/graph";
import { useCreatePerson } from "@/lib/graph/people-hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";

export function CreatePersonForm() {
  const router = useRouter();
  const createPerson = useCreatePerson();

  const form = useForm<CreatePersonInput>({
    resolver: zodResolver(createPersonSchema),
    defaultValues: { fullName: "", bio: "", avatarUrl: "", externalLinks: {} },
  });

  async function onSubmit(values: CreatePersonInput) {
    try {
      const { person } = await createPerson.mutateAsync(values);
      toast.success("Person added");
      router.push(`/people/${person.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="max-w-lg space-y-5">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input placeholder="Ada Lovelace" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Textarea rows={4} {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="avatarUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Avatar URL</FormLabel>
              <FormControl>
                <Input placeholder="https://…" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormDescription>Optional — falls back to initials if left blank.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={createPerson.isPending}>
          {createPerson.isPending ? "Adding…" : "Add person"}
        </Button>
      </form>
    </Form>
  );
}

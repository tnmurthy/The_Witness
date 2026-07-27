"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { updateBrandingSchema, type UpdateBrandingInput } from "@/lib/validation/publications";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface BrandingFormProps {
  publicationId: string;
  publicationName: string;
  initialLogoUrl: string | null;
  initialBranding: { primaryColor?: string; accentColor?: string; fontVoice?: string };
}

export function BrandingForm({ publicationId, publicationName, initialLogoUrl, initialBranding }: BrandingFormProps) {
  const router = useRouter();
  const [logoUrl, setLogoUrl] = React.useState(initialLogoUrl);
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<UpdateBrandingInput>({
    resolver: zodResolver(updateBrandingSchema),
    defaultValues: {
      primaryColor: initialBranding.primaryColor ?? "#2E3A59",
      accentColor: initialBranding.accentColor ?? "#8A6600",
      fontVoice: initialBranding.fontVoice ?? "",
    },
  });

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/publications/${publicationId}/logo`, { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to upload logo");

      setLogoUrl(body.publication.logo_url);
      toast.success("Logo updated");
      router.refresh();
    } catch (error) {
      logger.error("Logo upload failed in UI", { error, publicationId });
      toast.error(error instanceof Error ? error.message : "Failed to upload logo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function onSubmit(values: UpdateBrandingInput) {
    try {
      const res = await fetch(`/api/publications/${publicationId}/branding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save");

      toast.success("Branding saved");
      router.refresh();
    } catch (error) {
      logger.error("Branding update failed in UI", { error, publicationId });
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    }
  }

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Logo</p>
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 rounded-md border border-neutral-200">
            <AvatarImage src={logoUrl ?? undefined} alt="" />
            <AvatarFallback className="rounded-md text-lg">{publicationName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={handleLogoChange}
              className="hidden"
              id="logo-upload"
            />
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              {uploading ? "Uploading…" : "Upload logo"}
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">PNG, JPEG, SVG, or WebP. Max 2MB.</p>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
          <FormField
            control={form.control}
            name="primaryColor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Primary color</FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Input type="color" className="h-10 w-16 p-1" {...field} value={field.value ?? "#2E3A59"} />
                  </FormControl>
                  <Input value={field.value ?? ""} onChange={field.onChange} className="w-32 font-mono" />
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="accentColor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Accent color</FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Input type="color" className="h-10 w-16 p-1" {...field} value={field.value ?? "#8A6600"} />
                  </FormControl>
                  <Input value={field.value ?? ""} onChange={field.onChange} className="w-32 font-mono" />
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="fontVoice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Editorial font</FormLabel>
                <FormControl>
                  <Input placeholder="Source Serif 4" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormDescription>Used for this publication&apos;s headlines and hero stories.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving…" : "Save branding"}
          </Button>
        </form>
      </Form>
    </div>
  );
}

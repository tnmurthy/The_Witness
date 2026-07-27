"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const magicLinkSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
});

type MagicLinkValues = z.infer<typeof magicLinkSchema>;

export function MagicLinkForm() {
  const supabase = createClient();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MagicLinkValues>({ resolver: zodResolver(magicLinkSchema) });

  async function onSubmit(values: MagicLinkValues) {
    setIsSubmitting(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: values.email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        // Never silently create an account via magic link — only an
        // existing user (one who came through sign-up and confirmed their
        // email) can use this path. shouldCreateUser: false makes that
        // Supabase's behavior, not just a documented intention.
        shouldCreateUser: false,
      },
    });
    setIsSubmitting(false);

    if (error) {
      logger.warn("Magic link request failed", { message: error.message });
      toast.error("Couldn't send magic link", { description: error.message });
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <p className="rounded-md bg-success-100 p-4 text-sm text-success-700">
        Check your email for a sign-in link.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="magic-email">Email</Label>
        <Input
          id="magic-email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {errors.email && <p className="text-xs text-danger-700">{errors.email.message}</p>}
      </div>
      <Button type="submit" variant="secondary" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}

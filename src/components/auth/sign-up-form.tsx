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

const signUpSchema = z.object({
  fullName: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignUpValues = z.infer<typeof signUpSchema>;

export function SignUpForm() {
  const supabase = createClient();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpValues>({ resolver: zodResolver(signUpSchema) });

  async function onSubmit(values: SignUpValues) {
    setIsSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { data: { full_name: values.fullName } },
    });
    setIsSubmitting(false);

    if (error) {
      logger.warn("Sign up failed", { message: error.message });
      toast.error("Couldn't create your account", { description: error.message });
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <p className="rounded-md bg-success-100 p-4 text-sm text-success-700">
        Check your email to confirm your account before signing in.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="fullName">
          Full name <span className="text-gold-700">*</span>
        </Label>
        <Input id="fullName" autoComplete="name" aria-invalid={!!errors.fullName} {...register("fullName")} />
        {errors.fullName && <p className="text-xs text-danger-700">{errors.fullName.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">
          Email <span className="text-gold-700">*</span>
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {errors.email && <p className="text-xs text-danger-700">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">
          Password <span className="text-gold-700">*</span>
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          aria-describedby="password-help"
          {...register("password")}
        />
        <p id="password-help" className="text-xs text-muted-foreground">
          At least 8 characters.
        </p>
        {errors.password && <p className="text-xs text-danger-700">{errors.password.message}</p>}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}

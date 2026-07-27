"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { updateProfileSchema, type UpdateProfileInput } from "@/lib/validation/profile";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm({ userId, initialFullName }: { userId: string; initialFullName: string }) {
  const router = useRouter();
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { fullName: initialFullName },
  });

  async function onSubmit(values: UpdateProfileInput) {
    // profiles_update_self (Migration 002/013) allows a user to update
    // their own display fields directly — no API route needed for this
    // one, unlike role changes which must go through the service role.
    const { error } = await supabase.from("profiles").update({ full_name: values.fullName }).eq("id", userId);

    if (error) {
      logger.error("Profile update failed", { error, userId });
      toast.error("Couldn't update your profile");
      return;
    }

    toast.success("Profile updated");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-sm space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" aria-invalid={!!errors.fullName} {...register("fullName")} />
        {errors.fullName && <p className="text-xs text-danger-700">{errors.fullName.message}</p>}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

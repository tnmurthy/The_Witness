"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { inviteMemberSchema, type InviteMemberInput } from "@/lib/validation/organizations";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InviteMemberForm({ organizationId }: { organizationId: string }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { role: "member" },
  });

  async function onSubmit(values: InviteMemberInput) {
    try {
      const res = await fetch(`/api/organizations/${organizationId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json();

      if (!res.ok) throw new Error(body.error ?? "Failed to send invitation");

      toast.success(`Invitation created for ${values.email}`, {
        description: "Email delivery isn't wired up yet (Milestone 10) — share the invite manually for now.",
      });
      reset();
    } catch (error) {
      logger.error("Invite failed in UI", { error, organizationId });
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="invite-email">Email</Label>
        <Input
          id="invite-email"
          type="email"
          className="w-64"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {errors.email && <p className="text-xs text-danger-700">{errors.email.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="invite-role">Role</Label>
        <select
          id="invite-role"
          className="h-10 rounded-sm border border-neutral-300 bg-card px-3 text-sm focus-visible:border-gold-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-100"
          {...register("role")}
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : "Invite"}
      </Button>
    </form>
  );
}

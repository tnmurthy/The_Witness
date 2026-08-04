import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { canManageOrganization } from "@/lib/auth/permissions";
import { inviteMemberSchema } from "@/lib/validation/organizations";
import { logger } from "@/lib/logger";
import { isEmailConfigured, getResendClient } from "@/lib/email/resend-client";
import type { OrganizationRole } from "@/lib/auth/roles";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Creates an `invitations` row (supabase/migrations/002_identity_and_
 * access.sql). This deliberately does NOT send an email — outbound
 * transactional email is Milestone 10 (Publishing Pipeline) scope, per
 * the Implementation Plan. The invitation exists and is queryable/
 * shareable (its token) as soon as this returns; wiring an email service
 * provider to actually deliver it is a follow-up, not a gap introduced
 * silently — see docs/AUTHENTICATION.md.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id: organizationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .single();

  if (!canManageOrganization(membership?.role as OrganizationRole | undefined)) {
    return NextResponse.json({ error: "Only an organization admin can invite members" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = inviteMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  const { data: invitation, error } = await supabase
    .from("invitations")
    .insert({
      email: parsed.data.email,
      organization_id: organizationId,
      role: parsed.data.role,
      token,
      invited_by: user.id,
      expires_at: expiresAt,
    })
    .select("id, email, role, expires_at")
    .single();

  if (error) {
    logger.error("Failed to create invitation", { error, organizationId });
    return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 });
  }

  // Send invitation email if Resend is configured
  if (isEmailConfigured()) {
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      const acceptUrl = `${siteUrl}/invitations/accept?token=${token}`;
      const resend = getResendClient();
      const from = `The Witness <${process.env.EMAIL_FROM ?? "noreply@updates.thewitness.app"}>`;

      await resend.emails.send({
        from,
        to: parsed.data.email,
        subject: "You've been invited to join The Witness",
        html: `
          <p>You've been invited to join a publication on <strong>The Witness</strong> as a <strong>${parsed.data.role.replace(/_/g, " ")}</strong>.</p>
          <p><a href="${acceptUrl}" style="display:inline-block;padding:12px 24px;background:#1e3a5f;color:#fff;text-decoration:none;border-radius:6px;">Accept invitation</a></p>
          <p style="color:#6b7280;font-size:13px;">This invitation expires in 7 days. If you didn't expect this, you can safely ignore it.</p>
        `,
        text: `You've been invited to join a publication on The Witness as a ${parsed.data.role.replace(/_/g, " ")}.\n\nAccept here: ${acceptUrl}\n\nThis invitation expires in 7 days.`,
      });

      logger.info("Invitation email sent", { email: parsed.data.email, role: parsed.data.role });
    } catch (emailErr) {
      // Email failure should not fail the invitation creation — log and continue
      logger.error("Failed to send invitation email", {
        error: emailErr instanceof Error ? emailErr.message : String(emailErr),
        email: parsed.data.email,
      });
    }
  } else {
    logger.warn("Invitation created without email — RESEND_API_KEY not configured", {
      email: parsed.data.email,
      token: token.slice(0, 8) + "...",
    });
  }

  return NextResponse.json({ invitation }, { status: 201 });
}

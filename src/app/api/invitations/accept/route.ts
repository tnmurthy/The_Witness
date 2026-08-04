/**
 * POST /api/invitations/accept
 *
 * Accepts a pending invitation token and adds the authenticated user
 * as a member of the target publication or organisation.
 *
 * Security controls (Security Lead finding):
 *   - Token must exist, be 'pending', and not be expired (expires_at check)
 *   - Caller must be authenticated
 *   - Email on the invitation must match the caller's email
 *   - Token is single-use: marked 'accepted' immediately
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { z } from "zod";

const schema = z.object({ token: z.string().min(1) });

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Token is required" }, { status: 422 });
  }

  const admin = createAdminClient();

  // Fetch the invitation — must be pending and not expired
  const { data: invitation } = await admin
    .from("invitations")
    .select("id, email, publication_id, organization_id, role, status, expires_at")
    .eq("token", parsed.data.token)
    .single();

  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found or already used" }, { status: 404 });
  }

  if (invitation.status !== "pending") {
    return NextResponse.json({ error: "This invitation has already been used" }, { status: 409 });
  }

  // ── Security: expiry check (Security Lead finding) ────────────────────────
  if (new Date(invitation.expires_at) < new Date()) {
    await admin.from("invitations").update({ status: "expired" }).eq("id", invitation.id);
    return NextResponse.json(
      { error: "This invitation has expired. Ask the sender to create a new one." },
      { status: 410 }
    );
  }

  // ── Security: email match ─────────────────────────────────────────────────
  // Note: email is on auth.users not profiles — use admin to fetch
  const { data: authUser } = await admin.auth.admin.getUserById(user.id);
  if (authUser.user?.email !== invitation.email) {
    logger.warn("Invitation email mismatch", {
      invitationEmail: invitation.email,
      userId: user.id,
    });
    return NextResponse.json(
      { error: "This invitation was sent to a different email address" },
      { status: 403 }
    );
  }

  // ── Accept: mark used + add membership ────────────────────────────────────
  await admin.from("invitations").update({ status: "accepted" }).eq("id", invitation.id);

  if (invitation.publication_id) {
    await admin.from("publication_members").upsert(
      {
        publication_id: invitation.publication_id,
        user_id: user.id,
        role: invitation.role as "editor_in_chief" | "editor" | "writer" | "researcher",
      },
      { onConflict: "publication_id,user_id" }
    );
  } else if (invitation.organization_id) {
    await admin.from("organization_members").upsert(
      {
        organization_id: invitation.organization_id,
        user_id: user.id,
        role: invitation.role as "admin" | "member" | undefined,
      },
      { onConflict: "organization_id,user_id" }
    );
  }

  logger.info("Invitation accepted", {
    invitationId: invitation.id,
    userId: user.id,
    role: invitation.role,
    publicationId: invitation.publication_id,
  });

  return NextResponse.json({
    accepted: true,
    role: invitation.role,
    publicationId: invitation.publication_id,
    organizationId: invitation.organization_id,
  });
}

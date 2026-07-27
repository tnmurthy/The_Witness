import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createOrganizationSchema } from "@/lib/validation/organizations";
import { logger } from "@/lib/logger";

/**
 * GET  /api/organizations   — organizations the current user belongs to
 * POST /api/organizations   — create an organization; creator becomes its admin
 *
 * Row Level Security (organizations_select_member,
 * organizations_insert_authenticated, organization_members_manage —
 * supabase/migrations/002_identity_and_access.sql) is what actually
 * restricts these queries; the checks in this route are for early,
 * friendly validation and correct HTTP status codes, not the security
 * boundary itself.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, type, created_at, organization_members(role)")
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Failed to list organizations", { error, userId: user.id });
    return NextResponse.json({ error: "Failed to load organizations" }, { status: 500 });
  }

  return NextResponse.json({ organizations: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createOrganizationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .insert({ name: parsed.data.name, type: parsed.data.type, created_by: user.id })
    .select("id, name, type")
    .single();

  if (orgError || !organization) {
    logger.error("Failed to create organization", { error: orgError, userId: user.id });
    return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
  }

  // The creator is made an admin member in a second statement rather than
  // a database trigger — deliberate, so the audit log (Migration 013)
  // records an explicit "organization_member_added" event with the real
  // actor, the same as any other membership grant.
  const { error: memberError } = await supabase
    .from("organization_members")
    .insert({ organization_id: organization.id, user_id: user.id, role: "admin" });

  if (memberError) {
    logger.error("Failed to add creator as organization admin", { error: memberError, organizationId: organization.id });
    return NextResponse.json({ error: "Organization created but membership setup failed" }, { status: 500 });
  }

  return NextResponse.json({ organization }, { status: 201 });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: organization, error } = await supabase
    .from("organizations")
    .select("id, name, type, created_at")
    .eq("id", id)
    .single();

  if (error || !organization) {
    // RLS (organizations_select_member) returns zero rows rather than an
    // error for an organization the caller isn't a member of, which
    // .single() then surfaces as this same not-found error — a caller
    // outside the organization gets a 404, not a 403, so membership
    // itself isn't leaked.
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const { data: members, error: membersError } = await supabase
    .from("organization_members")
    .select("user_id, role, created_at, profiles(full_name)")
    .eq("organization_id", id);

  if (membersError) {
    logger.error("Failed to load organization members", { error: membersError, organizationId: id });
    return NextResponse.json({ error: "Failed to load members" }, { status: 500 });
  }

  return NextResponse.json({ organization, members });
}

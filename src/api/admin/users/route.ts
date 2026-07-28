import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canManageUsers } from "@/lib/auth/permissions";
import { logger } from "@/lib/logger";
import type { PlatformRole } from "@/lib/auth/roles";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const callerRole = callerProfile?.role as PlatformRole | undefined;

  if (!callerRole || !canManageUsers(callerRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Failed to list users", { error, actorId: user.id });
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }

  return NextResponse.json({ users: data });
}

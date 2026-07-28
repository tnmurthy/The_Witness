import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { wisdomCategorySchema } from "@/lib/validation/wisdom";
import { logger } from "@/lib/logger";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase.from("wisdom_categories").select("id, name, slug, description").order("name");

  if (error) {
    logger.error("Failed to list wisdom categories", { error });
    return NextResponse.json({ error: "Failed to load categories" }, { status: 500 });
  }

  return NextResponse.json({ categories: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile?.role || !["super_admin", "editor_in_chief", "editor"].includes(profile.role)) {
    return NextResponse.json({ error: "Only an editor can create categories" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = wisdomCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  const { data: category, error } = await supabase.from("wisdom_categories").insert(parsed.data).select("id, name, slug").single();

  if (error || !category) {
    const status = error?.code === "23505" ? 409 : 500;
    logger.error("Failed to create wisdom category", { error });
    return NextResponse.json({ error: error?.code === "23505" ? "That slug is already in use" : "Failed to create category" }, { status });
  }

  return NextResponse.json({ category }, { status: 201 });
}

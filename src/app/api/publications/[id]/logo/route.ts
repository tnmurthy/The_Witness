import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canEditPublication } from "@/lib/auth/publication-permissions";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024; // 2MB — matches the publication-logos bucket's file_size_limit (Migration 014)

/**
 * Uploads to the publication-logos Storage bucket under the
 * "<publication_id>/<filename>" path convention the bucket's RLS policy
 * expects (Migration 014, publication_logos_manage_editor). The bucket
 * itself enforces the same size/type limits Postgres-side; this route
 * checks them first purely for a fast, friendly error instead of waiting
 * on a Storage API round trip to reject an oversized file.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await canEditPublication(supabase, id, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 422 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Logo must be PNG, JPEG, SVG, or WebP" }, { status: 422 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Logo must be under 2MB" }, { status: 422 });
  }

  const extension = file.name.split(".").pop() ?? "png";
  const path = `${id}/logo-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from("publication-logos").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    logger.error("Logo upload failed", { error: uploadError, publicationId: id });
    return NextResponse.json({ error: "Failed to upload logo" }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("publication-logos").getPublicUrl(path);

  const { data: publication, error: updateError } = await supabase
    .from("publications")
    .update({ logo_url: publicUrl })
    .eq("id", id)
    .select("id, logo_url")
    .single();

  if (updateError || !publication) {
    logger.error("Logo uploaded but publication update failed", { error: updateError, publicationId: id });
    return NextResponse.json({ error: "Logo uploaded but failed to save" }, { status: 500 });
  }

  return NextResponse.json({ publication });
}

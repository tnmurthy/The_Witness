import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * Single callback endpoint for every Supabase Auth flow that redirects
 * back to the app with a `code` query param (PKCE flow): OAuth
 * (Google/GitHub), magic link, email confirmation, and password recovery
 * all land here — Supabase's server SDK doesn't distinguish between them
 * at this step, exchangeCodeForSession works identically for all four.
 *
 * `next` carries the post-auth destination: sign-in/sign-up pass
 * `/dashboard` (or whatever the user was trying to reach, mirroring
 * middleware.ts's own `?next=` param), password recovery passes
 * `/reset-password` so the user lands somewhere that lets them actually
 * set a new password rather than dropping them on the dashboard mid-reset.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    logger.warn("Auth callback code exchange failed", { message: error.message });
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth_callback_failed`);
}

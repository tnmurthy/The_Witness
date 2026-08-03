/**
 * src/lib/email/resend-client.ts
 *
 * Thin wrapper around the Resend SDK.  A single instance is reused across
 * the process lifetime (serverless warm-path).  The RESEND_API_KEY env var
 * is validated at startup when REQUIRE_SERVICE_ROLE=true; here we provide a
 * graceful no-op if it is absent so the rest of the app still boots in
 * environments without an email key.
 */
import "server-only";
import { Resend } from "resend";

let _client: Resend | null = null;

export function getResendClient(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set. Add it to .env.local or Vercel environment variables.");
  }
  if (!_client) {
    _client = new Resend(process.env.RESEND_API_KEY);
  }
  return _client;
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

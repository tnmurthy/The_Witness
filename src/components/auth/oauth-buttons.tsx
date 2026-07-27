"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const PROVIDERS = [
  {
    id: "google" as const,
    label: "Google",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path
          fill="currentColor"
          d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.17-1.81-.17-1.81Z"
        />
      </svg>
    ),
  },
  {
    id: "github" as const,
    label: "GitHub",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-1.04-.01-1.89-2.78.62-3.37-1.21-3.37-1.21-.46-1.2-1.11-1.52-1.11-1.52-.91-.64.07-.63.07-.63 1 .07 1.53 1.05 1.53 1.05.89 1.57 2.34 1.12 2.91.85.09-.66.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.32 9.32 0 0 1 5 0c1.9-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.6.69.49A10.26 10.26 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z"
        />
      </svg>
    ),
  },
];

/**
 * OAuth buttons redirect through Supabase's hosted authorize endpoint and
 * back to our /auth/callback route, same code-exchange path as magic link
 * and email confirmation. Requires Google/GitHub to be enabled with real
 * client credentials in the Supabase dashboard (or supabase/config.toml
 * for local dev) — see docs/AUTHENTICATION.md "Configuring OAuth
 * providers." Clicking a button before that's configured surfaces
 * Supabase's own "provider is not enabled" error via the toast below,
 * rather than failing silently.
 */
export function OAuthButtons() {
  const supabase = createClient();
  const [loadingProvider, setLoadingProvider] = React.useState<string | null>(null);

  async function handleOAuth(provider: "google" | "github") {
    setLoadingProvider(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      logger.warn("OAuth sign-in failed", { provider, message: error.message });
      toast.error(`Couldn't sign in with ${provider}`, { description: error.message });
      setLoadingProvider(null);
    }
    // On success the browser navigates away to the provider, so there's no
    // "success" branch to handle here.
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {PROVIDERS.map((p) => (
        <Button
          key={p.id}
          type="button"
          variant="outline"
          onClick={() => handleOAuth(p.id)}
          disabled={loadingProvider !== null}
        >
          {p.icon}
          {loadingProvider === p.id ? "Redirecting…" : p.label}
        </Button>
      ))}
    </div>
  );
}

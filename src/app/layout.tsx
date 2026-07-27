import type { Metadata } from "next";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

// Self-hosted fonts via @fontsource (npm packages that ship the actual
// .woff2 files), not next/font/google. next/font/google fetches font
// files from Google's CDN at build time, which requires build-time
// network access to fonts.googleapis.com / fonts.gstatic.com — a real
// dependency that fails in network-restricted build environments (CI
// runners behind an egress allowlist, offline/air-gapped builds, this
// project's own sandboxed dev environment). @fontsource ships the font
// files as static assets inside the npm package itself, so `next build`
// has zero external network dependency for fonts. The actual font-family
// name each stylesheet defines is bound to --font-voice/--font-sans/
// --font-mono in globals.css, immediately after these imports.
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/600.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "The Witness",
    template: "%s — The Witness",
  },
  description: "Know the signals. Ignore the noise.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <TooltipProvider>
            {children}
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

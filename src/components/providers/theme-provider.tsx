"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

/**
 * Wraps next-themes with the attribute/values The Witness's tokens expect.
 * design-tokens.css scopes dark-mode overrides under [data-theme="dark"]
 * (Design System doc, "shadcn/ui aliases" section), so this must use
 * attribute="data-theme", not the class-based default.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider attribute="data-theme" defaultTheme="light" enableSystem={false} {...props}>
      {children}
    </NextThemesProvider>
  );
}

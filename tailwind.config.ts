import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import { witnessTheme } from "./src/styles/tailwind.tokens";

/**
 * Tailwind configuration for The Witness.
 *
 * Colors, type scale, spacing, radii, and shadows are NOT hand-duplicated
 * here — they're imported from src/styles/tailwind.tokens.ts, which is the
 * Next.js-project copy of the design system's tailwind.config.tokens.js
 * deliverable. Every value ultimately resolves to a CSS custom property
 * defined in src/styles/design-tokens.css, so editing one token there
 * propagates through Tailwind utilities, shadcn/ui components, and dark
 * mode simultaneously. See the Design System document, Section 1.1.
 */
const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}", "./src/lib/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
    },
    extend: {
      ...witnessTheme,
      // shadcn/ui's generated component classes (bg-background,
      // text-foreground, border, ring, etc.) read these HSL-triplet
      // variables, defined in design-tokens.css alongside the rest of the
      // token set.
      colors: {
        ...witnessTheme.colors,
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        ...witnessTheme.borderRadius,
        DEFAULT: "var(--radius)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;

/**
 * The Witness — Tailwind theme extension
 * ----------------------------------------------------------------------
 * Merge into tailwind.config.ts:
 *
 *   import { witnessTheme } from "./tokens/tailwind.config.tokens";
 *   export default {
 *     darkMode: ["class", '[data-theme="dark"]'],
 *     theme: { extend: witnessTheme },
 *     ...
 *   };
 *
 * Colors reference the CSS custom properties in design-tokens.css (not
 * literal hex) so a single edit there propagates everywhere, including
 * dark mode, without touching this file. shadcn/ui's own generated
 * classes (bg-primary, text-foreground, etc.) already work via the
 * --background/--primary/etc. HSL aliases defined at the bottom of
 * design-tokens.css — this file adds The Witness's own extended
 * vocabulary (navy/gold ramps, editorial font families, reading-width
 * container, signal-brand color) alongside them.
 * ---------------------------------------------------------------------- */

const ramp = (name: string) => ({
  50: `var(--${name}-50)`, 100: `var(--${name}-100)`, 200: `var(--${name}-200)`,
  300: `var(--${name}-300)`, 400: `var(--${name}-400)`, 500: `var(--${name}-500)`,
  600: `var(--${name}-600)`, 700: `var(--${name}-700)`, 800: `var(--${name}-800)`,
  900: `var(--${name}-900)`,
});

// Deliberately untyped against Tailwind's Config["theme"]["extend"] shape —
// this object is consumed by tailwind.config.ts via spread, and Tailwind's
// own types are permissive about extend values. Inferring the literal
// object type here (rather than widening to Record<string, unknown>) is
// what lets `witnessTheme.colors`, `.borderRadius`, etc. be spread
// individually in tailwind.config.ts without a cast.
export const witnessTheme = {
  colors: {
    navy: ramp("navy"),
    gold: ramp("gold"),
    neutral: {
      0: "var(--neutral-0)", 25: "var(--neutral-25)", 50: "var(--neutral-50)",
      100: "var(--neutral-100)", 200: "var(--neutral-200)", 300: "var(--neutral-300)",
      400: "var(--neutral-400)", 500: "var(--neutral-500)", 600: "var(--neutral-600)",
      700: "var(--neutral-700)", 800: "var(--neutral-800)", 900: "var(--neutral-900)",
      950: "var(--neutral-950)",
    },
    success: { 100: "var(--success-100)", 600: "var(--success-600)", 700: "var(--success-700)" },
    warning: { 100: "var(--warning-100)", 600: "var(--warning-600)", 700: "var(--warning-700)" },
    danger:  { 100: "var(--danger-100)",  600: "var(--danger-600)",  700: "var(--danger-700)" },
    info:    { 100: "var(--info-100)",    600: "var(--info-600)",    700: "var(--info-700)" },

    "surface-page": "var(--surface-page)",
    "surface-1": "var(--surface-1)",
    "surface-2": "var(--surface-2)",
    "surface-sidebar": "var(--surface-sidebar)",

    "brand-primary": "var(--brand-primary)",
    "brand-signal": "var(--brand-signal)",
  },
  fontFamily: {
    voice: ["var(--font-voice)"],
    sans: ["var(--font-sans)"],
    mono: ["var(--font-mono)"],
  },
  fontSize: {
    xs: ["var(--text-xs)", { lineHeight: "var(--leading-xs)" }] as [string, { lineHeight: string }],
    sm: ["var(--text-sm)", { lineHeight: "var(--leading-sm)" }] as [string, { lineHeight: string }],
    base: ["var(--text-base)", { lineHeight: "var(--leading-base)" }] as [string, { lineHeight: string }],
    lg: ["var(--text-lg)", { lineHeight: "var(--leading-lg)" }] as [string, { lineHeight: string }],
    xl: ["var(--text-xl)", { lineHeight: "var(--leading-xl)" }] as [string, { lineHeight: string }],
    "2xl": ["var(--text-2xl)", { lineHeight: "var(--leading-2xl)" }] as [string, { lineHeight: string }],
    "3xl": ["var(--text-3xl)", { lineHeight: "var(--leading-3xl)" }] as [string, { lineHeight: string }],
    "4xl": ["var(--text-4xl)", { lineHeight: "var(--leading-4xl)" }] as [string, { lineHeight: string }],
    "5xl": ["var(--text-5xl)", { lineHeight: "var(--leading-5xl)" }] as [string, { lineHeight: string }],
  },
  spacing: {
    0: "var(--space-0)", 1: "var(--space-1)", 2: "var(--space-2)", 3: "var(--space-3)",
    4: "var(--space-4)", 5: "var(--space-5)", 6: "var(--space-6)", 8: "var(--space-8)",
    10: "var(--space-10)", 12: "var(--space-12)", 16: "var(--space-16)", 20: "var(--space-20)",
    24: "var(--space-24)",
  },
  maxWidth: {
    reading: "var(--container-reading)",
  },
  borderRadius: {
    none: "var(--radius-none)", sm: "var(--radius-sm)", md: "var(--radius-md)",
    lg: "var(--radius-lg)", xl: "var(--radius-xl)", full: "var(--radius-full)",
  },
  boxShadow: {
    sm: "var(--shadow-sm)", md: "var(--shadow-md)", lg: "var(--shadow-lg)",
    "focus-gold": "var(--shadow-focus-gold)", "focus-danger": "var(--shadow-focus-danger)",
  },
  transitionDuration: {
    fast: "var(--dur-fast)", DEFAULT: "var(--dur-base)", slow: "var(--dur-slow)",
  },
  transitionTimingFunction: {
    out: "var(--ease-out)", "in-out": "var(--ease-in-out)",
  },
};

export default witnessTheme;

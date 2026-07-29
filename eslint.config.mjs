import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/**
 * ESLint 9 flat config. eslint-config-next's "core-web-vitals" ruleset is
 * pulled in via FlatCompat since it's still published in the legacy
 * .eslintrc-compatible format — this is the standard bridge Next.js
 * itself documents for flat config adoption, not a workaround specific to
 * this project.
 */
const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // scripts/ holds standalone Node CLI tooling (e.g. generate-db-types.js,
    // run directly via `node scripts/x.js`, not bundled into the Next.js
    // app) — conventionally excluded from the application source's lint
    // rules (like no-require-imports, which assumes ESM-only app code)
    // the same way supabase/migrations/ is excluded from JS/TS rules
    // above for not being JS/TS at all.
    ignores: [".next/**", "node_modules/**", "supabase/migrations/**", "next-env.d.ts", "scripts/**"],
  },
  {
    rules: {
      // Logging must go through src/lib/logger.ts (Milestone 1 logging
      // spec) so every log line is structured JSON, not ad hoc text.
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
];

export default eslintConfig;

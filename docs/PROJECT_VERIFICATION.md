# Milestone 9: Project Verification Report

No new features. Ten checks run against the existing implementation.
Every real issue found was fixed; every non-issue (false positive,
environment limitation) is documented as such rather than either
silently worked around or silently ignored.

## Summary

| # | Check | Result |
|---|---|---|
| 1 | TypeScript type checking | Pass |
| 2 | ESLint | Pass |
| 3 | Prettier | Pass (real fix — see below) |
| 4 | Next.js production build | Pass |
| 5 | Supabase type generation | Partial — official tool blocked by environment; working alternative built and partially wired (see below) |
| 6 | Route validation | Verified clean; one finding documented, not fixed (see below) |
| 7 | Import validation | Verified via existing infrastructure |
| 8 | Dead code detection | 5 genuine findings, all fixed |
| 9 | Unused dependency detection | 1 genuine finding, fixed |
| 10 | Circular dependency detection | Genuinely clean (after fixing a blind spot in my own check — see below) |

Final state, verified from a clean-slate `node_modules` reinstall:
`typecheck` pass, `lint` pass, `format:check` pass, `test` (129/129)
pass, `build` pass.

---

## 1-2. TypeScript & ESLint

Both were already clean at the start of this milestone and remained
clean throughout, re-verified after every subsequent change (dependency
additions, dead-code removal, config changes).

## 3. Prettier — a real, previously-undiscovered gap

Prettier was fully configured (`.prettierrc.json`, `npm run format` /
`format:check` scripts existed) but had apparently never actually been
run against the codebase: `format:check` found 161 files with
formatting drift on first run. Fixed with `prettier --write .`,
re-verified typecheck/lint/tests still passed afterward (a pure
reformat should never change behavior, but this was confirmed rather
than assumed).

Two files with bracketed dynamic-route folder names (`[id]`) were
silently skipped by the initial `--write .` glob and required an
explicit `prettier --write` targeting them directly. Rather than trust
that these two were the only ones affected, every bracketed-route file
in the project (39 total) was explicitly re-checked — genuinely clean,
confirming the two fixed were the only real instances of this
glob-matching gap.

## 4. Next.js production build

Clean throughout, including after every later change in this
milestone.

## 5. Supabase type generation — honest partial result

The official `supabase gen types typescript --db-url` command cannot
run in this sandbox. Diagnosed precisely, not just observed: this CLI
mode requires Docker to pull a helper image. Docker itself installs and
runs correctly in this sandbox (confirmed — dockerd starts, `docker
version` succeeds), but pulling any image fails with 403 Forbidden from
registry-1.docker.io, which is outside this sandbox's network
allowlist. This is a specific, confirmed constraint, not a vague "it
didn't work."

What was built instead: `scripts/generate-db-types.js`, a standalone
Node script that generates a structurally-equivalent Database type file
via direct SQL introspection of information_schema/pg_catalog over a
plain Postgres connection — no Docker required. It covers:
- Tables (Row/Insert/Update shapes, matching the official generator's
  conventions for nullability and default-value optionality)
- Enums (every value, verified against the real schema — spot-checked
  wisdom_source_type and platform_role directly against known values
  from earlier milestones)
- Relationships (foreign-key metadata) — added in a second pass after
  the first attempt at wiring the generated file into the app surfaced
  ~150 cascaded type errors, all traced to one root cause: without FK
  metadata, Supabase's client can't type embedded/joined .select()
  queries (.select("*, publications(name)")), and every such query in
  the app collapses to `never`. Fixing the generator to emit
  Relationships (not just working around each individual call site)
  resolved the systemic issue at its source.

Deliberately not included: Functions and Views. The official tool's
function-return-type introspection handles overloads and
table-returning functions in ways a straightforward information_schema
query doesn't reproduce faithfully — getting that wrong silently would
be worse than omitting it honestly.

Wiring status — a real, documented limitation, not silently abandoned:
the generated Database type was wired into all four Supabase client
factories. It works correctly with admin.ts (which uses
@supabase/supabase-js's createClient directly — verified with an
isolated reproduction). It does not work with client.ts, server.ts, or
middleware.ts, which all wrap @supabase/ssr's
createBrowserClient/createServerClient — with the installed package
versions (@supabase/postgrest-js 2.110.8), these resolve every query to
`never` regardless of the Database type's content, confirmed by
isolating the exact same query against the exact same type through
both code paths side by side. This is a genuine @supabase/ssr-specific
issue, not a flaw in the generated types. The Database generic was
reverted from those three files with an explanatory comment pointing
here, so the app continues to typecheck correctly rather than being
left in a broken intermediate state — this is an open item for whoever
next updates @supabase/ssr past whatever version resolves this, not
something worked around by guessing or silently dropped.

To regenerate with the official tool, once Docker + internet access are
available:
```
npx supabase gen types typescript --db-url "<connection-string>" \
  > src/lib/supabase/database.types.ts
```

## 6. Route validation

- Every one of the 45 API route files exports at least one valid HTTP
  method handler — verified explicitly, not just inferred from a
  successful build.
- The middleware's protectedPrefixes list was checked against every
  actual top-level route segment under (dashboard): exact match, no
  gaps, no stale entries.
- Next.js's own build process already validates structural route
  conflicts (duplicate paths, mismatched dynamic segment names at the
  same path position) as a hard build error — since the build passed,
  this class of issue is already covered without a separate check.

Finding, not fixed: only 4 of 22 dashboard route segments with a page
(graph, search, ai-workspace, people) have both loading.tsx and
error.tsx. Everything built in earlier milestones (wisdom,
publications, issues, organizations, admin, settings, dashboard) has
neither. This is a real, worth-knowing inconsistency — but adding ~30
new files providing loading/error UI to routes that currently work
fine without them is new code providing new user-facing behavior,
which conflicts with this milestone's explicit "do NOT add new
features." Documented here rather than either silently fixed (scope
violation) or silently missed.

## 7. Import validation

Covered by existing infrastructure, verified rather than assumed:
confirmed @typescript-eslint/no-unused-vars is actually active (not
just present in some default config) by inspecting the resolved
ESLint config directly. Combined with tsc --noEmit's own module
resolution (which is exactly what "Cannot find module" / "has no
exported member" errors are), broken and unused imports are both
already caught by checks 1-2 passing cleanly. No deep relative imports
(../../../) exist anywhere — the codebase consistently uses the @/
alias.

## 8. Dead code detection

knip (the intended primary tool) crashed with a RangeError: Array
buffer allocation failed inside its oxc-parser dependency's raw AST
transfer mechanism — reproducible, unrelated to available memory
(3.9GB total, 2.9GB free, all ulimits unlimited), and with no CLI flag
to avoid it. A genuine environment-specific tooling incompatibility,
not a code issue — abandoned in favor of ts-prune, which doesn't share
this dependency.

ts-prune's raw output is noisy: most flagged exports are framework
convention (middleware.ts's required middleware/config exports,
*.config.ts default exports, layout.tsx/error.tsx/not-found.tsx
Next.js App Router convention files) or intentional component-library
API surface (ts-prune's own "(used in module)" tag — many UI
primitives export sub-components as part of a module's public contract
even when only some are currently imported elsewhere). Filtering these
out left 5 genuine findings, all confirmed by direct grep before
removal (not trusted blindly) and all fixed:

- membershipRoleSchema, organizationRoleSchema (src/lib/auth/
  roles.ts) — unused Zod schema wrappers. The underlying
  MEMBERSHIP_ROLES/ORGANIZATION_ROLES arrays and their derived types
  remain (confirmed used, e.g. in roles.test.ts) — only the unused
  schema wrappers were removed.
- BlockType (src/lib/blocks/types.ts) — unused type; every real usage
  in the codebase is ImplementedBlockType instead.
- GraphRelationType (src/lib/graph/types.ts) — unused type; code uses
  the GRAPH_RELATION_TYPES const array directly.
- tailwind.tokens.ts's redundant `export default witnessTheme` —
  tailwind.config.ts imports the named export ({ witnessTheme }); the
  default export was dead duplication.
- useDeleteEdge (src/lib/graph/hooks.ts) — an entire unused React
  Query hook, confirmed never called from any component. The backend
  DELETE /api/graph/edges/[id] route it wraps stays — it's a real,
  working, previously-tested endpoint; only the unused client-side
  wrapper was dead. Not adding a "remove connection" UI button to
  finally use it — that would be a new feature.

Every removal was followed by a full typecheck/lint/test/build
re-verification, not batched and assumed safe.

## 9. Unused dependency detection

depcheck found one genuine issue: pg was used by the new
scripts/generate-db-types.js (installed to a scratch directory during
development specifically to avoid touching the project's real
dependencies while prototyping) but never added to package.json. Fixed
properly: pg and @types/pg added as real devDependencies now that the
script is a permanent, committed part of the repo.

Four devDependencies were flagged as "unused" (autoprefixer,
eslint-config-next, postcss, prettier-plugin-tailwindcss) — all four
verified as false positives before being left alone: each is
referenced through a config file (postcss.config.mjs,
eslint.config.mjs's compat.extends("next/core-web-vitals", ...)
string, .prettierrc.json's plugins array) rather than a JS/TS import
statement, which depcheck's static analysis doesn't trace. Zero
genuinely unused production dependencies.

## 10. Circular dependency detection

The first madge --circular run reported zero circular dependencies —
but also silently skipped 114 files it couldn't resolve, every one of
them a @/-aliased import madge didn't know how to follow without
explicit tsconfig awareness. That meant the first "clean" result was
based on an incomplete dependency graph, not a real answer. Re-run with
--ts-config tsconfig.json: zero skipped files, zero circular
dependencies — a genuinely complete and accurate result this time, not
an accidental pass.

## What changed, in full

- `.prettierrc.json`-configured formatting applied to 161 files (no
  behavior change, verified)
- `scripts/generate-db-types.js` (new) + `src/lib/supabase/
  database.types.ts` (new, generated) — real, schema-verified Supabase
  types, with an honest accounting of what does and doesn't use them yet
- `eslint.config.mjs` — added `scripts/**` to ignores (standalone Node
  tooling, not application ESM source)
- `package.json` — added `pg`, `@types/pg` as devDependencies
- 5 dead-code removals across `src/lib/auth/roles.ts`, `src/lib/blocks/
  types.ts`, `src/lib/graph/types.ts`, `src/lib/graph/hooks.ts`,
  `src/styles/tailwind.tokens.ts`
- `src/lib/supabase/admin.ts` — real Database typing, working
- `src/lib/supabase/client.ts`, `server.ts`, `middleware.ts` — attempted
  Database typing, reverted with a documented reason (the
  @supabase/ssr issue above)

## What's still open, honestly

- Database typing on the three @supabase/ssr-based client factories —
  blocked on an upstream package issue, not something more effort in
  this environment resolves.
- The official `supabase gen types typescript` CLI itself cannot run
  here — the hand-built alternative is real and verified but is
  explicitly not a full replacement (no Functions/Views coverage).
- 18 of 22 dashboard routes lack loading.tsx/error.tsx — a real,
  identified inconsistency, intentionally not fixed here as it would be
  new code, not a fix to something broken.

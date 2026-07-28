# AI Workspace — Milestone 6

## Provider abstraction: what "additional models can be added later" means in code

Every AI function (`src/lib/ai/functions/*`) and the orchestrator
(`src/lib/ai/orchestrator.ts`) call a provider exclusively through the
`AIProvider` interface (`src/lib/ai/types.ts`) — never `openai` or
`@anthropic-ai/sdk` directly. Adding a third provider means:

1. Write one new file implementing `AIProvider` (`generateText(params):
   Promise<GenerateTextResult>`), following `providers/openai.ts` or
   `providers/anthropic.ts` as a template.
2. Register it in `registry.ts`'s `getProvider()`.
3. Add its pricing to `pricing.ts`.

Nothing in `src/lib/ai/functions`, the orchestrator, or any API route
changes. This is what the Solution Architecture design document's "model
choice is a configuration decision, not a code change" principle
actually looks like as real code, not just a stated intention.

## The 10 functions, and two scope calls worth being explicit about

All 10 functions from this milestone's brief are implemented: Generate
Issue, Rewrite, Summarize, Improve Writing, Suggest Headlines, Suggest
Images, Generate LinkedIn Post, Generate Email, Generate PDF, Generate
SEO Metadata. Two of the names needed interpretation, and the
interpretation is worth stating plainly rather than leaving implicit:

**"Suggest Images," not "Generate Images."** This function asks the
model for stock/editorial photography search queries and ready-to-use
alt text — it does not produce an actual image. Text-generation models
(what this milestone's provider abstraction supports) don't generate
images; wiring an image-generation API (DALL-E, Midjourney, Stable
Diffusion, etc.) is a meaningfully different integration — a different
provider interface, a different cost model, a different content-
moderation surface — and was scoped out rather than half-built under the
same interface. See `src/lib/ai/functions/suggest-images.ts`.

**"Generate PDF" produces a content package, not a binary PDF.** An LLM
cannot render page layout, typography, or pagination — that's a
rendering pipeline's job (Milestone 10, Publishing Pipeline), not a text
generation call's. `generate_pdf_content` produces what a PDF layout
would be built from: a cover title/subtitle, one verbatim pull quote,
and the issue reorganized into print-appropriate sections. An editor
reviews and places this content; a later milestone's rendering pipeline
turns it into an actual PDF file. See
`src/lib/ai/functions/generate-pdf-content.ts`.

## Generate Issue reuses Milestone 5's block validation exactly

`generate_issue`'s output — an array of `{type, payload}` drafts — is
validated block-by-block against the exact same Zod schemas
(`src/lib/blocks/schemas.ts`) that a human-authored block is validated
against when created through the Issue Builder canvas. There is no
"AI is allowed looser validation" path. A drafted block that fails
validation is excluded from what gets persisted and reported in a
`rejected` list with the specific reason — never silently dropped, and
never persisted malformed. The API route surfaces this as "4 of 5 blocks
drafted" with the rejected type and reason shown, not an unexplained
shortfall.

Every AI-drafted block that does persist is flagged `ai_generated: true`
(already a column on `blocks`, Migration 004) and lands in the Issue
Builder canvas as an ordinary, fully editable draft block — it is never
published automatically. This was true before this milestone (no code
path could set `ai_generated` to anything) and remains true now (the one
code path that can, `/api/issues/[id]/ai/generate`, only ever creates
draft-status content within an issue an editor already has open and
will review).

## ai_jobs: durable and auditable, not fire-and-forget — actually enforced by structure

Migration 005's own comment on `ai_jobs` calls it "a durable, auditable
record... never fire-and-forget." This milestone makes that structurally
true rather than aspirational: `runAIFunction()` in the orchestrator is
the only function in this codebase that calls `getProvider(...)
.generateText(...)`. It creates the `ai_jobs` row (status `running`)
before calling the provider, and always updates it to `completed` or
`failed` afterward — including on a thrown error, in a `catch` block
that persists the failure reason before re-throwing. There is no code
path that can produce AI-generated content without a corresponding
database row recording the attempt, regardless of whether it succeeded.

Migration 017 added `ai_jobs.function_id` (a new `ai_function` enum) so
a job's purpose is recorded alongside the provider/model/cost/token data
Migration 005 already tracked — every prior row implicitly meant
"generate a full issue," the only function that existed before this
milestone.

## Retry, timeout, and cost — where each one lives

- **Timeout**: `GenerateTextParams.timeoutMs` (default 30s), enforced via
  `AbortController` in `src/lib/ai/retry.ts`'s `withRetry`, passed through
  to both SDKs' request `signal` option.
- **Retry**: exponential backoff (3 attempts, 500ms base delay, doubling),
  but only for errors the provider implementation marked `retryable:
  true` — a 429 or 5xx, not a 401 or a malformed-request 400. Retrying an
  auth failure three times just triples the latency before failing the
  same way a first attempt would have; the `retryable` flag on
  `AIProviderError` is what prevents that.
- **Cost**: estimated from a static per-million-token pricing table
  (`src/lib/ai/pricing.ts`), because neither provider's API response
  includes a dollar figure. This is explicitly an estimate for cost
  visibility, not a billing-grade number — the table will drift as
  providers change pricing, and there's no automated mechanism keeping it
  current in this milestone. A real invoice reconciliation would read the
  provider's own billing API, not this table.

## What could not be tested end-to-end

This environment has no real `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`, and
even if it did, this sandbox's network access is restricted to an
allowlist that doesn't include `api.openai.com` or a general Anthropic
API endpoint. That means one specific thing was genuinely not verifiable
here: an actual AI provider call returning real generated text.

What was verified, and how:

- **Every function's pure logic** (input validation, prompt composition,
  result parsing, including markdown-fence stripping and per-block
  validation in Generate Issue) — 25 tests, zero mocking of a provider
  needed, because `AIFunctionDefinition` deliberately keeps all of this
  provider-agnostic.
- **Retry and backoff behavior** — tested directly against a fake
  provider function that throws a controlled number of times, confirming
  retryable errors retry up to the limit and then give up, and
  non-retryable errors fail immediately without wasting a retry.
- **Cost estimation** — tested against the actual pricing table's known
  values.
- **Every API route's auth and validation behavior** — live-verified with
  real `curl` requests against a running production build: unauthenticated
  requests correctly 401, the public capability-listing endpoint correctly
  works without auth, nested dynamic routes resolve without crashing.
- **Migration 017** — applied cleanly against a live PostgreSQL 16
  instance as part of the full 17-migration chain.

What requires a real deployment with real provider keys: confirming an
actual `generateText` call against OpenAI or Anthropic returns
well-formed output, that the token usage and cost recorded in `ai_jobs`
match what the provider actually billed, and that a real rate-limit or
auth failure from the live API is correctly classified as
retryable/non-retryable by the `isRetryableStatus` logic in each
provider file. That verification belongs to whoever runs this with real
keys — documented here as an explicit, named gap rather than implied to
be covered.

## What's deliberately not in this milestone

- **Image generation** — see "Suggest Images, not Generate Images" above.
- **Binary PDF rendering** — see "Generate PDF" above; Milestone 10 scope.
- **A per-publication default provider/model setting.** `settings`
  (Migration 009) already reserves a place for this (a publication-scoped
  key-value row), and `getDefaultProviderId()` documents the current
  behavior (prefer Anthropic, fall back to OpenAI, whichever has a
  configured key) as a placeholder for it — but no UI or API route in
  this milestone lets an editor actually set that preference yet.
- **Embeddings** (`embedText`). The original AI Workspace Orchestrator
  concept in the Solution Architecture design document mentions this as
  a future operation on the provider interface, reserved for Milestone 8
  (Search) — not implemented here since nothing in this milestone
  consumes it yet.

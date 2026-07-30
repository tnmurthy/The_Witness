# Milestone 8B: Knowledge Graph Integration

## What "integrate throughout" meant, concretely

The chain this milestone names — Articles → Companies → Technologies →
Books → Research → Courses → GitHub → People → Subhashitams → Advaita
Principles → Issue Builder → Search → Analytics — is, structurally,
already the Knowledge Graph built in the Knowledge Graph milestone and
wired into the frontend in Milestone 8A: every one of those content
types (Subhashitams and Advaita Principles are `wisdom_entries` rows
with `source_type = 'subhashitam'` / `'advaita_principle'`, not separate
graph node types) has been a `reference_entity_type` value, searchable
via `/api/graph/entities`, navigable in the Graph Explorer, and
connectable via `knowledge_graph_edges` since that migration. This
milestone's actual, substantive work was making three specific links in
that chain materially better, not building the chain from scratch:

1. **Issue Builder** — replacing generic, uniformly-sampled connection
   suggestions with content-driven, per-category search-relevant ones
   across exactly the 6 categories this milestone's brief names.
2. **Search** — already fully connected as of Milestone 8A
   (`/api/graph/retrieve` covers all 13 entity types, including all 6
   named here); no changes were needed, and none were made.
3. **Analytics** — added a real, narrowly-scoped slice of Knowledge
   Graph analytics, replacing the honest "not built yet" placeholder
   for exactly the part of analytics this platform can honestly answer
   today.

## Why this needed its own AI function, not just calling suggest_graph_connections differently

`suggest_graph_connections` (Knowledge Graph milestone) samples a
handful of entities uniformly across every other type — a reasonable
cold-start default with no other signal to go on. This milestone's
brief specifically asks for automatic suggestion driven by what the
issue actually covers, which is a materially different problem: the
candidate pool itself needs to be built from real relevance, not random
sampling.

`recommend_related_entities` (`src/lib/ai/functions/recommend-related-
entities.ts`) does that: the API route
(`/api/issues/[id]/graph/recommend-related`) derives the issue's topic
from its own hero-story/signal-card content (same technique
`recommend_wisdom` already used), then runs real Postgres full-text
search — the same `search_vector` infrastructure `/api/graph/retrieve`
uses — against each of the 6 named categories using that topic, before
ever calling the model. The AI's job is judgment over an
already-relevant pool, not guessing relevance from an unfiltered
sample. Output is grouped by category, matching how an editor actually
wants to review this: a Companies section, a Technologies section, and
so on — not one undifferentiated list.

Same anti-hallucination discipline as every other AI Workspace function
that recommends existing content: the model can only return an id it
was explicitly shown, and the route double-checks every returned id
against the candidate set before it's ever displayed, let alone
persisted as an edge. Nothing is created automatically — every
suggestion is a card with "Add connection," reviewed and accepted one
at a time.

## Analytics: one honest, real slice, not a broader claim

`KnowledgeGraphAnalytics` computes connection counts by relation type
and the most-connected entities directly from `knowledge_graph_edges` —
real numbers, not projected or estimated. It answers "how connected is
the graph, and by what kinds of relationships" — a question this
platform's existing data can actually answer. The Analytics page still
says plainly, unchanged from Milestone 8A, that reader engagement,
subscriber growth, and content performance remain unbuilt (no
event-tracking pipeline exists) — adding one real, narrow slice of
analytics doesn't change that honest boundary for the parts that are
still genuinely missing.

## What was deliberately not built

**A standalone Article authoring UI.** Reading `articles`' own table
comment: "A standalone article not tied to a specific issue edition.
Uses the same section/block model as issues." This is a first-class
authored-content type parallel to Issues — not a reference-library row
like books or papers — and no milestone across this entire project has
built any UI for creating or editing one; the table exists, but there
is no Article Builder anywhere in this codebase. Building that is a
legitimately large, separate scope (essentially a second Issue
Builder), not something "Knowledge Graph Integration" implies on its
own. Articles remain fully integrated into the graph (searchable,
connectable, navigable) exactly as they were after Milestone 8A — this
milestone didn't need to touch that, and building an authoring UI for
them wasn't what was asked.

## Testing

- **Migration 020**: a single, minimal addition (`recommend_related_
entities` added to the `ai_function` enum) — applied cleanly against
  live PostgreSQL as part of the full 20-migration chain.
- **9 new tests**: candidate-category validation (rejecting a candidate
  outside the 6 named types), prompt composition (candidates genuinely
  grouped by category in the prompt text, every candidate's exact id
  present so the model can't invent one, the system message explicitly
  permitting an empty category as a correct answer rather than a
  failure), and result parsing.
- **A real error caught by re-verification, not the first typecheck
  pass**: a test asserted on `buildPrompt`'s `system` field without
  accounting for its type being optional — TypeScript caught this only
  on the second verification pass, after the test itself was added,
  underscoring why re-running the full pipeline after every change
  matters and isn't a formality.
- **Full pipeline** (`typecheck`/`lint`/`test`/`build`) verified clean
  from a clean-slate `node_modules` reinstall. Worth naming plainly: the
  very first typecheck run this milestone produced a wall of hundreds of
  "cannot find module" errors across the entire codebase, including
  files never touched this session — not a real bug, but the
  unmistakable signature of `node_modules` having been deleted at the
  end of the previous milestone's packaging step and never reinstalled
  before running checks in this new session. Recognized correctly as an
  environment-state issue rather than chased as a code problem, fixed
  with `npm install`, and confirmed by the clean re-run immediately
  after.
- **Live verification**: the new route correctly 401s unauthenticated,
  and every page this milestone touched still redirects correctly, with
  zero server errors.

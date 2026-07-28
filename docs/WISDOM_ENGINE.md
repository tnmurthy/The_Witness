# Wisdom Engine — Milestone 7

The signature feature: a structured knowledge system across seven
classical sources, integrated into the editorial workflow rather than
sitting beside it as a separate reference library.

## The seven sources, and what changed to support all of them

Three sources (Bhagavad Gītā, Sanskrit Subhāṣitams, Advaita Vedānta)
already had first-class support (`006_wisdom_engine.sql`). This
milestone added the remaining four — Upaniṣads, Chanakya Nīti,
Panchatantra, Hitopadeśa — as genuinely first-class source types with
their own specialization tables, not folded into the generic `other`
bucket:

| Source | Table | Structure |
|---|---|---|
| Bhagavad Gītā | `gita_verses` | chapter + verse |
| Sanskrit Subhāṣitam | `subhashitams` | meter + attributed_to |
| Advaita Vedānta | `advaita_principles` | source_work + tradition_note |
| Upaniṣads | `upanishad_verses` | name + optional chapter/verse |
| Chanakya Nīti | `chanakya_niti_verses` | chapter (adhyaya) + verse (shloka) |
| Panchatantra | `panchatantra_tales` | tantra number (1-5) + name + tale title |
| Hitopadeśa | `hitopadesha_stories` | section name + story title |

Each source is structured differently on purpose — a Panchatantra tale
genuinely isn't organized like a Gītā verse (books and tales vs.
chapters and verses), and forcing them into one shared shape would
either overgeneralize or silently drop a distinction an editor or reader
actually cares about. Verified against live PostgreSQL by inserting one
real entry for all seven sources in the same test run.

## The 13 fields, and where "Related Wisdom" actually lives

Every field this milestone's brief lists exists: Sanskrit (`source_text`),
Transliteration (`iast`), Translation, Commentary, Source (source type +
specialization fields + a display label), Keywords, Category, Technology
Lens, Career Lens, Leadership Lens, Reflection (reflection questions),
Practical Exercise, Related Wisdom.

Related Wisdom doesn't have its own table — it reuses the existing
generic `knowledge_graph_edges` table (`007_knowledge_graph.sql`,
`source_type`/`target_type = 'wisdom_entry'`), the same long-tail edge
pattern already used for every other loosely-typed relationship in this
schema. A dedicated table would have duplicated something that already
existed for exactly this purpose.

## A schema comment that turned out to describe something that was never built

`wisdom_entries`' own table comment (`006_wisdom_engine.sql`) says only
approved entries "may be attached to a published issue block (enforced
at the application layer... see also `can_attach_wisdom_entry()`)."
That function doesn't exist anywhere in the migration history — it was
documented as an intention, not built. This milestone is what actually
implements the rule it describes: `POST /api/blocks/[id]/attach-wisdom`
checks `review_status === 'approved'` before letting a wisdom entry's
content populate a Today's Wisdom block, which is the application-layer
enforcement the comment always meant to point to.

## Search: scoped to the Wisdom Engine, not a new global search system

`GET /api/wisdom-entries?search=` uses Postgres full-text search over
`wisdom_entries.search_vector` — a generated tsvector column that
already existed (`008_search.sql`), built for the platform-wide search
system Milestone 8 will construct. This milestone uses it for exactly
one library, not as a first draft of that larger system. The `/wisdom`
list page's search bar and source/status filters are this milestone's
"Search" deliverable.

## The AI recommendation engine: what it actually does, honestly

"The AI should automatically recommend appropriate wisdom based on
issue topics" is implemented as `recommend_wisdom`, an 11th AI function
following Milestone 6's exact architecture (same `AIProvider` interface,
same `ai_jobs` persistence, same retry/cost tracking).

What it is: an LLM given an issue's own content (its hero story and
signal block text, falling back to the issue title) and an explicit list
of every approved wisdom entry — up to 60, capped for prompt size —
asked to pick up to 5 that genuinely illuminate the topic, with a
relevance score and a one-sentence rationale. The model can only ever
recommend an id it was actually shown; the route double-checks every
returned id against the candidate set before persisting anything, so a
hallucinated id is silently dropped rather than trusted.

What it is not: vector similarity search. `wisdom_entries.embedding`
(`008_search.sql`) exists as a column, but nothing populates it yet —
that's the embedding-generation pipeline Milestone 8 builds. This is a
deliberate, working interim design, not a placeholder pretending to be
the final one: an LLM reading titles, translations, and categories and
using its own judgment is a real, reasonable recommendation mechanism on
its own merits, independent of whether vector search is ever added on
top of it later.

"Automatically" means one click, not zero. An editor triggers
recommendation generation explicitly (`WisdomRecommendationsPanel` in
the Issue Builder) rather than it firing silently on every keystroke or
page load — a real provider call has a real, tracked cost
(`ai_jobs.cost_usd`), and firing it without a user action would be the
kind of surprise spend this codebase has been careful to avoid
everywhere else Milestone 6 touches.

## The candidate pool will need re-thinking as the library grows

Capping candidates at 60 (oldest-first ordering past that) is an honest,
stated limitation, not a hidden one: once the approved library grows
past a few dozen genuinely well-curated entries, always including the 60
most recently created ones stops being a meaningful pre-filter. The two
real fixes — keyword/category pre-filtering before the LLM call, or
actual vector search once Milestone 8's embedding pipeline exists — are
both future work, not silently assumed to be unnecessary.

## Review workflow and separation of duties

Mirrors the pattern editorial content review already follows elsewhere
in this app: any editorial role (Writer, Researcher, Editor,
Editor-in-Chief, Super Admin) can author a wisdom entry and submit their
own draft for review; only Editor/Editor-in-Chief/Super Admin can
approve or reject one. Rejection now records a reason (`review_notes`,
added by this migration — the column didn't exist before, and its
absence would have made a rejected entry tell its author nothing they
could act on).

## Testing

- **Migration 018**: applied cleanly against live PostgreSQL as part of
  the full 18-migration chain; verified with real inserts — one entry
  per source across all seven, confirming the specialization-table model
  actually works end-to-end, not just that the DDL runs.
- **Application**: 14 new tests covering source-type validation, the
  per-source specialization schema (including that `panchatantra_tale`
  genuinely rejects a `tantraNumber` outside 1–5, and that
  `upanishad_verse`'s chapter/verse are optional while its name isn't),
  and the recommendation function's candidate-id containment logic.
- **A real inconsistency found and fixed during live route verification**:
  `/api/wisdom-categories`'s `GET` was the one route in this milestone
  without the same auth check every other route in this app has. Not a
  security issue (RLS still governs the underlying data) — but it meant
  this route reached the database and hit a raw connection failure (500)
  on an unauthenticated request in this test environment, instead of the
  same clean 401 every other route returns before ever touching the
  network. Fixed for consistency with the rest of the API surface.
- **Full pipeline**: `typecheck`/`lint`/`test`/`build` all pass from a
  clean-slate `node_modules` reinstall — clean on the first attempt for
  typecheck, lint, and test this time; the one real issue this milestone
  surfaced came from live route verification, not from any of the
  automated gates, which is itself worth noting rather than treating the
  gates as sufficient on their own.

## What's deliberately not in this milestone

- **Vector-based recommendation matching** — see "What it is not" above;
  Milestone 8 (Search) scope.
- **Pre-filtering the recommendation candidate pool** by keyword/category
  overlap before the LLM call — see "The candidate pool will need
  re-thinking" above.
- **A public-facing Wisdom Engine browse page for readers.** Every route
  and page in this milestone is behind authentication, matching this
  app's existing pattern (this is an editorial tool, not reader-facing
  content delivery) — a published issue's Today's Wisdom block is what
  readers actually see; the library itself stays internal.

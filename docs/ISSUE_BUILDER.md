# AI-Powered Issue Builder — Milestone 5

## Block types: what's implemented, and two names that changed

All 15 block types from this milestone's brief are implemented. All 15
already existed as values in the `block_type` Postgres enum
(`001_extensions_and_conventions.sql`) — this milestone built the
editors and renderers, not the schema, for them.

Two display labels intentionally differ from their underlying enum
value, because this milestone's brief used different names than the
original schema design:

| Enum value         | Displayed as        |
| ------------------ | ------------------- |
| `signal_card`      | "Technology Signal" |
| `research_summary` | "Research Paper"    |

The enum values themselves are unchanged. Renaming a Postgres enum label
that other rows and code already reference is real migration risk (see
Migration 013's rename-recreate dance in the Authentication milestone) —
a display label is a free, zero-risk way to reconcile naming without
touching the database.

Four enum values (`chart`, `book_recommendation`, `technology_radar`,
`decision_framework`) remain valid but unimplemented — a block with one
of those types won't be rejected by the database, it renders as an
"unsupported block type" fallback until a later milestone adds it. Same
incremental pattern as the rest of this schema.

## Architecture: one switch file per concern, not fifteen files per type

`block-renderer.tsx` (read mode) and `block-editor-fields.tsx` (edit
mode) are each a single file with a switch over all 15 types, rather
than 15 separate files per type times 2 modes. This was a deliberate
choice, not a shortcut:

- The registry (`src/lib/blocks/registry.ts`), the payload schemas
  (`src/lib/blocks/schemas.ts`), and these two switch files are the
  only three places that need to change to add a 16th block type — not
  "hunt through the codebase for every place a block-type list was
  hand-duplicated."
- Related block types (e.g. Signal Card and Career Insight, both
  editorial cards with similar visual weight) stay visually consistent
  because they're written next to each other and share the same file's
  imports.

## Drag-and-drop: @dnd-kit, not react-beautiful-dnd

react-beautiful-dnd (the historically more common choice) is
unmaintained. @dnd-kit is actively maintained and — more importantly for
this product's accessibility commitments (Design System doc, Section 14) — ships a working `KeyboardSensor` out of the box, so block
reordering has a real keyboard-operable path, not just a mouse-drag one.
`PointerSensor`'s `activationConstraint: { distance: 8 }` means a plain
click to enter edit mode is never misread as a drag attempt.

## Autosave

Every block edit debounces a `PATCH /api/blocks/:id` call 800ms after
the last keystroke. Client-side payload validation runs before that
network call, so a save is only skipped (not error-toasted) when the
payload is mid-edit and momentarily invalid — e.g. a table row that was
just added but not yet filled in — rather than spamming the user with a
validation error on every keystroke of an unfinished edit.

## Version history: throttled, not per-keystroke

`issue_revisions` already existed (`004_issue_builder.sql`). What this
milestone adds is when a snapshot gets written:

- Explicitly, via the "Save version now" button — always creates a
  checkpoint, optionally labeled.
- Automatically, from the autosave path, but at most once every 5
  minutes per issue (`SNAPSHOT_THROTTLE_MS` in
  `src/app/api/issues/[id]/revisions/route.ts`).

Snapshotting on every autosave (which fires on every debounced pause in
typing) would flood `issue_revisions` with a near-continuous history
that isn't actually useful as "versions" a person would want to browse
or restore — hundreds of near-identical rows differing by one sentence
each. The 5-minute throttle keeps the list meaningful.

Restore is itself undoable. Restoring to an old version first saves the
current (pre-restore) state as its own checkpoint labeled "Before
restore," so restoring is never a one-way door. The restore operation
reconciles (updates rows whose ids still exist, recreates ones that were
deleted, removes ones that didn't exist in the snapshot) rather than
delete-everything-then-recreate-everything, so Realtime broadcasts to
other connected clients stay meaningful.

## Collaboration model: block-level last-write-wins, not character-level CRDT

This is "collaboration-ready," and it's worth being precise about what
that does and doesn't mean.

**What it is:**

- Every block insert/update/delete/reorder broadcasts live to every
  other client with the issue open (Supabase Realtime `postgres_changes`
  on `blocks`/`sections`, enabled in Migration 016).
- A presence bar shows who else currently has the issue open (Supabase
  Realtime Presence).
- `blocks.last_edited_by` / `last_edited_at` (Migration 016) record who
  changed a block and when.
- Echo suppression: the Zustand store tracks `pendingBlockIds` — a block
  currently mid-autosave-debounce on this client ignores incoming
  Realtime updates for itself, so a collaborator's broadcast can't
  overwrite an edit the local user is still typing before it's even
  saved. Tested directly (`src/__tests__/issue-builder.test.ts`).

**What it is not:** two people editing the same block's text field at
the same moment does not merge character-by-character. The later
`PATCH` wins and fully overwrites the payload the earlier one wrote —
last-write-wins at the block granularity, not operational-transform or
CRDT-based merge (the technology behind tools like Google Docs'
real-time co-editing). Building true concurrent same-block text merging
is a substantially larger undertaking (integrating a CRDT library like
Yjs, rethinking the payload's storage shape to support it, rethinking
autosave entirely) — explicitly out of scope for this milestone.
Block-level granularity covers the practical, common case: two people
rarely edit the exact same block at the exact same second, even when
several people are actively working on the same issue.

## Testing

- **Migration 016**: tested against live PostgreSQL — the
  `blocks.issue_id` denormalization trigger and the `last_edited_at`
  trigger both confirmed working with real inserts/updates.
- **Application**: 17 new tests covering block type registry/schema
  completeness, payload validation (accept/reject cases per type), and
  the Zustand store — including a dedicated test proving echo
  suppression actually works (a pending block's local edit survives an
  incoming remote change; a non-pending block's local state is correctly
  updated by one).
- **Full pipeline**: `typecheck` / `lint` / `test` / `build` all pass
  from a clean-slate `node_modules` reinstall. One real type error was
  caught and fixed in the API layer (a generically-typed registry lookup
  resolving to `unknown` at one specific call site) — everything else
  passed clean on the first attempt, unusual for a milestone this large
  and worth naming rather than assuming it means less rigor was applied.
- **Live**: every new route verified with real `curl` requests against a
  running production build, including the most deeply nested one
  (`/api/issues/:id/revisions/:revisionId/restore`) — all resolve
  correctly with zero server errors.

## What's deliberately not in this milestone

- **Character-level collaborative text editing** — see "Collaboration
  model" above.
- **AI-generated blocks.** `blocks.ai_generated` is rendered (a visible
  badge on AI-authored blocks) but nothing in this milestone sets it to
  `true` — that's the AI Workspace itself, a separate milestone per the
  Implementation Plan. The Issue Builder is ready to receive AI-drafted
  blocks the moment that milestone exists; it doesn't produce them yet.
- **Rich text formatting within a paragraph** (bold/italic/links inline,
  not just per-block). Paragraph and similar text blocks are currently
  plain text, not a rich-text editor (no ProseMirror/Slate/Lexical
  integration) — a deliberate scope boundary, and a natural candidate for
  a focused follow-up.

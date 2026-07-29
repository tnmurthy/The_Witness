# Design System — Milestone 3

Companion to the standalone Design System deliverable (tokens/design-tokens.css,
tokens.json, tailwind.config.tokens.js, style-guide.html) produced earlier.
This document covers what changed once those tokens became real, running
application code: every shadcn/ui component actually built into
`src/components/ui`, the layout components that compose them, and the
decisions made integrating them into a live Next.js app rather than a
standalone reference page.

**Live reference:** every component below is demonstrated with real,
running code at `/style-guide` (public, no sign-in required — see "Why
this page is public" at the end of this document).

## Design inspiration

- **Apple (Human Interface Guidelines):** restraint, generous whitespace,
  a small number of clear affordances per screen, motion that's felt more
  than seen (160ms default transition, capped at 240ms).
- **Financial Times:** editorial gravitas via the serif type family
  (Source Serif 4) reserved specifically for headlines and long-form
  copy, hairline dividers instead of heavy borders, a restrained accent
  color used sparingly rather than everywhere.
- **Notion:** the block/card vocabulary, muted neutral surfaces, a flat
  (mostly shadow-free) visual language where hierarchy comes from
  spacing and type weight rather than drop shadows.

None of these are followed literally — see `docs/RBAC.md`-style rationale
throughout this document for where The Witness diverges and why.

## Component inventory

Every component lives in `src/components/ui/*.tsx`, one file per
component, following shadcn/ui's file-per-component convention exactly
(this is a deliberate choice: it's what makes `npx shadcn add <name>`
safe to run for any _new_ component even though the registry CDN wasn't
reachable from this project's build sandbox for the components already
here — see Milestone 1's README note on this).

| Component        | File                | Notes                                                                                |
| ---------------- | ------------------- | ------------------------------------------------------------------------------------ |
| Button           | `button.tsx`        | 6 variants incl. `signal` (gold-700, reserved for AI actions)                        |
| Badge            | `badge.tsx`         | 6 variants; always paired with text, never color-only                                |
| Alert            | `alert.tsx`         | `role="alert"` (danger/warning) vs `role="status"` (info/success)                    |
| Card             | `card.tsx`          | Header/Title/Description/Content/Footer sub-components                               |
| Table            | `table.tsx`         | Hairline dividers, not zebra striping                                                |
| Input            | `input.tsx`         | 40px height, gold focus ring                                                         |
| Textarea         | `textarea.tsx`      | Same field-state classes as Input                                                    |
| Select           | `select.tsx`        | Radix-based; requires `Controller`/`FormField`, not `register()`                     |
| Checkbox         | `checkbox.tsx`      | Radix-based                                                                          |
| RadioGroup       | `radio-group.tsx`   | Radix-based                                                                          |
| Switch           | `switch.tsx`        | Radix-based                                                                          |
| Form             | `form.tsx`          | react-hook-form context wrapper (`FormField`/`FormItem`/`FormControl`/`FormMessage`) |
| Label            | `label.tsx`         | Radix-based                                                                          |
| Dialog           | `dialog.tsx`        | Branded navy overlay, not generic black                                              |
| Sheet            | `sheet.tsx`         | Side-panel variant of Dialog; powers the mobile nav drawer                           |
| Tabs             | `tabs.tsx`          | Radix-based                                                                          |
| Breadcrumb       | `breadcrumb.tsx`    | Composable primitives, not a single monolithic component                             |
| Tooltip          | `tooltip.tsx`       | Radix-based                                                                          |
| DropdownMenu     | `dropdown-menu.tsx` | Radix-based; powers the user menu                                                    |
| Avatar           | `avatar.tsx`        | Initials fallback: navy-100 bg / navy-800 text                                       |
| Separator        | `separator.tsx`     | Radix-based                                                                          |
| Skeleton         | `skeleton.tsx`      | Respects `prefers-reduced-motion` globally, no per-use opt-out                       |
| Sonner (toast)   | `sonner.tsx`        | Transient feedback — see "Alert vs. toast" below                                     |
| Typography       | `typography.tsx`    | `H1`–`H4`, `Lead`, `Text`, `Muted`, `Eyebrow`, `InlineCode`                          |
| Container / Grid | `container.tsx`     | Responsive layout helpers                                                            |

Layout components (compose the above, not primitives themselves):

| Component     | File                       |
| ------------- | -------------------------- |
| Sidebar       | `layout/sidebar.tsx`       |
| Topbar        | `layout/topbar.tsx`        |
| MobileNav     | `layout/mobile-nav.tsx`    |
| AppShell      | `layout/app-shell.tsx`     |
| ErrorBoundary | `error/error-boundary.tsx` |

## Alert vs. toast

Two different problems, deliberately two different components:

- **Alert** (`alert.tsx`) — persistent, in-flow. Stays on screen until the
  surrounding content changes (a validation error under a form, an empty
  state with a call to action). Rendered inline in the document, so it's
  part of the page's reading order and gets picked up by a screen
  reader's normal navigation, not just its live-region announcement.
- **Toast** (Sonner, `sonner.tsx`) — transient, fire-and-forget. Confirms
  an action already happened ("Role updated") and disappears on its own.
  Never used for something the user still needs to act on.

Using Alert where a toast belongs (or vice versa) is the most common
misuse — if the message needs to persist until the user does something
about it, it's an Alert; if it's just confirming what already happened,
it's a toast.

## Forms: two patterns, by necessity

Milestone 2's forms (`SignInForm`, `SignUpForm`, `ForgotPasswordForm`,
etc.) were written before `form.tsx` existed, using react-hook-form's
`register()` directly with hand-written `aria-invalid`/error-`<p>` pairs.
That pattern still works and remains valid for pure native-input forms.

`form.tsx`'s `Form`/`FormField`/`FormItem`/`FormControl`/`FormMessage`
pattern is **required**, not merely preferred, the moment a form includes
a non-native control — `Select`, `RadioGroup`, `Checkbox`, and `Switch`
are all Radix primitives with a `value`/`onValueChange` (or
`checked`/`onCheckedChange`) contract, not a native `onChange` event
`register()` can bind to directly. `CreateOrganizationForm`
(`src/components/organizations/create-organization-form.tsx`) was
refactored in this milestone specifically to demonstrate this — it's the
form to copy from for any new form that needs a `Select`.

## Responsive layouts

The Sidebar (`layout/sidebar.tsx`) is `hidden` below the `md` breakpoint
by design — importantly, this milestone found and fixed the gap that left
behind: below `md`, there was previously nothing standing in for it.
`MobileNav` (`layout/mobile-nav.tsx`) is a hamburger trigger in the Topbar
that opens the exact same nav item list in a `Sheet` drawer, sharing one
`NAV_ITEMS` source of truth (`layout/nav-items.ts`) with the desktop
Sidebar — a module can never be added to one and forgotten in the other.

| Breakpoint             | Layout                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| `< 768px` (below `md`) | Sidebar hidden; hamburger + Sheet drawer in Topbar; search collapses to an icon-only button |
| `≥ 768px` (`md`+)      | Full 240px Sidebar; search input with `⌘K` hint visible                                     |
| `≥ 1280px` (`xl`+)     | Dashboard widget grid gains a column (2 → 4, via `Grid`)                                    |

## Accessibility

Builds on the contrast verification already done for the token layer
(gold-600 was found to fail WCAG contrast and corrected to gold-700 for
any text/border/focus use on light surfaces — see the original Design
System deliverable, Section 2.5, for the measured ratios). What's new in
this milestone:

- **Focus is never invisible.** Every interactive component in this
  inventory uses either `focus-visible:shadow-focus-gold` (buttons,
  checkboxes, switches, radio items) or the equivalent
  `focus-visible:border-gold-700 focus-visible:ring-2` pattern (text
  inputs, select, textarea) — both resolve to the same gold-700,
  5.27:1-contrast ring.
- **Alert urgency maps to ARIA role**, not just color: `danger`/`warning`
  render `role="alert"` + `aria-live="assertive"` (interrupts a screen
  reader immediately); `info`/`success` render `role="status"` +
  `aria-live="polite"` (announced without interrupting). This is decided
  by the `variant` prop, not left to the caller to remember.
- **Skeleton respects `prefers-reduced-motion` for free** — the pulse
  animation is capped by the global rule in `globals.css`
  (`animation-duration: 0.01ms !important` under that media query), so no
  individual component needs its own reduced-motion branch.
- **Required fields are marked in gold, never red** — red is reserved
  exclusively for error states, so a field is never ambiguous between "you
  haven't filled this in yet" and "what you entered is invalid."
- **The mobile nav drawer doesn't trap keyboard focus incorrectly** —
  it's a Radix Dialog under the hood (via `Sheet`), which handles focus
  trapping and return-focus-on-close correctly out of the box; this
  wasn't hand-built.

## Why `/style-guide` is public

It's a documentation resource, not application functionality — gating it
behind sign-in would make it slower to reference while building a new
page and wouldn't protect anything sensitive (every example on it is
static demo content). It's deliberately excluded from
`middleware.ts`'s `protectedPrefixes` list for this reason, not by
omission.

## What's deliberately not in this milestone

- **Storybook or a similar isolated component-dev tool.** `/style-guide`
  serves the same "see every component" purpose inside the app itself,
  without a second toolchain to maintain. This can be revisited if the
  component count grows enough that Storybook's isolation (mocking props,
  testing edge cases in isolation) becomes worth the overhead.
- **A generic per-nav-item role-visibility system.** `ADMIN_NAV_ITEM` is
  hand-conditioned in `Sidebar`/`MobileNav` because it's currently the
  only role-gated nav entry; a data-driven `roles: PlatformRole[]` field
  on every `NavItem` is the natural next step once a second one appears,
  not built speculatively now.
- **Command palette (⌘K).** The Topbar's search trigger is a static
  affordance; the real `Command` implementation is Milestone 8 (Search)
  scope per the Implementation Plan.

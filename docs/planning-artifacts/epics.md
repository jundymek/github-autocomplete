---
title: github-autocomplete — Epic Breakdown
status: final
created: 2026-07-09
updated: 2026-07-09
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - docs/planning-artifacts/prds/prd-github-autocomplete-2026-07-09/prd.md
  - docs/planning-artifacts/architecture.md
  - CLAUDE.md
  - docs/task.md
---

# github-autocomplete - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for github-autocomplete, decomposing
the requirements from the PRD (FR-1..19, NFR-1..6) and the Architecture Decision Document
(AR-1..14) into implementable stories. Epic structure follows the sequence fixed in
architecture.md §4 and the CLAUDE.md epic→folder mapping: Epic 0 (Foundation) → Epic 1 (Core
autocomplete) and Epic 2 (GitHub adapter) — parallelizable — → Epic 3 (Demo, e2e & launch).

Every story ships its documentation folder under `docs/features/<epic-folder>/<id>-<slug>/`
(README.md always; MANUAL_TESTING.md only when a human verifies UI behavior in a browser), per
CLAUDE.md. Story branches: `story/<id>-<slug>` → `master`, squash-merged, Conventional Commits
with the story id as scope.

## Requirements Inventory

### Functional Requirements

FR-1: Minimum query threshold — fetch Suggestions only when the Query is ≥ 3 characters; below it, no request and the Dropdown stays closed; deleting to 2 chars closes the Dropdown and cancels any in-flight request.
FR-2: Debounced fetching — ~300 ms quiet period after the last keystroke before a request fires; intermediate keystrokes produce no requests.
FR-3: Stale-request cancellation — a Query change (or drop below threshold) cancels the in-flight request; late responses are discarded and never overwrite newer results.
FR-4: Dual-domain search — two parallel searches (users + repositories) per qualifying Query; a partial failure (one fails, one succeeds) surfaces as the full error state, never partial results.
FR-5: Alphabetical combined ordering — merged list ordered case-insensitively (locale-aware), keyed on user login and bare repository name (not `owner/name`; display may show `owner/name`).
FR-6: Result cap of 50 — each search requests at most 50 items (`per_page=50`) and the combined displayed list is trimmed to at most 50.
FR-7: Dropdown presentation in any host layout — popup listbox attached to the input (not a modal), fully visible inside `overflow: hidden` ancestors, height-bounded with internal scrolling, no pagination.
FR-8: Loading, empty, and error feedback — distinct visual states for in-flight fetch, zero results, and failed request, each with human-readable text.
FR-9: Dedicated rate-limit state — GitHub 403 rate-limit responses render a distinct, readable state explaining the throttle and when retrying makes sense (retry-after/reset info when available).
FR-10: Arrow-key navigation — Up/Down move the Highlighted item; highlight visually evident and kept scrolled into view.
FR-11: Enter opens the target in a new tab — Enter on the Highlighted item opens its GitHub page in a new tab; the host page retains state; mouse click behaves identically.
FR-12: Escape closes the Dropdown — Query text remains; focus stays on the input.
FR-13: Built from scratch — no autocomplete/combobox library or component library anywhere in the dependency manifest.
FR-14: Data-source-agnostic component — data source, item rendering, item identity, and selection handling are injected by the host; no GitHub knowledge in the generic component.
FR-15: Self-contained styling with themeable tokens — scoped styles that neither leak nor depend on the host; theming exclusively via documented `--ac-*` custom properties with fallbacks.
FR-16: Zero-config GitHub search with optional token — unauthenticated by default; optional token (config-supplied, never committed) authenticates requests to raise rate limits.
FR-17: Demo application proving both usage modes — a runnable demo hosts the GitHub instance and a second, differently-sourced, differently-themed instance; one documented command starts it.
FR-18: Meaningful automated test suite — three layers (unit: pure logic; integration: RTL + MSW component behavior; thin e2e: new-tab, focus, axe) with every FR-1..12 behavior exercised by at least one automated test.
FR-19: Continuous integration and public delivery — public repository, CI running the suite on every push, README enabling install/run/test without prior context.

### NonFunctional Requirements

NFR-1: Accessibility (WCAG 2.1 AA target) — WAI-ARIA combobox pattern, full keyboard operability, visible focus indicator, AA contrast in the default theme; verified by an automated axe scan in e2e.
NFR-2: Responsiveness under typing — UI never blocks on network activity; exactly one relevant request per settled Query; no stale-response flicker.
NFR-3: Resilience to API failure — every GitHub failure mode degrades to a clear user-facing state; never broken/blank; recovers on the next Query.
NFR-4: Type safety and code quality — TypeScript strict across the codebase; the component's public surface (props, tokens) fully typed and documented.
NFR-5: Isolation — the reusable component has no host-app dependencies, no global style side effects, no GitHub-specific code.
NFR-6: Secret hygiene — no token/credential ever committed; token supply documented and optional.

### Additional Requirements

(From architecture.md — no starter template beyond the standard Vite scaffold is specified; the
project is initialized from scratch with the Vite react-ts template.)

- AR-1: Vite 7 + React 19 + TypeScript strict, pnpm (lockfile committed), Node 22 (`engines` + `.nvmrc`); single package, no monorepo, no Next.js, no state library.
- AR-2: Three-layer architecture with a one-way import rule — `src/lib/autocomplete/` (reusable deliverable) ← `src/features/github-search/` (adapter) ← demo/app; enforced by an ESLint `no-restricted-imports` rule scoped to `src/lib/**`.
- AR-3: `useAutocomplete<T>` headless hook owns all behavior — debounce (default 300 ms), threshold (default 3), `idle|loading|success|empty|error` discriminated-union state machine, keyboard-navigation state (clamp at ends, no wrap), per-fetch `AbortController` with `AbortError` swallowed.
- AR-4: `Autocomplete<T>` generic presentational component with injected contract: `fetchSuggestions(query, signal)`, `renderItem(item, { highlighted })`, `getItemKey(item)`, `onSelect(item)`, plus optional `placeholder`/`label`/state-message overrides/`minChars`/`debounceMs`.
- AR-5: CSS Modules only in `lib/`; every themeable property reads a documented `--ac-*` custom property with a baked-in fallback from `docs/design/`; no Tailwind/framework/global styles in the lib layer.
- AR-6: WAI-ARIA 1.2 combobox with `aria-activedescendant` (focus never leaves the input), id-based relationships, visually-hidden `aria-live="polite"` status region; a11y checklist in §3.5.
- AR-7: Dropdown renders via React portal to `document.body`, positioned to the input rect (re-measured on resize/scroll), width-matched, `max-height` + internal scroll + `scrollIntoView({ block: 'nearest' })`; documented fallback to in-place absolute positioning if the portal proves too costly.
- AR-8: Adapter data flow — two parallel fetches sharing the caller's `AbortSignal`, map to a `GithubResult` union, `localeCompare` sort with sensitivity `'base'`, trim to 50, all-or-nothing via `Promise.all`.
- AR-9: Error modeling — `GithubSearchError` discriminated union (`network` | `http` | `rate-limit` with `retryAfterSeconds?`), mapped in exactly one place (`githubClient.ts`); optional token via adapter prop or `import.meta.env.VITE_GITHUB_TOKEN`, sent as `Authorization: Bearer`.
- AR-10: Selection — `window.open(item.html_url, '_blank', 'noopener,noreferrer')`; Enter and click identical.
- AR-11: Demo — two instances: GitHub adapter + a static country list with different `renderItem`, different `onSelect` (readout, not a tab), and visibly different `--ac-*` theming.
- AR-12: Testing — Vitest + RTL + jsdom + MSW (node server mode, never fetch stubs), co-located `*.test.ts(x)`, fake timers for debounce; thin Playwright + `@axe-core/playwright` in `/e2e` with the API mocked via `page.route`; level assignment fixed in architecture §3.6.
- AR-13: ESLint 9 flat config + typescript-eslint + react-hooks + the AR-2 boundary rule; Prettier; GitHub Actions on every push/PR: lint → typecheck → `vitest run` → `playwright test`, Node 22 + pnpm.
- AR-14: Deployment — static build to GitHub Pages via `actions/deploy-pages` on `master`; Vite `base` set via env in the Pages workflow only.

### UX Design Requirements

No UX design document exists at planning time. The visual ground truth will live in
`docs/design/` and is expected to exist by implementation time; its token values map 1:1 to the
`--ac-*` custom properties (AR-5) consumed by Story 0.3 and Epic 1. `[ASSUMPTION: headless run —
the design phase delivers `docs/design/` before Story 0.3 is implemented; Story 0.3 states this
prerequisite explicitly.]` Accessibility-relevant visual requirements (visible focus ring, AA
contrast) are carried by NFR-1 and AR-6 and are asserted in Epic 1 and Epic 3 stories.

### FR Coverage Map

- FR-1: Epic 1 — threshold in `useAutocomplete` (1.1); integration-tested (0.2 harness)
- FR-2: Epic 1 — debounce in `useAutocomplete` (1.1)
- FR-3: Epic 1 — AbortController cancellation in `useAutocomplete` (1.1)
- FR-4: Epic 2 — parallel fetches (2.1); all-or-nothing composition (2.2)
- FR-5: Epic 2 — merge + case-insensitive sort on bare repo name / login (2.2)
- FR-6: Epic 2 — `per_page=50` (2.1); combined trim to 50 (2.2)
- FR-7: Epic 1 — portal dropdown, bounded + scrollable (1.3); e2e clipping check (3.2)
- FR-8: Epic 1 — state machine (1.1) + state rendering (1.3)
- FR-9: Epic 2 — 403 mapping (2.1) + rate-limit message rendering (2.3)
- FR-10: Epic 1 — arrow-key navigation (1.2, 1.3)
- FR-11: Epic 2 — new-tab `onSelect` (2.3); e2e new-page verification (3.2)
- FR-12: Epic 1 — Escape behavior (1.2, 1.3)
- FR-13: Epic 0 — scaffold with no autocomplete/component library (0.1); holds for all later stories
- FR-14: Epic 1 — injected contract (1.3); proven by second instance (3.1)
- FR-15: Epic 0 — token map (0.3); Epic 1 — scoped CSS Modules + fallbacks (1.3); proven by theming (3.1)
- FR-16: Epic 2 — optional token (2.1)
- FR-17: Epic 3 — demo page with both instances (3.1)
- FR-18: Epic 0 — harnesses (0.2); tests shipped in every story; e2e layer (3.2)
- FR-19: Epic 0 — CI (0.2); Epic 3 — README + public delivery + Pages deploy (3.3)

NFR coverage: NFR-1 → 1.2, 1.3, 3.2; NFR-2 → 1.1; NFR-3 → 2.1, 2.3; NFR-4 → 0.1 and every
story's typed public surface; NFR-5 → 0.1 (boundary rule), 1.3, 3.1; NFR-6 → 0.1 (gitignore +
`.env.example`), 2.1, 3.3.

All 19 FRs and all 6 NFRs are covered by at least one story. Epic 0 is a thin enabler (FR-13,
and the FR-18/FR-19 infrastructure halves); every other epic delivers directly evaluator-visible
value.

## Epic List

### Epic 0: Foundation
A running, verifiable skeleton: Vite + React 19 + TS strict scaffold on pnpm/Node 22, ESLint 9
flat + Prettier + the lib-boundary rule, Vitest/RTL/jsdom/MSW and Playwright harnesses, GitHub
Actions CI, and the `--ac-*` design-token map from `docs/design/`. Pure enabler — every later
story builds on green CI and real tokens.
**FRs covered:** FR-13; infrastructure halves of FR-18, FR-19. (AR-1, AR-2, AR-5 tokens, AR-12
harness, AR-13; NFR-4, NFR-5 enforcement, NFR-6 hygiene.)

### Epic 1: Core Autocomplete (`src/lib/autocomplete/`)
The reusable deliverable: the `useAutocomplete<T>` headless hook (state machine, debounce,
threshold, cancellation), keyboard navigation + ARIA combobox semantics, and the generic
`Autocomplete<T>` presentational component with CSS Modules, token theming, and the portal
dropdown. Zero GitHub knowledge. **Independent of Epic 2** — runs in parallel after Epic 0.
**FRs covered:** FR-1, FR-2, FR-3, FR-7, FR-8, FR-10, FR-11 (generic selection path), FR-12,
FR-14, FR-15. (AR-3..AR-7; NFR-1, NFR-2, NFR-4, NFR-5.)

### Epic 2: GitHub Adapter (`src/features/github-search/`)
The GitHub specialization: API client with parallel fetches, typed error union incl. the
rate-limit variant and optional token; pure merge/sort/cap module; and the wired
`GithubAutocomplete` with avatar/icon rendering and open-in-new-tab selection. Stories 2.1–2.2
depend only on Epic 0 and **run in parallel with Epic 1**; the layers meet in 2.3, which
consumes Epic 1's public contract.
**FRs covered:** FR-4, FR-5, FR-6, FR-9, FR-11 (GitHub target), FR-16. (AR-8..AR-10; NFR-3,
NFR-6.)

### Epic 3: Demo, E2E & Launch
The evaluator's entry point: the demo page proving reuse and theming with a second (country
list) instance, the thin Playwright + axe e2e layer, the root README, and the GitHub Pages
deployment. Depends on Epics 1–2.
**FRs covered:** FR-17, FR-18 (e2e layer), FR-19; final proof of FR-7, FR-11, FR-14, FR-15.
(AR-11, AR-12 e2e, AR-14; NFR-1 verification.)

---

## Epic 0: Foundation

A running, verifiable skeleton so every later story builds on green CI, enforced boundaries, and
real design tokens rather than scaffolding. Docs folder: `docs/features/epic-0-foundation/`.

### Story 0.1: Project scaffold, linting, and boundary rule

As a developer,
I want a Vite + React 19 + TypeScript strict project with linting, formatting, and the
lib-boundary rule in place,
So that all feature work starts type-safe, consistently formatted, and mechanically prevented
from violating the reusable-component isolation (AR-1, AR-2, AR-13, FR-13, NFR-4, NFR-5).

**Acceptance Criteria:**

**Given** a clean repository
**When** the project is scaffolded with the Vite react-ts template on pnpm
**Then** `tsconfig` has `strict: true`, `pnpm build` succeeds, and Node 22 is pinned via
  `engines` and `.nvmrc` (AR-1)
**And** `pnpm-lock.yaml` is committed and the dependency manifest contains no
  autocomplete/combobox/component-library package (FR-13) and no state-management library
**And** ESLint 9 flat config (`eslint.config.js`) with typescript-eslint and react-hooks passes
  via `pnpm lint`, and Prettier is configured with no style rules in ESLint (AR-13)
**And** a `no-restricted-imports` rule scoped to `src/lib/**` forbids imports from
  `src/features/**` and app/demo files, verified by a deliberately failing example being caught
  (AR-2, NFR-5)
**And** the directory skeleton exists (`src/lib/autocomplete/`, `src/features/github-search/`,
  `src/demo/`, `e2e/`) per architecture §3.2
**And** `.env.example` documents `VITE_GITHUB_TOKEN=` with no real value, and `.env.local`,
  `_bmad/`, `.claude/` are gitignored (NFR-6).

**Technical notes:** Follow architecture §3.1 naming and §3.2 layout exactly. Keep the default
Vite `App.tsx` as a placeholder stage; no component code yet.
**Dependencies:** none (first story).
**Documentation deliverables:** `docs/features/epic-0-foundation/0-1-project-scaffold-and-linting/README.md`. No MANUAL_TESTING.md (tooling only).

### Story 0.2: Test harnesses and CI pipeline

As a developer,
I want working unit/integration and e2e test harnesses wired into CI,
So that every subsequent story can ship tests as part of its Definition of Done and CI proves
the suite green on every push (AR-12, AR-13, FR-18 infrastructure, FR-19 CI half).

**Acceptance Criteria:**

**Given** the scaffolded project (0.1)
**When** Vitest + React Testing Library + jsdom are configured with MSW in node server mode
  (setup file starting/stopping the server; fetch stubs forbidden)
**Then** `pnpm test` (non-watch, CI-safe) runs a trivial RTL render test and an MSW-intercepted
  fetch test, both passing (AR-12)
**And** Playwright is configured in `/e2e` with a trivial spec that boots the Vite dev/preview
  server and passes via `pnpm test:e2e`, with `@axe-core/playwright` installed
**And** fake-timer usage is proven by one example debounce-style test (pattern for FR-2 tests)
**And** a GitHub Actions workflow on every push/PR to `master` runs lint → typecheck
  (`tsc --noEmit`) → `vitest run` → `playwright test` on Node 22 + pnpm with Playwright browsers
  cached, and fails if any stage fails (AR-13, FR-19).

**Technical notes:** Co-located `*.test.ts(x)` convention (architecture §3.1); e2e stays
top-level outside `src/`. The example tests are placeholders to be replaced by real ones — keep
them minimal.
**Dependencies:** 0.1.
**Documentation deliverables:** `docs/features/epic-0-foundation/0-2-test-harness-and-ci/README.md`. No MANUAL_TESTING.md (tooling only).

### Story 0.3: Design tokens as `--ac-*` custom properties

As an integrating developer,
I want the component's themeable surface defined as documented `--ac-*` custom properties with
baked-in fallback values from the design phase,
So that Epic 1 styles against a stable, documented token contract and hosts can theme without
piercing selectors (AR-5, FR-15 foundation, NFR-1 contrast/focus values).

**Acceptance Criteria:**

**Given** the design deliverables in `docs/design/` (prerequisite — see note)
**When** the token map is created in `src/lib/autocomplete/` (a tokens reference consumed by
  `Autocomplete.module.css` in Epic 1)
**Then** every themeable property has a documented `--ac-<area>-<property>` name and a fallback
  value taken 1:1 from `docs/design/` (colors, spacing, radius, typography, focus ring) per
  architecture §3.1
**And** the default values meet WCAG AA contrast and include a visible focus-ring token (NFR-1)
**And** the token list with names, purposes, and fallbacks is documented (feeds the lib README
  section in 3.3)
**And** no global styles are introduced — tokens are consumed via `var(--ac-x, fallback)` inside
  CSS Modules only (NFR-5).

**Technical notes:** `[ASSUMPTION: docs/design/ exists by implementation time (design phase runs
before this story); if values are still missing, this story blocks rather than inventing
tokens.]` Token *documentation* format: a table in the story docs plus TSDoc/comments next to
the CSS.
**Dependencies:** 0.1; `docs/design/` content.
**Documentation deliverables:** `docs/features/epic-0-foundation/0-3-design-tokens/README.md`. No MANUAL_TESTING.md (no rendered UI yet).

---

## Epic 1: Core Autocomplete (`src/lib/autocomplete/`)

The reusable deliverable: headless behavior, keyboard + ARIA semantics, and the generic
presentational component. Zero GitHub knowledge, zero app imports. Runs in parallel with Epic 2
(stories 2.1–2.2) after Epic 0. Docs folder: `docs/features/epic-1-core-autocomplete/`.

### Story 1.1: `useAutocomplete<T>` hook — state machine, debounce, threshold, cancellation

As an integrating developer,
I want a generic headless hook that owns the fetch lifecycle and dropdown state,
So that any UI can get threshold, debounce, cancellation, and unambiguous states for free with
any data source (FR-1, FR-2, FR-3, FR-8 state model, FR-14; AR-3, §3.4; NFR-2).

**Acceptance Criteria:**

**Given** the hook configured with a `fetchSuggestions(query, signal)` function, default
  `minChars: 3`, default `debounceMs: 300` (both overridable)
**When** the query is shorter than 3 characters
**Then** no request is issued, the state is `idle`/closed, and shrinking from 3 to 2 characters
  closes the dropdown and aborts any in-flight request (FR-1)
**And when** "react" is typed quickly, exactly one request fires (for "react") after ~300 ms of
  inactivity, verified with fake timers (FR-2)
**And when** the query changes while a request is in flight, the previous `AbortController` is
  aborted, the late response is discarded, and `AbortError` is swallowed — never surfaced as an
  error state (FR-3, NFR-2); unmount also aborts
**And** the hook exposes `status: 'idle'|'loading'|'success'|'empty'|'error'` as a discriminated
  union — the single source of truth (never derived from `items.length`) — with `empty` distinct
  from `success`, and `error` carrying `{ message: string }` (FR-8, §3.4)
**And** the hook returns exactly one `state` object and one `handlers` object per §3.4, fully
  typed with TSDoc on the public surface (NFR-4)
**And** unit/integration tests (Vitest, fake timers, MSW where HTTP is involved) cover
  threshold, debounce, cancellation/stale-discard, and every status transition (FR-18).

**Technical notes:** `src/lib/autocomplete/useAutocomplete.ts` + `types.ts`. Keyboard state
fields exist in the state shape but their reducers land in 1.2. Test-first — this is the logic
core.
**Dependencies:** 0.1, 0.2.
**Documentation deliverables:** `docs/features/epic-1-core-autocomplete/1-1-useautocomplete-hook/README.md`. No MANUAL_TESTING.md (headless logic, unit/integration-tested).

### Story 1.2: Keyboard navigation and ARIA combobox wiring in the hook

As a keyboard user,
I want arrow-key navigation, Enter selection, and Escape handled by the hook with correct ARIA
plumbing,
So that any UI rendered over the hook is fully keyboard-operable and screen-reader-correct by
construction (FR-10, FR-11 selection path, FR-12; AR-3, AR-6, §3.5; NFR-1).

**Acceptance Criteria:**

**Given** an open dropdown with N suggestions (rendered via a minimal test harness component)
**When** ArrowDown is pressed from the input
**Then** the first suggestion is highlighted; subsequent presses advance; ArrowUp moves back;
  the highlight **clamps at both ends — no wrap** (FR-10, AR-3)
**And when** Enter is pressed on a highlighted item, `onSelect(item)` is called with that item;
  item click and hover-to-highlight route through the same handlers (FR-11 generic path)
**And when** Escape is pressed, the dropdown closes, the query text remains, and focus stays on
  the input (FR-12)
**And** the hook exposes ARIA prop getters (input, listbox, option-by-index) producing the §3.5
  checklist: `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`,
  `aria-activedescendant` pointing at the highlighted option id (derived from `getItemKey`),
  `role="listbox"`/`role="option"`, `aria-selected` on the highlighted option (AR-6, NFR-1)
**And** all key logic lives in `handlers.onKeyDown` — consuming components add no key logic
  (§3.4)
**And** RTL integration tests assert the navigation/clamping behavior, Enter/click/Escape paths,
  and the exact ARIA attribute wiring (FR-18).

**Technical notes:** Focus never leaves the input (activedescendant technique, no roving focus).
The test harness component is test-only; the shipped generic component arrives in 1.3.
**Dependencies:** 1.1.
**Documentation deliverables:** `docs/features/epic-1-core-autocomplete/1-2-keyboard-navigation-and-aria/README.md`. No MANUAL_TESTING.md (no shipped UI until 1.3; behavior fully covered by RTL tests).

### Story 1.3: `Autocomplete<T>` presentational component with CSS Modules and portal dropdown

As an integrating developer,
I want a generic, self-contained, themeable Autocomplete component over the hook,
So that I can drop it into any host with any data source and get correct rendering, states, and
accessibility everywhere — including clipping layouts (FR-7, FR-8 rendering, FR-14, FR-15;
AR-4, AR-5, AR-6, AR-7; NFR-1, NFR-5).

**Acceptance Criteria:**

**Given** the component's public props exactly per AR-4 — `fetchSuggestions`, `renderItem`,
  `getItemKey`, `onSelect`, optional `placeholder`/`label`/state-message
  overrides/`minChars`/`debounceMs` — with no GitHub types anywhere (FR-14, NFR-4 TSDoc)
**When** the component renders in an unstyled host
**Then** it is fully styled from `Autocomplete.module.css` using `var(--ac-*, fallback)` tokens
  (0.3) with no global styles and no style leakage in or out (FR-15, NFR-5)
**And** overriding a documented `--ac-*` token on an ancestor changes the corresponding visual
  property with no host-side selector overrides (FR-15)
**And** the dropdown renders through a React portal to `document.body`, positioned to the input
  rect (re-measured on open/resize/scroll), width-matched, `max-height`-bounded with internal
  scrolling, and the highlighted item is kept in view via
  `scrollIntoView({ block: 'nearest' })` (FR-7, FR-10, AR-7)
**And** `loading`, `empty`, and `error` statuses each render distinct visual feedback with
  human-readable, override-able texts, and a visually hidden `role="status"`/
  `aria-live="polite"` region announces loading, result count, empty, and error (FR-8, AR-6)
**And** the full §3.5 ARIA checklist holds in the rendered DOM (real `<label>` or `aria-label`,
  visible token-controlled focus ring) (NFR-1)
**And** RTL + MSW integration tests cover: all states rendered from real HTTP outcomes, token
  fallback styling presence, keyboard flows end-to-end through the rendered component, and ARIA
  wiring; a fake static data source proves data-source agnosticism (FR-14, FR-18).

**Technical notes:** `Autocomplete.tsx` + `Autocomplete.module.css`. Portal fallback to in-place
absolute positioning is pre-authorized by AR-7 only if portal positioning proves too costly —
record any such change in architecture.md first. Component adds no key logic (§3.4).
**Dependencies:** 1.1, 1.2, 0.3.
**Documentation deliverables:** `docs/features/epic-1-core-autocomplete/1-3-autocomplete-component/README.md` and `MANUAL_TESTING.md` (visible UI: typing, states, keyboard navigation, focus ring, theming override).

---

## Epic 2: GitHub Adapter (`src/features/github-search/`)

The GitHub specialization over the generic component. Stories 2.1 and 2.2 depend only on Epic 0
and run in parallel with Epic 1; story 2.3 consumes Epic 1's public contract. Docs folder:
`docs/features/epic-2-github-adapter/`.

### Story 2.1: GitHub API client with typed errors and optional token

As an end user,
I want the app to query GitHub users and repositories reliably, with clear typed failures and an
optional token,
So that searches work with zero setup and every failure mode — especially rate limiting — is
distinguishable and actionable (FR-4 fetches, FR-6 per-request cap, FR-9 mapping, FR-16;
AR-8 steps 1, AR-9, §3.3; NFR-3, NFR-6).

**Acceptance Criteria:**

**Given** a qualifying query and an `AbortSignal`
**When** the client is invoked
**Then** it fires exactly two parallel requests — `GET /search/users?q={query}&per_page=50` and
  `GET /search/repositories?q={query}&per_page=50` — both sharing the caller's signal (FR-4,
  FR-6, AR-8)
**And** every failure maps in this one module to the exact §3.3 union: `{ kind: 'network' }` for
  thrown fetches, `{ kind: 'http'; status }` for non-2xx non-rate-limit, and
  `{ kind: 'rate-limit'; retryAfterSeconds? }` for 403 with rate-limit headers
  (`x-ratelimit-remaining: 0` or `retry-after`), carrying the reset time when derivable from
  `retry-after` or `x-ratelimit-reset` (FR-9, AR-9, NFR-3)
**And** `AbortError` is never mapped to an error (AR-3 contract)
**And** with no token configured, requests are unauthenticated and succeed against the (mocked)
  public API; with a token supplied via prop or `import.meta.env.VITE_GITHUB_TOKEN`, requests
  carry `Authorization: Bearer <token>`; no token value exists anywhere in the repository
  (FR-16, NFR-6)
**And** unit tests (plus MSW where responses are exercised) cover: parallel request shape,
  each error-union variant incl. 403→`rate-limit` with and without retry headers, abort
  pass-through, and both token modes (FR-18).

**Technical notes:** `githubClient.ts` + `types.ts` (`GithubResult` union, `GithubSearchError`).
Response mapping to the `GithubResult` union (login/name, `html_url`, avatar) lives here;
merge/sort/cap is 2.2. Test-first.
**Dependencies:** 0.1, 0.2. Independent of Epic 1.
**Documentation deliverables:** `docs/features/epic-2-github-adapter/2-1-github-api-client/README.md`. No MANUAL_TESTING.md (network/logic layer, fully machine-tested).

### Story 2.2: Merge, sort, cap — the combined-results contract

As an end user,
I want users and repositories combined into one alphabetical list of at most 50 items — or a
single clear error,
So that results are predictable and ordered exactly as the brief requires (FR-4 all-or-nothing,
FR-5, FR-6; AR-8 steps 2–4).

**Acceptance Criteria:**

**Given** successful responses from both searches
**When** the pure merge module runs
**Then** users and repositories are merged into a single list sorted case-insensitively via
  `localeCompare` with sensitivity `'base'`, keyed on the **user login** and the **bare
  repository name** (never `owner/name`, even though display may show `owner/name`) (FR-5)
**And** the combined list is trimmed to at most 50 items — given 50 users + 50 repositories, the
  alphabetically first 50 of the merged set (FR-6)
**And when** either underlying search fails, the adapter's composed
  `fetchSuggestions(query, signal)` rejects with the single typed `GithubSearchError` — full
  error state, never partial results (`Promise.all` semantics) (FR-4)
**And** the composed `fetchSuggestions` satisfies the AR-4 contract signature, ready for any
  consumer of the generic component
**And** unit tests cover: mixed-kind ordering incl. case differences and locale-sensitive
  comparisons, bare-name vs `owner/name` keying, the exact-50 trim boundary, empty inputs, and
  the partial-failure rejection (FR-18).

**Technical notes:** `mergeResults.ts` — pure and dependency-free; composition of client +
merge into `fetchSuggestions` also lands here. Test-first.
**Dependencies:** 2.1. Independent of Epic 1.
**Documentation deliverables:** `docs/features/epic-2-github-adapter/2-2-merge-sort-results/README.md`. No MANUAL_TESTING.md (pure logic).

### Story 2.3: `GithubAutocomplete` — wired instance with new-tab selection and rate-limit state

As an end user,
I want to search GitHub from one input and open the selected user or repository in a new tab,
with a clear message when GitHub throttles me,
So that I can find and jump to any user/repo by keyboard alone and always understand failures
(FR-9 rendering, FR-11; AR-9 message mapping, AR-10; NFR-3).

**Acceptance Criteria:**

**Given** the generic `Autocomplete` (1.3) and the composed `fetchSuggestions` (2.2)
**When** `GithubAutocomplete` renders results
**Then** `renderItem` visually distinguishes users (avatar + login) from repositories (repo
  icon + name, display may show `owner/name`), with the highlighted state visible (FR-5 display
  note)
**And when** Enter is pressed on a highlighted item or it is clicked, `onSelect` calls
  `window.open(item.html_url, '_blank', 'noopener,noreferrer')` — identically for both input
  methods — and the host page retains its state (FR-11, AR-10)
**And when** the fetch rejects with `kind: 'rate-limit'`, the dropdown shows a rate-limit
  message visually and textually distinct from the generic error, including a retry hint from
  `retryAfterSeconds` when available; `network` and `http` variants map to their own readable
  messages via an exhaustive `switch` with a `never` default (FR-9, §3.3, NFR-3)
**And** the generic lib layer receives only `{ status: 'error'; message }`-level information —
  it never learns what a rate limit is (NFR-5)
**And** RTL + MSW integration tests cover: mixed rendering, a mocked 403 rate-limit response
  rendering the distinct state, generic error rendering, and a `window.open` spy asserting the
  exact arguments for both Enter and click (FR-18).

**Technical notes:** `GithubAutocomplete.tsx`. This is where Epics 1 and 2 meet — the only Epic
2 story that depends on Epic 1.
**Dependencies:** 2.2, 1.3.
**Documentation deliverables:** `docs/features/epic-2-github-adapter/2-3-github-autocomplete/README.md` and `MANUAL_TESTING.md` (visible UI: search, avatar/icon distinction, Enter/click new tab, rate-limit state).

---

## Epic 3: Demo, E2E & Launch

The evaluator's entry point: the demo proving reuse and theming, the thin browser-real test
layer, and public delivery. Docs folder: `docs/features/epic-3-demo-e2e-launch/`.

### Story 3.1: Demo page with the GitHub instance and a second, differently-themed data source

As an evaluator,
I want a demo page showing the GitHub autocomplete next to a second instance with a different
data source and visibly different theme,
So that reusability and theming are proven by running code, not claims (FR-17, FR-14 proof,
FR-15 proof; AR-11; SM-3).

**Acceptance Criteria:**

**Given** a clean clone
**When** the single documented command (`pnpm dev`) starts the demo
**Then** the page hosts the `GithubAutocomplete` instance (2.3), fully usable (FR-17)
**And** a second `Autocomplete` instance is backed by a static country list filtered
  client-side through the same `fetchSuggestions(query, signal)` contract, with different
  `renderItem` and an `onSelect` that fills a visible "selected" readout instead of opening a
  tab (FR-14, AR-11)
**And** the second instance is visibly differently themed exclusively via `--ac-*` overrides on
  an ancestor — no component changes, no selector piercing (FR-15, SM-3)
**And** the demo (`src/demo/` + `App.tsx`) imports from both layers while nothing imports from
  it, and the lib layer compiles without the demo/adapter (NFR-5, AR-2)
**And** an integration test proves the country-list instance works end-to-end against the
  unchanged generic component (FR-14 consequence).

**Technical notes:** Demo styling is unconstrained (plain CSS fine). Countries chosen per AR-11's
recorded assumption. The demo is explicitly not part of the reusable deliverable.
**Dependencies:** 1.3, 2.3.
**Documentation deliverables:** `docs/features/epic-3-demo-e2e-launch/3-1-demo-page/README.md` and `MANUAL_TESTING.md` (both instances, theming difference, readout behavior).

### Story 3.2: Playwright e2e smoke and axe accessibility scan

As an evaluator,
I want a thin end-to-end layer verifying the browser-only realities,
So that new-tab opening, focus behavior, clipping-container rendering, and accessibility are
proven in a real browser with deterministic mocks (FR-7, FR-11, FR-18 e2e layer; AR-12; NFR-1).

**Acceptance Criteria:**

**Given** the demo app with the GitHub API mocked via `page.route` (the real API is never
  called)
**When** the e2e suite runs via `pnpm test:e2e`
**Then** typing a query, pressing ArrowDown, and pressing Enter opens the item's GitHub URL in a
  new tab, asserted via `context.waitForEvent('page')`, and the demo page retains its state
  (FR-11); a click-selection spec asserts the same
**And** focus remains on the input throughout keyboard navigation and after Escape (FR-12,
  AR-6)
**And** the autocomplete rendered inside an `overflow: hidden` host container shows its open
  dropdown fully visible, and with 50 mocked items the dropdown is height-bounded and scrollable
  (FR-7)
**And** an `@axe-core/playwright` scan on the demo page — closed, open-with-results, and error
  states — reports no violations (NFR-1)
**And** the suite runs green in CI and stays thin: only browser-real behaviors live here, per
  architecture §3.6 (FR-18, SM-C1).

**Technical notes:** Specs in `e2e/` (`newtab`, `a11y`, `clipping`, `focus`). Deterministic
fixtures for the mocked API responses, including a 50+50 payload for the cap/scroll spec.
**Dependencies:** 3.1 (runs against the demo page); harness from 0.2.
**Documentation deliverables:** `docs/features/epic-3-demo-e2e-launch/3-2-e2e-and-axe/README.md`. No MANUAL_TESTING.md (fully automated verification).

### Story 3.3: README and GitHub Pages deployment

As an evaluator,
I want a README that gets me from clone to running demo and green tests in minutes, plus a live
deployed demo,
So that I can verify every brief requirement without prior context or configuration (FR-19;
AR-14; SM-1, SM-2).

**Acceptance Criteria:**

**Given** all feature epics complete and CI green
**When** the root README is finalized
**Then** it documents install/run/test commands (each layer) that work verbatim on a clean
  clone, the component's public API (AR-4 props and the `--ac-*` token table from 0.3/1.3), and
  the optional `VITE_GITHUB_TOKEN` mechanism with an explicit never-commit note (FR-19, NFR-6)
**And** a decisions section records the documented interpretation of "limited to 50 per
  request", the partial-failure (all-or-nothing) behavior, the bare-name ordering key, and the
  portal approach (PRD §9, SM-1)
**And** a GitHub Pages workflow (`actions/deploy-pages`) deploys the Vite static build on
  `master`, with Vite `base` set to the repo path via env in the Pages workflow only — local dev
  keeps base `/` (AR-14)
**And** the deployed public URL serves the working demo (both instances) and is linked from the
  README
**And** CI status is green on the default branch of the public repository (FR-19).

**Technical notes:** `.github/workflows/pages.yml` separate from `ci.yml`. Vercel remains the
documented-but-not-chosen alternative (AR-14) — mention it in the decisions section only if
useful.
**Dependencies:** 3.1, 3.2 (documents and deploys the finished whole).
**Documentation deliverables:** `docs/features/epic-3-demo-e2e-launch/3-3-readme-and-deploy/README.md` and `MANUAL_TESTING.md` (visit the deployed URL, run a search, open a result — verifying the live artifact is a human check).

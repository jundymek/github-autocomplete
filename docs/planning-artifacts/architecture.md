---
title: github-autocomplete — Architecture Decision Document
status: final
created: 2026-07-09
updated: 2026-07-09
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
workflowType: 'architecture'
project_name: 'github-autocomplete'
user_name: 'Łukasz'
date: '2026-07-09'
inputDocuments:
  - docs/task.md
  - docs/planning-artifacts/prds/prd-github-autocomplete-2026-07-09/prd.md
  - CLAUDE.md
---

# Architecture Decision Document — github-autocomplete

This document records the technical decisions for **github-autocomplete**. It builds on the PRD
(FR-1..19, NFR-1..6) and the recruitment brief (`docs/task.md`). The PRD says *what*; this document
says *how*, precisely enough that AI agents implementing separate stories cannot drift apart.
Technology versions reflect current releases (July 2026).

## 1. Project Context

- **Type:** Client-side React component + demo sandbox. No backend, no SSR, no database. The
  GitHub Search API is called directly from the browser (PRD §5 Non-Goals: "No server component").
- **The deliverable is the architecture itself:** a genuinely reusable, self-contained autocomplete
  (FR-13..15, NFR-5) proven by a second, non-GitHub usage in the demo (FR-14, FR-17). Everything
  below is organized around one boundary: *generic component* vs. *GitHub adapter* vs. *demo stage*.
- **Primary drivers (from PRD NFRs):** accessibility WCAG 2.1 AA / ARIA combobox (NFR-1),
  responsiveness under typing — debounce + cancellation (NFR-2, FR-2/FR-3), resilience to API
  failure incl. a dedicated rate-limit state (NFR-3, FR-8/FR-9), TypeScript strict (NFR-4),
  isolation of the reusable layer (NFR-5), secret hygiene for the optional token (NFR-6).
- **Quality bar:** a three-layer test pyramid is a product requirement (FR-18), not process; CI and
  a public repo are deliverables (FR-19). Counter-metric SM-C1 forbids scope beyond the brief.

## 2. Core Architectural Decisions

### AR-1: Build tooling & runtime — Vite + React 19 + TypeScript strict (all latest stable), pnpm, Node 22

- **Decision:** Vite (react plugin) as the build tool and dev server; React 19; TypeScript in
  `strict` mode; package manager **pnpm** (lockfile committed); Node 22 (pinned via `engines` and
  `.nvmrc`). **Version policy (owner decision, 2026-07-09): every dependency is installed at its
  latest stable release at implementation time** (as of writing: Vite 8, TypeScript 7). If two
  latest releases are incompatible (e.g. a days-old TypeScript major unsupported by
  typescript-eslint or the Vite react plugin), hold back the *smallest possible* piece to the
  newest version that keeps the toolchain green, and record the holdback + reason in the story's
  Dev Agent Record and feature README. Single package — **no monorepo**. **No Next.js**, no
  state-management library, no component/autocomplete library of any kind (FR-13).
- **Rationale:** There is no SEO/SSR requirement (contrast with the previous project) — a static
  client-side sandbox is the lightest thing that satisfies the brief, and Vite gives instant dev
  feedback plus a first-class Vitest pairing (NFR-6 analogue: testability). A monorepo or package
  split would be over-engineering for a component whose reusability is proven architecturally, not
  via npm distribution (PRD §5). State libraries add nothing: all state is local to the hook.
- **Affects:** whole repo, every story, CI, deploy.

### AR-2: Three-layer component architecture with a one-way import rule

- **Decision:** Three layers, three directories, strict import direction:
  1. `src/lib/autocomplete/` — the **reusable deliverable**: headless hook + generic presentational
     component + its own CSS Modules. Zero GitHub knowledge, zero app imports.
  2. `src/features/github-search/` — the **GitHub adapter**: API client, error mapping, merge/sort,
     item rendering, selection behavior. Imports from `lib/`, never the reverse.
  3. `src/App.tsx` + demo files — the **sandbox stage**: wires both autocomplete instances, free
     styling. Imports from both layers; nothing imports from it.

  **Rule: `lib/` never imports from `features/` or app code.** Enforced by convention, code review,
  and an ESLint `no-restricted-imports` rule scoped to `src/lib/**` (paths matching `**/features/*`
  and app files forbidden).
- **Rationale:** This is the core of the deliverable (CLAUDE.md "Architecture boundary (critical)").
  "Reusable and self-contained" (brief, FR-14/FR-15, NFR-5) is only demonstrable if the boundary is
  physically visible in the tree and mechanically enforced. The adapter pattern also isolates every
  GitHub-specific FR (FR-4..6, FR-9, FR-16) so the generic layer stays testable with any fake
  data source.
- **Affects:** every story; the epic structure (core autocomplete → adapter → demo).

### AR-3: `useAutocomplete<T>` — headless hook owning all behavior

- **Decision:** All autocomplete *behavior* lives in one generic headless hook,
  `useAutocomplete<T>`, in `src/lib/autocomplete/`:
  - **Debounce:** ~300 ms after the last keystroke before fetching (FR-2); configurable with 300 as
    default.
  - **Threshold:** minimum 3 characters; below it, no fetch, dropdown closed, any in-flight request
    cancelled (FR-1); configurable with 3 as default.
  - **State machine:** `idle | loading | success | empty | error` as a discriminated union — the
    single source of truth for what the dropdown renders (FR-8). `empty` is distinct from `success`
    with items; `error` carries the typed error object (see AR-9).
  - **Keyboard navigation state:** the highlighted index and its reducers (ArrowDown/ArrowUp wrap
    or clamp — clamp at ends, no wrap; Enter selects; Escape closes without clearing input or focus)
    live in the hook (FR-10..12).
  - **Stale-request cancellation:** each fetch gets a fresh `AbortController`; a new qualifying
    query (or dropping below threshold, or unmount) aborts the previous one, and aborted responses
    are discarded — a late response can never overwrite newer state (FR-3, NFR-2). `AbortError` is
    swallowed, never surfaced as an error state.
- **Rationale:** A headless hook is the strongest reusability proof: behavior is testable without
  DOM styling concerns, and the presentational component (AR-4) stays thin. Putting keyboard state
  in the hook (not the component) means a future host could render its own UI over the same
  behavior. The state machine kills the classic autocomplete bug class (loading/empty/error
  ambiguity, stale flicker) by construction.
- **Affects:** Epic 1 (core), all integration tests, the adapter and demo which consume it.

### AR-4: `Autocomplete<T>` — generic presentational component with an injected contract

- **Decision:** A single generic component `Autocomplete<T>` renders input + dropdown over the
  hook. Its public props (the component's entire public surface, fully typed — NFR-4):
  - `fetchSuggestions(query: string, signal: AbortSignal) => Promise<T[]>` — the data source
    (FR-14); the signal is the hook's AbortController signal (AR-3).
  - `renderItem(item: T, state: { highlighted: boolean }) => ReactNode` — item rendering.
  - `getItemKey(item: T) => string` — item identity (React keys + `aria-activedescendant` ids).
  - `onSelect(item: T) => void` — selection behavior (Enter and click behave identically, PRD
    FR-11 assumption).
  - Optional: `placeholder`, `label`, state-message overrides (loading/empty/error texts), and
    `minChars` / `debounceMs` pass-throughs to the hook.
  - No GitHub types anywhere in this surface; `T` is unconstrained beyond what `getItemKey` needs.
- **Rationale:** This is the dependency-injection seam that makes FR-14 ("no GitHub-specific
  knowledge") checkable: the component compiles and renders in the demo against a static list with
  zero changes. Error/empty/loading rendering stays inside the component (self-contained visual
  feedback, FR-8) while their *texts* are overridable so the adapter can supply the rate-limit
  message (FR-9) without the component knowing what a rate limit is.
- **Affects:** Epic 1; the adapter (Epic 2) and demo (Epic 3) are pure consumers.

### AR-5: Styling — CSS Modules + `--ac-*` design tokens with baked-in fallbacks; no Tailwind in `lib/`

- **Decision:** Inside `src/lib/autocomplete/`, styling is exclusively CSS Modules, and every
  themeable property reads a documented CSS custom property with a fallback, e.g.
  `background: var(--ac-surface, #ffffff)`. **No Tailwind, no CSS framework, no global styles**
  in the lib layer. Token values (colors, spacing, radius, typography, focus ring) come from the
  design phase in `docs/design/` and map 1:1 to `--ac-*` names; the fallbacks baked into the
  component CSS are those same design values, so the component is fully styled in an unstyled host
  (FR-15). Hosts theme it by setting `--ac-*` on any ancestor — never by piercing selectors. Demo
  styling is unconstrained (plain CSS is fine).
- **Rationale:** CSS Modules give hard scoping (no leaks in or out — NFR-5) with zero runtime cost;
  custom properties are the only theming mechanism that crosses the module boundary intentionally
  and is trivially documentable. Tailwind in the lib would couple the component to a host build
  step, violating "self-contained".
- **Affects:** Epic 1 styles, the demo's second differently-themed instance (SM-3), `docs/design/`
  handoff.

### AR-6: Accessibility — WAI-ARIA combobox pattern with `aria-activedescendant`

- **Decision:** Implement the WAI-ARIA 1.2 combobox pattern (NFR-1): the input has
  `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, and
  `aria-activedescendant` pointing at the highlighted option; the popup is `role="listbox"` with
  `role="option"` children (ids derived from `getItemKey`), `aria-selected` on the highlighted
  option. Focus stays on the input at all times (activedescendant technique, not roving focus).
  Visible focus indicator and AA contrast in the default token values. State changes (loading,
  result count, errors) are announced via a visually-hidden `aria-live="polite"` status region.
- **Rationale:** The activedescendant variant keeps DOM focus in the input, which matches FR-12
  (Escape keeps focus) and makes keyboard tests deterministic. Automated verification via
  `@axe-core/playwright` in e2e (FR-18, NFR-1) plus explicit RTL assertions on the ARIA wiring.
- **Affects:** Epic 1 component, e2e suite, design tokens (focus/contrast).

### AR-7: Dropdown rendering — React portal to `document.body`, positioned to the input

- **Decision:** The dropdown renders through a React portal to `document.body`, absolutely
  positioned to the input's viewport rect (measured on open and on resize/scroll), width matched to
  the input, `max-height` bounded with internal scrolling and highlighted-item
  `scrollIntoView({ block: 'nearest' })` (FR-7, FR-10). ARIA relationships (AR-6) are id-based, so
  the portal does not break them. **Documented fallback:** if portal positioning proves too costly
  (scroll-sync jank or test flakiness), fall back to in-place `position: absolute` rendering inside
  a `position: relative` wrapper — accepting that extreme `overflow: hidden` hosts may clip — and
  record the change here.
- **Rationale:** FR-7 explicitly requires correct display inside `overflow: hidden` ancestors,
  which in-flow absolute positioning cannot guarantee; a portal is the standard escape hatch. The
  fallback is pre-authorized so an implementing agent doesn't invent a third approach under
  pressure.
- **Affects:** Epic 1 component + its integration tests; e2e clipping-container check.

### AR-8: GitHub adapter data flow — two parallel searches, merge, localeCompare sort, cap 50, all-or-nothing

- **Decision:** In `src/features/github-search/`, the adapter's `fetchSuggestions`:
  1. Fires **two parallel fetches** — `GET /search/users?q={query}&per_page=50` and
     `GET /search/repositories?q={query}&per_page=50` — sharing the caller's `AbortSignal` (FR-4,
     FR-6).
  2. On success of **both**: maps to a common `GithubResult` union, merges, sorts
     **case-insensitively via `localeCompare` with sensitivity `'base'`**, keyed on the **bare
     repository name** (not `owner/name`) and the **user login** (FR-5, PRD resolved question U3;
     display may show `owner/name`).
  3. Trims the combined list to **50 items** (FR-6, PRD D2/U1 interpretation).
  4. If **either** fetch fails: the whole call rejects with the typed error (AR-9) — **full error
     state, never partial results** (FR-4 consequence, PRD U2).
- **Rationale:** All decisions here are owner-resolved PRD requirements; the architecture's job is
  to pin them to one function with one contract so the merge/sort/limit logic is a pure, unit-
  testable module. `Promise.all` gives the all-or-nothing semantics for free.
- **Affects:** Epic 2; the unit-test layer (pure merge/sort/limit) and MSW integration tests.

### AR-9: Error modeling — discriminated union at the fetch boundary, dedicated rate-limit variant

- **Decision:** The adapter maps every failure mode to one discriminated union (see §3.3 for the
  exact shape): `network` (fetch threw), `http` (non-2xx other than rate limit), and `rate-limit`
  (HTTP 403 with rate-limit headers — `x-ratelimit-remaining: 0` or a `retry-after` header),
  carrying the reset time when available (`retry-after` seconds or `x-ratelimit-reset` epoch) so
  the UI can say when retrying makes sense (FR-9, UJ-2). The generic component renders `error`
  state text supplied by the adapter; raw responses never reach the UI (NFR-3). Aborts are not
  errors (AR-3). **Optional token** (FR-16, NFR-6): accepted via adapter prop or
  `import.meta.env.VITE_GITHUB_TOKEN`, sent as `Authorization: Bearer <token>` when present; never
  committed — `.env.local` is gitignored and README documents the mechanism.
- **Rationale:** A discriminated union makes the rate-limit state (a headline PRD feature)
  unrepresentable as a generic error by accident, and makes exhaustive handling compiler-checked
  (NFR-4). Centralizing mapping mirrors the proven pattern from the previous project's OMDb client.
- **Affects:** Epic 2 client + unit tests; rate-limit integration test with mocked 403.

### AR-10: Selection behavior — open `html_url` in a new tab with `noopener,noreferrer`

- **Decision:** The adapter's `onSelect` calls
  `window.open(item.html_url, '_blank', 'noopener,noreferrer')`. Enter on the highlighted item and
  mouse click behave identically (FR-11 + PRD assumption). The demo page retains its state (UJ-1).
- **Rationale:** `noopener,noreferrer` prevents reverse-tabnabbing from the opened page; funneling
  through `onSelect` keeps the generic component ignorant of URLs. Verified in e2e via Playwright's
  `context.waitForEvent('page')` (AR-12).
- **Affects:** Epic 2 adapter; e2e new-tab test.

### AR-11: Demo app — sandbox with a second, non-GitHub instance as the reuse proof

- **Decision:** `src/App.tsx` + demo files host two `Autocomplete` instances: (1) the GitHub
  adapter instance; (2) a second instance backed by **a static country list** filtered client-side
  `[ASSUMPTION: the owner's decision said "e.g. static country list"; countries are chosen as the
  concrete second source — trivially verifiable, zero extra dependencies]`, with different
  `renderItem`, different `onSelect` (e.g. fills a "selected" readout instead of opening a tab),
  and visibly different theming via `--ac-*` overrides (FR-14, FR-15, FR-17, SM-3). Demo styling is
  free (plain CSS). The demo is explicitly *not* part of the reusable deliverable.
- **Rationale:** The second instance is the executable proof of FR-14; making its data source
  synchronous-static keeps the demo dependency-free and demonstrates that `fetchSuggestions` works
  with any promise-returning function.
- **Affects:** Epic 3; e2e runs against this app.

### AR-12: Testing architecture — Vitest/RTL/MSW pyramid base, thin Playwright + axe top

- **Decision:**
  - **Unit + integration:** Vitest + React Testing Library + jsdom, with **MSW (node server
    mode)** intercepting HTTP at the network level (never fetch stubs). Tests are **co-located**
    with sources as `*.test.ts(x)`. Fake timers for debounce tests.
  - **E2E:** Playwright in `/e2e` (top-level, outside `src/`), **thin** by design: new-tab opening
    via `context.waitForEvent('page')`, focus management, clipping-container rendering, and an
    automated `@axe-core/playwright` scan. GitHub API mocked via `page.route` — e2e never hits the
    real API (deterministic, rate-limit-proof CI).
  - What belongs at which level is fixed in §3.6.
- **Rationale:** FR-18 requires exactly this three-layer shape. MSW at the network boundary tests
  the real fetch/abort/error-mapping code paths (fetch stubs would bypass AR-9). Keeping e2e thin
  honors SM-C1 and keeps CI fast; browser-only realities (real new tab, real focus, axe) are the
  only things that justify a browser.
- **Affects:** every story (tests are Definition of Done per CLAUDE.md); CI.

### AR-13: Lint, format & CI — ESLint 9 flat config + Prettier; GitHub Actions running lint, typecheck, unit, e2e

- **Decision:** ESLint 9 flat config (`eslint.config.js`) with typescript-eslint,
  react-hooks, and the AR-2 boundary rule; Prettier for formatting (no style rules in ESLint).
  GitHub Actions workflow on every push/PR to `master`: **lint → typecheck (`tsc --noEmit`) →
  unit/integration (`vitest run`) → e2e (`playwright test`, with browsers cached)**, Node 22 +
  pnpm via `pnpm/action-setup` and `actions/setup-node` cache (FR-19).
- **Rationale:** Green CI on the default branch is a stated PRD consequence; splitting typecheck
  from lint catches strict-mode errors even where tests don't reach. Flat config is the ESLint 9
  default — no legacy `.eslintrc`.
- **Affects:** repo config (Epic 0), every PR.

### AR-14: Deployment — static build to GitHub Pages via GitHub Actions (Vercel as documented alternative)

- **Decision:** Deploy the Vite static build to **GitHub Pages** using the official
  `actions/deploy-pages` flow in a workflow triggered on `master`. Vite `base` is set to the repo
  path for project pages `[ASSUMPTION: repo served under https://<user>.github.io/<repo>/; base
  configured via env in the Pages workflow so local dev keeps base '/']`. **Alternative:** Vercel
  (zero-config Vite support, nicer preview deploys) — documented but not chosen.
- **Rationale:** The deliverable is a *public GitHub repository* (FR-19); Pages keeps repo, CI, and
  live demo on one platform, one login for the evaluator, no third-party account or token. The app
  is a single static page with no server needs, so Pages' constraints (no SSR, no rewrites) cost
  nothing. Vercel remains a drop-in swap if preview-per-PR ever matters.
- **Affects:** Epic 3 (launch), README, the Pages workflow.

## 3. Implementation Patterns (consistency rules for all stories)

These rules exist because different agents implementing different stories could otherwise decide
them differently. Deviations require updating this document first.

### 3.1 Naming & file conventions

- Components: `PascalCase.tsx` (`Autocomplete.tsx`); hooks: `useCamelCase.ts`
  (`useAutocomplete.ts`); other modules: `camelCase.ts` (`githubClient.ts`, `mergeResults.ts`).
- CSS Modules: `<Component>.module.css`, class names camelCase.
- Tests co-located: `<file>.test.ts(x)`. E2E specs: `e2e/<flow>.spec.ts`.
- Types live next to their module; shared lib types in `src/lib/autocomplete/types.ts`. Prefer
  `type` aliases; `interface` only for extendable public props if needed.
- All exported public-surface types and props get TSDoc comments (NFR-4 "documented").
- CSS custom properties: `--ac-<area>-<property>` (e.g. `--ac-item-highlight-bg`), documented in
  the lib's README section with fallback values.

### 3.2 File layout

```
├── .github/workflows/        # ci.yml (lint/typecheck/unit/e2e), pages.yml (deploy)
├── e2e/                      # Playwright specs (thin): newtab, a11y/axe, clipping, focus
├── docs/                     # task.md, planning-artifacts/, design/, features/, implementation-artifacts/
├── src/
│   ├── lib/autocomplete/     # THE reusable deliverable (no GitHub, no app imports)
│   │   ├── index.ts                  # public API barrel — the only consumer import path
│   │   ├── useAutocomplete.ts        # headless hook: state machine, debounce, abort, keyboard
│   │   ├── Autocomplete.tsx          # generic presentational component
│   │   ├── Autocomplete.module.css   # scoped styles, all --ac-* tokens with fallbacks
│   │   ├── types.ts                  # public types: props, state union, status
│   │   └── *.test.ts(x)              # co-located unit/integration tests
│   ├── features/github-search/       # GitHub adapter (imports lib, never the reverse)
│   │   ├── githubClient.ts           # parallel fetches, token, error mapping (union)
│   │   ├── mergeResults.ts           # pure: map + merge + localeCompare sort + cap 50
│   │   ├── GithubAutocomplete.tsx    # wired instance: renderItem, onSelect (new tab)
│   │   ├── types.ts                  # GithubResult union, GithubSearchError union
│   │   └── *.test.ts(x)
│   ├── demo/                         # demo-only components; country/ groups the second data source (countries instance)
│   ├── App.tsx                       # sandbox stage: both instances, demo styling
│   └── main.tsx
├── eslint.config.js, vite.config.ts, vitest.config/setup (MSW), playwright.config.ts
└── package.json, pnpm-lock.yaml, .nvmrc, .env.example (VITE_GITHUB_TOKEN=, never a real value)
```

### 3.3 Error-type modeling (fixed shape)

```ts
// src/features/github-search/types.ts
export type GithubSearchError =
  | { kind: 'network' }                                  // fetch threw (offline, DNS, CORS)
  | { kind: 'http'; status: number }                     // non-2xx, not a rate limit
  | { kind: 'rate-limit'; retryAfterSeconds?: number };  // 403 + rate-limit headers
```

- Mapping happens in exactly one place (`githubClient.ts`). UI code switches exhaustively on
  `kind` (compiler-enforced via `never` default).
- `AbortError` is never mapped — cancellation is not an error (AR-3).
- The generic lib layer knows only `{ status: 'error'; message: string }`-level information; the
  adapter converts `GithubSearchError` to the user-facing message (incl. the retry hint for
  `rate-limit`).

### 3.4 Hook → component contract (single state object + handlers)

`useAutocomplete<T>` returns **one state object and one handlers object** — components never
receive loose booleans:

```ts
const { state, handlers } = useAutocomplete<T>(options);
// state: { query, status: 'idle'|'loading'|'success'|'empty'|'error',
//          items: T[], highlightedIndex: number | null, isOpen: boolean,
//          error?: { message: string } }
// handlers: { onInputChange, onKeyDown, onItemClick, onItemHover, close, /* ARIA prop getters */ }
```

- `status` is the only source of truth for what the dropdown shows; never derive loading from
  `items.length`.
- All keyboard handling goes through `handlers.onKeyDown`; the component adds no key logic of its
  own.
- The hook exposes ARIA prop getters (input props, listbox props, option props by index) so the
  component cannot mis-wire `aria-activedescendant`.

### 3.5 A11y attributes checklist (per AR-6 — every UI story asserts these)

- Input: `role="combobox"`, `aria-expanded`, `aria-controls={listboxId}`,
  `aria-autocomplete="list"`, `aria-activedescendant={highlightedOptionId | undefined}`, a real
  `<label>` or `aria-label`.
- Popup: `role="listbox"`, `id={listboxId}`; items `role="option"`, stable `id` from `getItemKey`,
  `aria-selected` on the highlighted one.
- Focus never leaves the input while navigating; visible focus ring (token-controlled).
- Status region: visually hidden, `role="status"` / `aria-live="polite"` announcing loading,
  "N results", empty, and error messages.
- Escape: closes popup, keeps query and focus (FR-12). Highlighted item kept in view via
  `scrollIntoView({ block: 'nearest' })`.

### 3.6 Testing conventions — what lives at which pyramid level

| Level | Tooling | Belongs here |
|---|---|---|
| Unit | Vitest | Pure logic: merge/sort/limit (AR-8), response→type mapping, error mapping incl. 403→`rate-limit` (AR-9), debounce/threshold reducers if extracted |
| Integration | Vitest + RTL + jsdom + MSW (node) | Rendered component behavior: threshold (FR-1), debounce with fake timers (FR-2), stale cancellation (FR-3), all five states incl. rate-limit rendering (FR-8/9), keyboard nav + Escape (FR-10/12), ARIA wiring (§3.5), second-data-source reuse |
| E2E (thin) | Playwright + `@axe-core/playwright`, API via `page.route` | Real-browser-only: Enter/click opens new tab (`context.waitForEvent('page')`, FR-11), focus management, rendering inside `overflow: hidden` host (FR-7), axe scan (NFR-1) |

- MSW mocks at the network boundary; **fetch stubs are forbidden**. E2E never calls the real
  GitHub API.
- Every FR-1..FR-12 behavior maps to at least one automated test (FR-18 consequence); story specs
  name their tests.

### 3.7 Git & story conventions (from CLAUDE.md — binding)

- One branch + PR per story: `story/<id>-<slug>` → `master`, squash-merge.
- Conventional Commits with the story id as scope: `feat(1.2): add keyboard navigation to
  useAutocomplete`. Short messages; **no `Co-Authored-By` or AI attribution ever**.
- All docs, comments, commits, PRs in English.
- Tests are part of Definition of Done; test-first where there is logic (hook state machine,
  merge/sort, API mapping).
- Every story ships its documentation folder under `docs/features/<epic-folder>/<id>-<slug>/`
  (README.md always; MANUAL_TESTING.md when a human verifies in a browser) — see CLAUDE.md for the
  templates.
- `_bmad/` and `.claude/` are local tooling, gitignored, never committed. No token or `.env.local`
  is ever committed (NFR-6).

## 4. Decision Impact & Implementation Sequence

1. **Epic 0 — Foundation:** Vite 7 + React 19 + TS strict scaffold (AR-1), ESLint 9 flat +
   Prettier + boundary rule (AR-2, AR-13), Vitest/RTL/MSW + Playwright wiring (AR-12), GitHub
   Actions CI (AR-13), design tokens from `docs/design/` → `--ac-*` map (AR-5).
2. **Epic 1 — Core autocomplete:** `useAutocomplete<T>` (AR-3), `Autocomplete<T>` (AR-4), CSS
   Modules + tokens (AR-5), ARIA combobox (AR-6), portal dropdown (AR-7). Depends on Epic 0.
3. **Epic 2 — GitHub adapter:** client with parallel fetch + token + error union (AR-8, AR-9),
   merge/sort/cap module (AR-8), wired GitHub instance with new-tab selection (AR-10). Depends on
   Epic 1's public contract only.
4. **Epic 3 — Demo, e2e, launch:** demo app with the second data source and theming proof (AR-11),
   thin e2e + axe (AR-12), README, GitHub Pages deploy (AR-14). Depends on Epics 1–2.

**Cross-component dependencies:** the `fetchSuggestions(query, signal)` contract (AR-4) is the
single seam between all layers — the adapter (AR-8) and the demo source (AR-11) both implement it,
and the hook's cancellation (AR-3) works through its `signal` parameter. The state-machine union
(AR-3) and error union (AR-9) are the two type contracts every test level asserts against.

## 5. Validation Against PRD

- FR-1..3 → AR-3; FR-4..6 → AR-8; FR-7 → AR-7; FR-8 → AR-3/AR-4; FR-9 → AR-9; FR-10..12 → AR-3/
  AR-6; FR-13 → AR-1; FR-14 → AR-4/AR-11; FR-15 → AR-5; FR-16 → AR-9; FR-17 → AR-11; FR-18 →
  AR-12; FR-19 → AR-13/AR-14.
- NFR-1 → AR-6/AR-12; NFR-2 → AR-3; NFR-3 → AR-9; NFR-4 → AR-1/§3.3/§3.4; NFR-5 → AR-2/AR-5;
  NFR-6 → AR-9/§3.7.
- No FR or NFR is unaddressed; no decision here exceeds the brief's scope (SM-C1).

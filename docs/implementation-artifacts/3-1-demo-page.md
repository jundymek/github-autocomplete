# Story 3.1: Demo page with the GitHub instance and a second, differently-themed data source

Status: Approved

## Story

As an evaluator,
I want a demo page showing the GitHub autocomplete next to a second instance with a different
data source and visibly different theme,
so that reusability and theming are proven by running code, not claims (FR-17, FR-14 proof,
FR-15 proof; AR-11; NFR-5; SM-3).

## Acceptance Criteria

1. **Single documented command starts the demo (FR-17, AR-11).** From a clean clone, `pnpm dev`
   starts the Vite dev server and serves the demo page; the README's run command is exactly this.
   The demo lives in `src/App.tsx` + `src/demo/` and is the app entry (rendered by `src/main.tsx`).
2. **Header reproduces `docs/design/demo-page.html` (AR-11, design ground truth).** The page renders,
   in React, the header from the mockup: an eyebrow (`code challenge · makers' den`), a headline
   (`One autocomplete, any data.` / `Here: github/*` with the `github/*` path in accent color), a
   lede paragraph describing the headless `useAutocomplete<T>` hook + generic `<Autocomplete<T>>`
   view + adapters, and a **contract strip** of four requirement facts: `min 3 characters`,
   `max 50 results, combined`, `sorted A→Z by name`, `↑↓ browse · ↵ opens a new tab`.
3. **Panel 01 hosts the working GitHub instance (FR-17).** A `<section class="panel">` titled
   "GitHub users & repositories" (badge `instance 01`) renders the real `GithubAutocomplete` (Story
   2.3), fully usable against the live GitHub Search API, unauthenticated.
4. **Panel 02 hosts a re-themed country picker via the same generic component (FR-14, AR-11, SM-3).**
   A second `<section class="panel panel--countries">` (badge `instance 02 · same core`) titled
   "Country picker" renders the generic `Autocomplete<Country>` (Story 1.3) — **not** a new
   component — wired to a static country adapter (AC 5). Its `renderItem` shows a flag + country
   name (+ a meta line like `Warsaw · PLN`), and its `onSelect` fills a visible "selected" **readout**
   in the demo (never opens a tab).
5. **Country adapter is a ~20-line static-list `fetchSuggestions` reusing the hook's threshold
   (FR-14 proof).** `src/demo/countries.ts` exports a static country list; `src/demo/countryAdapter.ts`
   exports `fetchSuggestions(query, signal): Promise<Country[]>` that filters the static list
   **client-side, case-insensitively** (substring match on country name) and resolves. It applies the
   **same 3-character threshold via the same `useAutocomplete` hook** — the adapter itself does **not**
   re-implement the threshold; the threshold reuse (default `minChars: 3`, same debounce) IS the reuse
   proof, so the country `Autocomplete` uses the hook's defaults exactly like the GitHub one. The
   adapter honors the `signal` (returns early / resolves without setting state if already aborted) even
   though the filter is synchronous.
6. **Second instance is visibly differently themed exclusively via `--ac-*` overrides (FR-15, SM-3).**
   The teal theme is applied by setting `--ac-color-accent: #0F766E` and
   `--ac-color-highlight: #E9F4F2` on the `.panel--countries` ancestor — **exact hexes from
   `design-tokens.md`** — with **no component changes and no selector piercing** into the lib's CSS
   Modules. Panel 01 keeps the default merge-purple accent (`#6639BA`, highlight `#F5F1FB`).
7. **Import direction holds; the lib compiles without the demo/adapter (NFR-5, AR-2).** The demo
   (`src/App.tsx` + `src/demo/`) imports from both layers (`src/lib/autocomplete/`,
   `src/features/github-search/`); **nothing** in `lib/` or `features/` imports from the demo. The
   `no-restricted-imports` boundary rule (Story 0.1) stays green and `src/lib/autocomplete/` type-checks
   in isolation.
8. **Demo styling is plain CSS outside the lib; responsive to mobile (AR-5, design ground truth).**
   All demo layout/typography lives in a plain CSS file (e.g. `src/demo/demo.css`), never in
   `src/lib/**`. It reproduces the mockup: `max-width: 1080px` centered wrap, a two-column
   `.stage` grid (`minmax(0,7fr)` / `minmax(0,5fr)`) that **collapses to a single column at
   `max-width: 860px`**, panels with border/radius/badge, and a footer.
9. **Demo fonts are loaded by the demo page only, never the lib (AR-5, NFR-5, design ground truth).**
   **Space Grotesk** (headline + section labels) and **JetBrains Mono** (eyebrow, contract strip,
   badges, footer) are loaded by the demo page (e.g. a `<link>` in `index.html` or a demo-scoped
   import) and used only in demo CSS. The lib's `--ac-font-ui`/`--ac-font-mono` remain the
   system/`ui-monospace` stacks — the component imposes **no** font loading on a host.
10. **Integration test proves the country instance works end-to-end against the unchanged generic
    component (FR-14 consequence, FR-18).** An RTL test renders the demo's country `Autocomplete`
    (generic component + `countryAdapter.fetchSuggestions`), types ≥3 chars, and asserts the filtered
    countries render and that `onSelect` updates the readout — with the generic component unmodified. A
    unit test on the adapter asserts case-insensitive filtering and that a <3-char query yields no
    fetch is enforced by the hook (the component-level test), not the adapter.

## Tasks / Subtasks

- [ ] Task 1 — Static country data + adapter (AC: 5, 10)
  - [ ] `src/demo/countries.ts`: export a `Country` type (`{ name: string; flag: string; capital: string; currency: string; code: string }`) and a static `countries: Country[]` list (a reasonable set covering the mockup examples — Poland 🇵🇱 `Warsaw · PLN`, French Polynesia 🇵🇫 `Papeete · XPF`, plus enough to demonstrate filtering). Countries chosen per AR-11's recorded assumption; no external dependency.
  - [ ] `src/demo/countryAdapter.ts`: export `fetchSuggestions(query: string, signal: AbortSignal): Promise<Country[]>` — ~20 lines — that lowercases the query, filters `countries` by case-insensitive substring on `name`, sorts A→Z (locale-aware, matching the component's expectation), and resolves. Do **not** re-implement the 3-char threshold here (the hook owns it). Respect `signal` (if `signal.aborted`, resolve/return without work). Add TSDoc noting it satisfies the AR-4 `fetchSuggestions` contract.
  - [ ] `src/demo/countryAdapter.test.ts`: unit tests for case-insensitive substring filtering and A→Z ordering; abort pass-through no-op.
- [ ] Task 2 — Demo page React structure (AC: 1, 2, 3, 4) 
  - [ ] `src/App.tsx`: reproduce the `docs/design/demo-page.html` structure in JSX — `.wrap` → `header` (eyebrow, `h1` with accent `.path` span, `p.lede` with inline `<code>` for `useAutocomplete<T>` / `<Autocomplete<T>>`, `.contract` strip with four `<span>`s) → `main.stage` with two `<section class="panel">` → `footer`. Use `aria-labelledby` on each panel per the mockup.
  - [ ] Panel 01: render `<GithubAutocomplete />` (from `src/features/github-search/`). Badge `instance 01`, title `GitHub users & repositories`, sub-copy per mockup.
  - [ ] Panel 02: render the generic `<Autocomplete<Country> />` (from `src/lib/autocomplete/`) with `fetchSuggestions={countryAdapter.fetchSuggestions}`, a country `renderItem` (flag + name + meta), `getItemKey={c => c.code}`, and an `onSelect` that sets React state feeding a visible readout (e.g. `Selected: {country.name}`). Badge `instance 02 · same core`, title `Country picker`.
  - [ ] `src/demo/SelectedReadout.tsx` (or inline): the visible "selected" readout element for panel 02.
- [ ] Task 3 — Demo styling in plain CSS + fonts (AC: 6, 8, 9)
  - [ ] `src/demo/demo.css`: port the mockup `<style>` block (wrap, header, eyebrow, `h1`, lede, `.contract`, `.stage` grid with the `@media (max-width: 860px)` single-column collapse, `.panel`, `.badge`, `.panel--countries` teal override, footer). Keep demo-only tokens (`--canvas`, display face) here — **never** in `src/lib/**`.
  - [ ] Apply the country theme via `.panel--countries { --ac-color-accent: #0F766E; --ac-color-highlight: #E9F4F2; }` only. Confirm panel 01 uses the default lib fallbacks / demo `:root` `--ac-*` values (accent `#6639BA`, highlight `#F5F1FB`).
  - [ ] Load Space Grotesk + JetBrains Mono via a `<link>` in `index.html` (or a demo-scoped mechanism); reference them only in `demo.css`. Verify no font import exists under `src/lib/**`.
- [ ] Task 4 — Boundary & isolation check (AC: 7)
  - [ ] Confirm `src/App.tsx`/`src/demo/**` import from both layers and nothing in `lib/`/`features/` imports the demo. Run `pnpm lint` (boundary rule green) and `pnpm typecheck`.
- [ ] Task 5 — Tests (AC: 10)
  - [ ] `src/demo/countryInstance.test.tsx` (RTL): render the generic `Autocomplete` with the country adapter, type a ≥3-char query, assert filtered countries appear, arrow/Enter or click selects, and the readout updates. Assert the generic component file was not modified for this (import the shipped component directly).
- [ ] Task 6 — Documentation deliverables (see below)
- [ ] Task 7 — Verify (AC: all)
  - [ ] `pnpm lint && pnpm typecheck && pnpm test` all green. Run `pnpm dev` and manually verify both instances, the teal theme difference, mobile single-column collapse (≤860px), and the readout (see MANUAL_TESTING.md).

## Documentation deliverables

Part of Definition of Done (see CLAUDE.md). Create the task documentation folder:
`docs/features/epic-3-demo-e2e-launch/3-1-demo-page/`

- **README.md** — required. Document what shipped: the demo page structure (header/contract strip/two
  panels/footer reproduced from `docs/design/demo-page.html`), the country adapter (`fetchSuggestions`
  static-list filter, the threshold-reuse-is-the-proof point), how the teal theme is applied purely via
  `--ac-*` overrides, the plain-CSS demo styling + demo-only font loading (and why fonts never enter the
  lib), the import-direction/isolation guarantee, and any deviations.
- **MANUAL_TESTING.md** — **required** (per epics.md: this story ships visible UI a human verifies in a
  browser). Cover: `pnpm dev`; using both instances; the visible theming difference (purple vs teal);
  the country `onSelect` readout (vs GitHub's new tab); the mobile single-column collapse at ≤860px; and
  accessibility checks (keyboard operate both instances, visible focus ring, both comboboxes announce
  state).
- **PERFORMANCE.md** — not required. The demo is a composition/styling story with no new performance
  dimension (debounce/abort behavior lives in the hook, covered by Epic 1 docs).

## Dev Notes

**Prerequisite & dependencies.** Depends on Story 1.3 (`Autocomplete<T>` generic component) and Story
2.3 (`GithubAutocomplete`) being merged, plus Story 0.1 (scaffold, boundary rule) and 0.3 (`--ac-*`
tokens). The demo is a pure consumer of both layers.
[Source: docs/planning-artifacts/epics.md#Story 3.1 / #Story 1.3 / #Story 2.3, architecture.md#AR-11]

**Branch & PR.** `story/3-1-demo-page` → `master`, squash. Commit e.g.
`feat(3.1): add demo page with github and country instances`. **No AI attribution / no
`Co-Authored-By`.** Run the Codex pre-PR review + security check and wait for CI green before the PR.
[Source: CLAUDE.md#Working rules / #Story pipeline]

**Package manager is pnpm (NOT npm), Node 22.** Use `pnpm dev` / `pnpm lint` / `pnpm typecheck` /
`pnpm test`. This story adds **no new runtime dependencies** — the country list is a static in-repo
array, not a package. [Source: CLAUDE.md#Stack, architecture.md#AR-1]

**The reuse proof is the whole point of this story (FR-14, SM-3).** The country instance must use the
**same shipped generic `Autocomplete<T>`** with **zero changes** to `src/lib/**`. If you find yourself
editing the component to make countries work, that is a bug in the component's genericity — fix the
component's contract, don't special-case the demo. The threshold/debounce come from the hook's defaults
(AR-3: `minChars: 3`, `debounceMs: 300`); the country adapter only supplies data.
[Source: architecture.md#AR-4 (injected contract) / #AR-11, prd.md#FR-14, docs/task.md]

**Adapter contract (AR-4).** `fetchSuggestions(query, signal) => Promise<T[]>` is the single seam every
layer implements. The country adapter is the simplest possible implementation: a synchronous filter
wrapped in a resolved promise. Keep it ~20 lines. The `signal` parameter must be accepted (matching the
contract) and honored as a no-op guard even though there is no network. `getItemKey` for countries is the
`code` (ISO code) — stable and unique. [Source: architecture.md#AR-4 / #3.4, prd.md#FR-14]

**Theming is ONLY `--ac-*` overrides on an ancestor (FR-15, AR-5).** The teal look for panel 02 is
achieved by setting the two documented custom properties on `.panel--countries`; the component reads them
via `var(--ac-*, fallback)` inside its CSS Modules. **Never** target the lib's generated class names from
demo CSS (they are scoped/hashed and doing so would violate NFR-5). Exact override values from the design:
`--ac-color-accent: #0F766E` (5.4:1 — AA), `--ac-color-highlight: #E9F4F2`. Default (panel 01) accent
`#6639BA`, highlight `#F5F1FB`. [Source: docs/design/design-tokens.md (Theming proof), demo-page.html
`.panel--countries`, architecture.md#AR-5]

**Fonts: demo-only, never the lib (AR-5, NFR-5).** The design deliberately keeps the component on system
fonts (`--ac-font-ui = system-ui, …`; `--ac-font-mono = ui-monospace, …`) so the component imposes no
font loading on a host. Space Grotesk / JetBrains Mono are **display faces for the demo only** — load
them from the demo page and reference them only in demo CSS. Any `@import`/`<link>` for these fonts under
`src/lib/**` is a defect. [Source: docs/design/design-tokens.md (Typography — "demo only" display face),
demo-page.html `<link ... Space+Grotesk ... JetBrains+Mono>`]

**Design ground truth — reproduce `docs/design/demo-page.html` (AR-11).** Port the header (eyebrow,
two-line headline with the accent `github/*` path, lede referencing `useAutocomplete<T>` and
`<Autocomplete<T>>`, the four-fact contract strip), the two-panel `.stage` grid (7fr/5fr, collapsing to
one column at ≤860px), panel badges (`instance 01`, `instance 02 · same core`), and the footer. The
mockup's inline listbox markup is a static illustration — in React the dropdown is the real portal
component from Story 1.3; do not hand-roll the listbox. [Source: docs/design/demo-page.html,
design-tokens.md]

**Country `renderItem` mirrors the mockup.** Flag glyph in the icon slot (`.ac-flag`), country name as
the primary line, `capital · currency` as the meta line (e.g. `Warsaw · PLN`). No `owner/repo` path.
GitHub `renderItem` (avatar/repo-icon distinction) is owned by Story 2.3 — do not duplicate it here.
[Source: docs/design/demo-page.html (instance 02 markup), epics.md#Story 2.3]

### Project Structure Notes

- Demo entry: `src/App.tsx` (rendered by `src/main.tsx`), demo-only modules under `src/demo/`
  (`countries.ts`, `countryAdapter.ts`, `demo.css`, readout component), matching the architecture layout.
  [Source: architecture.md#3.2 File layout]
- Tests co-located as `*.test.ts(x)` next to source (Vitest). [Source: architecture.md#3.1 / #3.6]
- Fonts loaded via `index.html` `<link>` (Vite serves `index.html` at the root). [Source:
  docs/design/demo-page.html]

### References

- [Source: docs/planning-artifacts/epics.md#Story 3.1: Demo page with the GitHub instance and a second, differently-themed data source]
- [Source: docs/planning-artifacts/epics.md#Story 1.3 / #Story 2.3 (the consumed components)]
- [Source: docs/planning-artifacts/architecture.md#AR-11 (demo + second instance) / #AR-4 (contract) / #AR-5 (styling, tokens, no fonts in lib) / #AR-2 (import direction) / #3.2 (layout)]
- [Source: docs/planning-artifacts/prds/prd-github-autocomplete-2026-07-09/prd.md#FR-17 / #FR-14 / #FR-15 / #NFR-5 / #SM-3]
- [Source: docs/design/demo-page.html — full page layout, header, contract strip, two panels, `.panel--countries` teal override]
- [Source: docs/design/design-tokens.md — `--ac-*` values, teal theming proof, demo-only display fonts]
- [Source: CLAUDE.md#Architecture boundary / #Documentation deliverables]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|

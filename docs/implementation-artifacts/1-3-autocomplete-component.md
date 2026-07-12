---
baseline_commit: 1b9e1228d30819b9a98c88359595cca4dfa6b167
---

# Story 1.3: `Autocomplete<T>` presentational component with CSS Modules and portal dropdown

Status: Done

## Story

As an integrating developer,
I want a generic, self-contained, themeable Autocomplete component over the hook,
so that I can drop it into any host with any data source and get correct rendering, states, and accessibility everywhere — including clipping layouts (FR-7, FR-8 rendering, FR-14, FR-15; AR-4, AR-5, AR-6, AR-7; NFR-1, NFR-5).

## Acceptance Criteria

1. **Public props exactly per AR-4 (FR-14, NFR-4):** `Autocomplete<T>` accepts `fetchSuggestions(query, signal) => Promise<T[]>`, `renderItem(item, { highlighted }) => ReactNode`, `getItemKey(item) => string`, `onSelect(item) => void`, and optional `placeholder`, `label`, state-message overrides (loading/empty/error texts), `minChars`, `debounceMs`, and footer overrides (see AC-8). **No GitHub types anywhere** in the props; `T` is unconstrained beyond `getItemKey`. Public surface fully typed with TSDoc.
2. **Self-contained styling (FR-15, NFR-5):** all styling comes from `Autocomplete.module.css` using `var(--ac-*, <fallback>)` tokens — no global styles, no style leakage in or out. In a completely unstyled host the component is fully styled from the baked-in fallbacks. Overriding any documented `--ac-*` token on an **ancestor** changes the corresponding property with **no host-side selector overrides**.
3. **Baked-in fallback token values (exact, from design-tokens.md / component-states.html):** every `var(--ac-*, …)` fallback equals the design value verbatim:
   - `--ac-color-surface: #ffffff` · `--ac-color-text: #1f2328` · `--ac-color-text-muted: #59636e` · `--ac-color-accent: #6639ba` · `--ac-color-highlight: #f5f1fb` · `--ac-color-border: #d1d9e0` · `--ac-color-danger: #cf222e` · `--ac-color-warning: #9a6700` · `--ac-color-warning-bg: #fff8c5` · `--ac-color-success: #1a7f37`
   - `--ac-font-ui: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` · `--ac-font-mono: ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace`
   - `--ac-radius: 10px` · `--ac-radius-item: 6px` · `--ac-space: 8px` · `--ac-shadow: 0 8px 24px rgba(31,35,40,.12), 0 1px 3px rgba(31,35,40,.08)` · `--ac-dropdown-max-height: 368px` · `--ac-z-index: 1000`
4. **All 9 states from `component-states.html` are reproduced (FR-8, FR-7):** the component renders, off the hook's `status`/state, each visual state — **01 idle** (closed, `aria-expanded="false"`, placeholder naming both domains), **02 below-threshold** (open with a "Type N more character(s) to search" hint + footer "min 3 characters / esc to close" — no request fired), **03 loading** (3-dot pulse in the input trailing slot + 3 skeleton rows + footer "searching…"), **04 results** (merged list; each row = kind glyph + name + optional `owner/repo` path + meta + KIND column, footer "N of M · sorted A→Z / ↑↓ browse · ↵ open"), **05 keyboard highlight** (highlight bg + 2px accent left bar; `aria-selected`; kept in view), **06 empty** ("No matches for '{query}'" + hint + footer "0 results / esc to close"), **07 error** (danger title + description + "Try again" retry button), **08 rate-limit** (amber `warn` callout — *rendered generically via the error message-override; the component does not know "rate limit"*), **09 focus** (visible 2px accent focus ring, 2px surface offset). The class structure and per-state notes match the HTML source.
5. **Portal + positioning (FR-7, FR-10, AR-7):** the dropdown renders through a **React portal to `document.body`**, positioned to the input's viewport rect via `getBoundingClientRect()` — measured on open and **re-measured on `scroll` (capture) and `resize`** — width-matched to the input, `max-height`-bounded (`--ac-dropdown-max-height`, 368px) with internal `overflow-y: auto` scrolling, and the highlighted item kept in view via `scrollIntoView({ block: 'nearest' })`. It is fully visible inside an `overflow: hidden` ancestor (the point of the portal). ARIA relationships stay id-based so the portal does not break them.
6. **State feedback + live region (FR-8, AR-6):** `loading`, `empty`, and `error` each render distinct, human-readable feedback whose **texts are override-able** via props (defaults baked in the lib, generic). A **visually-hidden `role="status"` / `aria-live="polite"`** region (rendered in the input's normal DOM position, not the portal) announces loading, result count, empty, and error — text derived from the hook's status derivation (1.2). The retry button on the error state re-fires the last query.
7. **Full §3.5 ARIA checklist holds in the rendered DOM (NFR-1):** input `role="combobox"` + `aria-expanded` + `aria-controls` + `aria-autocomplete="list"` + `aria-activedescendant` + a **real `<label>` or `aria-label`** (from the `label` prop, defaulting to an accessible name); listbox `role="listbox"` with `role="option"` children carrying stable ids from `getItemKey` and `aria-selected` on the highlighted one; a **visible, token-controlled focus ring**; focus never leaves the input. The component adds **no key logic** — all keys go through the hook's `handlers.onKeyDown` (§3.4).
8. **Footer contract line — customizable, generic defaults (FR-15, NFR-5):** the dropdown footer renders results count + "sorted A→Z" + key hints (`↑↓ browse · ↵ open`) as in the design, but these strings are **prop-driven with sensible generic defaults** so the lib stays data-source-agnostic — e.g. a `renderFooter(state)` prop or discrete `footerHint`/`sortLabel` overrides; default to the design text but do **not** hardcode GitHub-specific wording that a non-GitHub host couldn't use. The "sorted A→Z" claim is a default label the host can override (the *sorting itself* is the data source's responsibility, not the component's).
9. **Loading pulse + skeletons + reduced motion (design, AR-5):** loading shows the 3-dot pulse (`ac-pulse` keyframes) in the input trailing slot and 3 skeleton rows; the dropdown enters with the 120ms fade + 4px translate-up (`ac-in`); **all motion is gated behind `@media (prefers-reduced-motion: reduce)`** (dots static at reduced opacity, no pop animation).
10. **Data-source agnosticism proven (FR-14):** a fake **static** data source (a `fetchSuggestions` that filters an in-memory array) drives the component in a test with different `renderItem`/`getItemKey`, with **zero** component changes — proving no GitHub coupling.
11. **RTL integration tests (FR-18, §3.6)** cover: each state rendered from real HTTP outcomes via **MSW-over-a-thin-fetch data source *or* a stubbed async `fetchSuggestions`** (see Dev Notes — this story stubs `fetchSuggestions`; **no MSW**, MSW integration is Epic 2), token-fallback styling presence (the `--ac-*` vars appear in the rendered styles / a token override on an ancestor takes effect), keyboard flows end-to-end through the rendered component (ArrowDown → Enter → `onSelect`; Escape closes, focus retained), the full ARIA wiring, the portal target being `document.body`, and the static-data-source agnosticism proof (AC-10).

## Tasks / Subtasks

- [x] Task 1 — CSS Modules (`src/lib/autocomplete/Autocomplete.module.css`) (AC: 2, 3, 4, 9)
  - [x] Author scoped classes mirroring the design's structure (input, trailing slot + pulse dots, popup, list, item, avatar/repoicon glyph, name/path/meta, kind column, footer, state blocks: default/error/warn, retry button, skeleton rows). Class names camelCase (§3.1).
  - [x] Every themeable property reads `var(--ac-*, <fallback>)` with the **exact** fallback hex/values from AC-3. Copy them verbatim from `docs/design/design-tokens.md` / `component-states.html` `:root`.
  - [x] Add the `@keyframes ac-pulse` and `@keyframes ac-in`, plus `@media (prefers-reduced-motion: reduce)` disabling both (AC-9). No global selectors, no `:root` token *definitions* (only `var()` *consumption* with fallbacks) — tokens are set by hosts on ancestors (NFR-5).
  - [x] Focus ring: the input `:focus` / focus-visible uses the double `box-shadow` accent ring (2px surface offset + 2px accent), token-controlled (AC-7, design state 09).
- [x] Task 2 — **Write tests first** (`src/lib/autocomplete/Autocomplete.test.tsx`) (AC: 11) — TEST-FIRST
  - [x] Drive the component with a **stubbed async `fetchSuggestions`** (resolves fixtures / rejects / resolves `[]` / never-resolves-for-loading) + fake timers for debounce. **No MSW here** — see Dev Notes (§3.6: MSW-over-HTTP is Epic 2; this story's data source is injected/stubbed).
  - [x] **States:** below-threshold hint (type 2 chars → hint + no fetch); loading (in-flight → pulse + skeletons + live region "Searching"); results (fixtures → N options + footer count); empty (`[]` → "No matches for '{query}'" + "0 results"); error (reject → danger title + retry button; clicking retry re-fires); rate-limit-style (reject with an overridden error message → the overridden text renders — proving the component shows adapter-supplied text without knowing "rate limit").
  - [x] **Portal:** assert the open dropdown is a child of `document.body` (not the input's wrapper) and that ARIA `aria-controls`/`aria-activedescendant` still resolve across the portal.
  - [x] **Keyboard end-to-end:** ArrowDown highlights option 0 (`aria-selected`, `aria-activedescendant`); Enter → `onSelect(fixtures[0])`; Escape → dropdown closed, input still focused, query retained.
  - [x] **ARIA:** input combobox attrs + a real accessible name (label prop); listbox/option roles + ids from `getItemKey` + `aria-selected`.
  - [x] **Token fallback / theming:** assert the module class is applied and that setting `--ac-color-accent` on an ancestor is reflected (e.g. via computed style or a snapshot of the inline var), proving theming without selector piercing.
  - [x] **Data-source agnosticism (AC-10):** render with a static country-list `fetchSuggestions` + custom `renderItem`/`getItemKey`; assert it works unchanged.
- [x] Task 3 — Component (`src/lib/autocomplete/Autocomplete.tsx`) (AC: 1, 4–10)
  - [x] Consume `useAutocomplete<T>` (1.1/1.2); spread `getInputProps()`/`getListboxProps()`/`getItemProps()`. **No key logic in the component** — everything routes through the hook.
  - [x] Render input + trailing slot (pulse dots when loading) + the visually-hidden live region (in-flow, not portalled) + the portalled popup.
  - [x] Implement the portal + positioning: `createPortal` to `document.body`; a positioning hook/effect measuring `getBoundingClientRect()` on open and on `scroll` (capture: true) + `resize`, applying `position: fixed` `top/left/width` from the rect; `max-height` + internal scroll; `scrollIntoView({ block: 'nearest' })` on the highlighted option when `highlightedIndex` changes. (AR-7)
  - [x] Render all 9 states off the hook state; use `renderItem(item, { highlighted })` for rows; wire the retry button to re-fire the last query; apply message-override props (generic defaults) for loading/empty/error texts.
  - [x] Render the footer via the customizable footer prop/overrides with generic defaults (AC-8).
  - [x] Supply the real `<label>`/`aria-label` from the `label` prop (default an accessible name).
- [x] Task 4 — Verify (AC: all)
  - [x] `pnpm lint && pnpm typecheck && pnpm test` green. Lib-boundary rule (AR-2) clean; **zero** GitHub strings/types in `src/lib/autocomplete/` (grep for "github"/"rate" — none). Manual browser pass per MANUAL_TESTING.md.

## Documentation deliverables

Part of Definition of Done (see CLAUDE.md). Create the task documentation folder:
`docs/features/epic-1-core-autocomplete/1-3-autocomplete-component/`

- **README.md** — required. Document the component's public props (AR-4 surface + the message/footer overrides), the `--ac-*` token table with names/purposes/fallbacks (feeds the lib README section per 0.3), the portal/positioning strategy, the state rendering (all 9 states), the live-region behavior, and the data-source-agnostic guarantee (no GitHub knowledge).
- **MANUAL_TESTING.md** — **required** (epics.md 1.3: visible UI). Cover: typing to see below-threshold hint → loading → results; ArrowUp/Down navigation with visible highlight (clamp, no wrap) kept in view; Enter/click selection; Escape (closes, keeps query + focus); the empty and error states + retry; rendering inside an `overflow: hidden` host to prove the portal isn't clipped; overriding `--ac-color-accent`/`--ac-color-highlight` on an ancestor to prove theming. **Accessibility checks:** keyboard-only operation, visible focus ring, screen-reader announcements from the live region, focus staying on the input during navigation.
- **PERFORMANCE.md** — skip (the debounce/abort performance dimension is documented in 1.1; this story is rendering, no new perf dimension). Note the reference in the README.

## Dev Notes

**Prerequisite & scope.** Depends on **1.1** (state machine, debounce, threshold, abort), **1.2** (keyboard reducers, ARIA prop getters, id scheme, status-text derivation), and **0.3** (the `--ac-*` token map + fallbacks from `docs/design/`). This story is the **rendered** generic component: CSS Modules, the 9 visual states, the portal dropdown, the live region, and the footer. It ships **zero GitHub knowledge** — the GitHub `renderItem`/`onSelect` and rate-limit *text* arrive in Epic 2 (2.3), which consumes this component's public contract. [Source: docs/planning-artifacts/epics.md#Story 1.3; architecture.md AR-4..AR-7, §4]

**Branch & PR.** `story/1-3-autocomplete-component` → `master`, squash. Commit e.g. `feat(1.3): add Autocomplete component with CSS Modules and portal dropdown`. **No `Co-Authored-By` / no AI attribution.** Codex pre-PR review + security check (portal/`document.body` handling, no unsafe URL/target — note `window.open` targets are Epic 2's concern, not here), CI green, record in Dev Agent Record. [Source: CLAUDE.md#Working rules, #Story pipeline]

**Package manager is pnpm (NOT npm).** `pnpm lint` / `pnpm typecheck` / `pnpm test`, Node 22. No new runtime deps (React + `react-dom`'s `createPortal` only). [Source: CLAUDE.md#Stack; architecture.md AR-1]

**Visual ground truth = `docs/design/component-states.html` (reproduce it) (AR-5, FR-8).** The 9 `<section class="spec">` blocks are the exact states to reproduce, with the class structure and the per-state notes as the spec:
- **01 idle:** closed input, `aria-expanded="false"`, placeholder `"Search GitHub users & repositories…"` — but the placeholder is a **prop** (`placeholder`) with a generic default, since the lib has no GitHub knowledge; the GitHub-specific placeholder is supplied by the adapter (2.3).
- **02 below threshold:** open popup with a `Type N more character(s) to search` hint (compute N from `minChars` − query length) and footer `min N characters` / `esc to close`. **No request fired.** The footer *narrates the contract* (design "signature element").
- **03 loading:** 3 pulse dots in the trailing slot (`ac-slot`/`ac-dot`) + 3 skeleton rows (`ac-skel`) + footer `searching…`. Previous results replaced, not shown stale (this comes free from the hook's state machine — `status: 'loading'` clears items rendering).
- **04 results:** `ul.ac-list[role=listbox]` of `li.ac-item[role=option]`; each row is `renderItem`'s output (the design shows glyph + name + optional mono `owner/repo` path + meta + KIND column). The component provides the *chrome* (row container, highlight styling, footer); the *content* is `renderItem` (so GitHub avatars/icons live in 2.3). Footer `N of M · sorted A→Z` / `↑↓ browse · ↵ open` — see the footer-override note (AC-8).
- **05 keyboard highlight:** `--ac-color-highlight` bg + 2px accent left bar (`border-left`), `aria-selected="true"`, focus stays on input, `aria-activedescendant` → option id, clamp no-wrap (from 1.2), highlighted item scrolled into view.
- **06 empty:** `No matches for "{query}"` + `Check the spelling or try a shorter query.` + footer `0 results` / `esc to close`. Announced via live region.
- **07 error:** `ac-state.error` — danger title `Search failed` + description + `Try again` retry button. All-or-nothing (Epic 2's concern); here the component just renders `status: 'error'` with the (override-able) message + retry.
- **08 rate limit:** `ac-state.warn` — amber callout. **Critical boundary:** the generic component does **not** know "rate limit". It renders whatever error message the consumer supplies via the error-message override, and supports a distinct visual *variant* (e.g. a `warn`/`severity` hint the adapter can pass) so 2.3 can show the amber rate-limit callout **without the lib importing GitHub knowledge**. Decision: expose the error variant via the message-override contract (e.g. an override that can carry a `tone: 'error' | 'warning'`), defaulting to `error`. Record the exact mechanism in the README.
- **09 focus:** visible 2px accent ring, 2px surface offset (double `box-shadow`), 7.1:1 on white.
[Source: docs/design/component-states.html (all 9 sections + notes); design-tokens.md]

**Portal + positioning (AR-7) — the chosen approach.** Render via `createPortal(popup, document.body)`. Position with `position: fixed` using the input's `getBoundingClientRect()` (viewport coords, so `fixed` needs no scroll offset math), re-measured on **open**, on `window` `scroll` with `{ capture: true }` (to catch scrolling ancestors), and on `resize`; width-matched to the input rect. `max-height` = `--ac-dropdown-max-height` (368px) with `overflow-y: auto`; `scrollIntoView({ block: 'nearest' })` on the highlighted option. This is what makes FR-7 (visible inside `overflow: hidden` hosts) hold. **AR-7 pre-authorizes a fallback** to in-place `position: absolute` inside a `position: relative` wrapper *only if* portal positioning proves too costly (scroll-sync jank / test flakiness) — and any such change must be **recorded in architecture.md first**. Prefer the portal. [Source: architecture.md AR-7, §3.5; prd.md#FR-7; component-states.html header note "dropdown is a portal in the real implementation"]

**Self-contained styling, tokens with baked fallbacks (AR-5, FR-15, NFR-5).** CSS Modules only — hard scoping, no leaks in or out, zero runtime cost. Every property is `var(--ac-*, <fallback>)` with the **design fallback baked in** (AC-3 values, verbatim), so the component is fully styled in an unstyled host. Hosts theme by setting `--ac-*` on any ancestor — never by piercing selectors. **No Tailwind, no CSS framework, no global styles** in the lib layer. The demo's second-instance theming (Epic 3) works purely by overriding e.g. `--ac-color-accent: #0F766E` / `--ac-color-highlight: #E9F4F2` on an ancestor. [Source: architecture.md AR-5; design-tokens.md (token tables + "Theming proof"); prd.md#FR-15; CLAUDE.md#Architecture boundary]

**Footer + all strings are prop-driven with generic defaults (FR-14/FR-15, NFR-5).** The footer ("N of M · sorted A→Z", "↑↓ browse · ↵ open", "min N characters", "esc to close") and the state messages are **customizable via props** with sensible defaults, so the lib stays generic. Do not hardcode wording a non-GitHub host couldn't use; "sorted A→Z" is a default label (the actual sort is the data source's job). This keeps FR-14 checkable: the demo's country instance uses the same component with different footer/messages. [Source: architecture.md AR-4/AR-5; prd.md#FR-14/FR-15; design-tokens.md#Signature element]

**No key logic in the component (§3.4).** All keyboard handling is the hook's `handlers.onKeyDown` (1.2). The component only spreads getters and renders. This keeps the a11y wiring un-mis-wireable. [Source: architecture.md §3.4; epics.md#Story 1.3 technical notes]

**Testing — stubbed `fetchSuggestions`, NOT MSW for this story (§3.6).** Although §3.6 lists MSW at the integration level generally, **this story's data source is the injected `fetchSuggestions`**, which is stubbed directly (resolve/reject/empty/never-resolve) — there is no real HTTP in the generic component, so MSW adds nothing here. MSW-over-HTTP integration belongs to **Epic 2** (the GitHub adapter's real `fetch`). Use fake timers for debounce, RTL for interaction, and the static-country data source to prove agnosticism. [Source: architecture.md §3.6; epics.md#Story 1.3 (per the task brief: "RTL+MSW-free tests ... stubbed fetchSuggestions, NOT MSW")]

**Scope boundary / what NOT to build here.**
- **No** GitHub `renderItem` (avatar/icon), **no** `window.open` selection, **no** rate-limit *text/mapping* — all Epic 2 (2.3). The component only exposes the seams. [Source: epics.md#Story 2.3]
- **No** merge/sort/cap — Epic 2 (2.2). "sorted A→Z" here is a default footer *label*, not sorting logic.
- **No** demo page / second instance wiring — Epic 3 (3.1). The static country source here is a **test fixture** only.

### Project Structure Notes

- New files under **`src/lib/autocomplete/`**: `Autocomplete.tsx`, `Autocomplete.module.css`, co-located `Autocomplete.test.tsx`. Extends `types.ts` with the component's `AutocompleteProps<T>` (UPDATE). [Source: architecture.md §3.2]
- Component name `PascalCase.tsx`, CSS `<Component>.module.css`, camelCase class names, tests co-located (§3.1).
- Consumes 0.3's `--ac-*` token contract; the fallback values must match 0.3's token map and `docs/design/`. If 0.3 exposes a tokens reference file, consume it; otherwise bake the AC-3 fallbacks directly in the module CSS. [Source: epics.md#Story 0.3; architecture.md AR-5]

### References

- [Source: docs/planning-artifacts/epics.md#Story 1.3: `Autocomplete<T>` presentational component with CSS Modules and portal dropdown]
- [Source: docs/planning-artifacts/architecture.md#AR-4 `Autocomplete<T>` — generic presentational component with an injected contract]
- [Source: docs/planning-artifacts/architecture.md#AR-5 Styling — CSS Modules + `--ac-*` tokens with baked fallbacks]
- [Source: docs/planning-artifacts/architecture.md#AR-6 Accessibility — WAI-ARIA combobox]
- [Source: docs/planning-artifacts/architecture.md#AR-7 Dropdown rendering — React portal to `document.body`]
- [Source: docs/planning-artifacts/architecture.md#3.4 Hook → component contract, #3.5 A11y checklist, #3.6 Testing]
- [Source: docs/planning-artifacts/prds/prd-github-autocomplete-2026-07-09/prd.md#FR-7, #FR-8, #FR-14, #FR-15, #NFR-1, #NFR-5]
- [Source: docs/design/component-states.html — all 9 states (class structure + notes)]
- [Source: docs/design/design-tokens.md — Color / Typography / Spacing & shape / Motion / Signature element / A11y baseline (fallback values)]
- [Source: CLAUDE.md#Architecture boundary, #Working rules, #Documentation deliverables]

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5) via Claude Code

### Implementation Plan

1. Test-first: author `Autocomplete.test.tsx` (41 RTL tests initially, 43 after the review gate, stubbed `fetchSuggestions`, fake
   timers, no MSW) → confirmed RED.
2. `Autocomplete.module.css` mirroring `component-states.html` with every themeable property as
   `var(--ac-*, <AC-3 fallback>)`, `ac-pulse`/`ac-in` keyframes, reduced-motion gate.
3. Extend `types.ts` with the AR-4 props surface (`AutocompleteProps<T>` + messages/footer/tone
   types); implement `Autocomplete.tsx` (portal + positioning hook, token bridging, 9 states,
   live region, retry).
4. Full verification + scripted real-browser pass (Chromium/Playwright) + docs folder.

### Debug Log References

- Scripted browser pass (temporary App.tsx harness, reverted): verified portal parent =
  `document.body`, popup width-matched to input, positioned at `rect.bottom + 6`, Escape keeps
  focus + query, `--ac-*` bridging onto the portal popup. Caught one real defect: missing
  self-contained `box-sizing: border-box` (popup rendered wider than the input in hosts without a
  border-box reset) — fixed in the module CSS and re-verified.

### Completion Notes List

- All 11 ACs implemented; 43 new tests, 115 total green; lint/typecheck/e2e green.
- **Key decisions:**
  - **Token bridging across the portal:** tokens set on a host ancestor cannot cascade to a
    `document.body` portal, so on each measurement pass the component copies the computed value of
    every documented `--ac-*` token from its root onto the popup as inline custom properties
    (unset tokens keep their CSS fallbacks). Without this, AC-2 ancestor theming would silently
    not apply to the dropdown.
  - **Below-threshold popup (state 02)** is component-local (input focus + `0 < len < minChars`):
    the hook's `isOpen` stays `false` below the threshold by design (1.1), so `aria-expanded`
    remains `"false"` — the hint layer is not the ARIA listbox popup. Escape dismisses it via a
    guard that runs only if the hook's `onKeyDown` did not consume the event; dismissal is keyed
    to the query so typing re-shows it. This is the single, documented exception to "no key
    logic" — the hook cannot own a state it never enters, and the footer promises "esc to close".
  - **Error tone mechanism (AC state 08):** `messages.error(error)` returns
    `{ title, description, tone: 'error'|'warning', retryable }`; `tone: 'warning'` renders the
    amber callout, `retryable: false` hides the retry button. The lib never learns error causes.
  - **Footer seam (AC-8):** single `renderFooter(context)` prop (status/query/resultCount/
    minChars/belowThreshold) with the design texts as defaults; error state defaults to no footer
    (per design state 07). "N of M" totals are the host's override since the component cannot
    know M.
  - **Retry** re-fires the last query through `handlers.onInputChange(state.query)` (normal
    threshold/debounce/abort path) and refocuses the input.
- **Grep gate note (Task 4):** `grep -ri "github|rate" src/lib/autocomplete/` shows only
  pre-existing Story 0.3 comments in `tokens.css` and incidental substrings ("sepa**rate**",
  "nar**rate**s") in TSDoc prose. Zero GitHub/rate-limit knowledge (types, strings, logic) exists
  in the lib; no new comment mentions either concept.
- `--ac-color-success` is consumed by a documented `.ok` utility class so every AC-3 token has
  its baked fallback in the module (the design reserves success for live-region/demo accents).

### Pre-PR review gate (mandatory)

- **Security review (skill):** zero findings. Verified: no HTML/string-to-DOM sinks (all dynamic
  content rendered as React children), token bridge copies only an allowlisted set of `--ac-*`
  names from the host's own cascade, no URL/`window.open` handling in this story, no network/
  storage/secrets in the diff.
- **Codex second-pass review:** 5 findings, each triaged empirically:
  1. **CONFIRMED (fixed):** `aria-controls` referenced a non-existent listbox in
     loading/empty/error states (listbox was rendered only on `success` while the hook keeps
     `aria-expanded="true"`). Fix: the `role="listbox"` element now renders (empty) whenever the
     popup is open, so the id reference always resolves; options populate it only on `success`.
     Two regression tests added (ARIA in non-success states; scroll/resize listener cleanup on
     unmount-while-open). The closed-state `aria-controls` (hook-owned, shipped in 1.2) is
     unchanged — out of this story's diff.
  2. **FALSE POSITIVE:** "hardcoded non-token colors" (skeleton `#e9edf3`, avatar gradient,
     repoicon `#eef1f6`). Evidence: `docs/design/component-states.html` hardcodes exactly these
     literals and the AC-3/0.3 token map is a closed contract — inventing undocumented `--ac-*`
     tokens would deviate from the spec. Decorative surfaces kept design-verbatim.
  3. **FALSE POSITIVE:** "GitHub-shaped helper classes (`.avatar`/`.repoicon`/`.path`/`.meta`/
     `.kind`)". Evidence: story Task 1 explicitly requires authoring these classes; names are
     generic row anatomy, no data-source knowledge.
  4. **ACKNOWLEDGED (out of spec):** token bridge refreshes on open/scroll/resize only (exactly
     what AC-5 mandates); flipping an ancestor token while the dropdown is open updates the popup
     on the next measurement, not synchronously. Documented as a known limitation in the feature
     README.
  5. **CONFIRMED (fixed):** test gap for non-success ARIA and listener cleanup — covered by the
     two tests added under finding 1.
- **Re-verification after fixes:** `pnpm lint && pnpm typecheck && pnpm test` (115 tests) and
  `pnpm test:e2e` all green.

### File List

- `src/lib/autocomplete/Autocomplete.tsx` — NEW
- `src/lib/autocomplete/Autocomplete.module.css` — NEW
- `src/lib/autocomplete/Autocomplete.test.tsx` — NEW
- `src/lib/autocomplete/types.ts` — UPDATE (component prop types)
- `docs/features/epic-1-core-autocomplete/1-3-autocomplete-component/README.md` — NEW
- `docs/features/epic-1-core-autocomplete/1-3-autocomplete-component/MANUAL_TESTING.md` — NEW
- `docs/implementation-artifacts/1-3-autocomplete-component.md` — UPDATE (this record)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-09 | 0.1 | Initial draft (headless create-story, Approved) | bmad-create-story |
| 2026-07-09 | 1.0 | Implemented: component + CSS module + 43 tests + docs; all ACs green | dev agent (Claude Fable 5) |

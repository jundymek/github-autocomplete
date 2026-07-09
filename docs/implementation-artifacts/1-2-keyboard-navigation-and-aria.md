# Story 1.2: Keyboard navigation and ARIA combobox wiring in the hook

Status: Approved

## Story

As a keyboard user,
I want arrow-key navigation, Enter selection, and Escape handled by the hook with correct ARIA plumbing,
so that any UI rendered over the hook is fully keyboard-operable and screen-reader-correct by construction (FR-10, FR-11 selection path, FR-12; AR-3, AR-6, §3.5; NFR-1).

## Acceptance Criteria

1. **ArrowDown / ArrowUp with clamping, no wrap (FR-10, AR-3):** with an open dropdown of N items, ArrowDown from the input highlights index `0`; subsequent ArrowDown advances by one and **clamps at `N-1`** (does not wrap to 0); ArrowUp moves back and **clamps at `0`** (does not wrap to `N-1`). All key logic lives in `handlers.onKeyDown` — consuming components add no key logic (§3.4).
2. **Enter selects (FR-11 generic path):** Enter while an item is highlighted calls `onSelect(item)` with the highlighted item and prevents the default form submit. Item **click** and **hover-to-highlight** route through the same handlers (`handlers.onItemClick`, `handlers.onItemHover`) so mouse and keyboard converge on one selection path. Enter with no highlighted item is a no-op (no `onSelect`). (FR-11 assumption: click === Enter)
3. **Escape closes and clears highlight (FR-12):** Escape closes the dropdown (`isOpen: false`), **clears the highlight** (`highlightedIndex: null`), **keeps the query text**, and **keeps focus on the input** (activedescendant technique — focus never leaves the input). Escape does not clear the input value.
4. **Home / End — decision (state it):** `Home` moves highlight to index `0`, `End` moves to `N-1`, when the dropdown is open. Rationale: standard WAI-ARIA combobox/listbox keyboard support, trivial to implement over the clamp logic, and helps keyboard users on a bounded ≤50-item list. This is a small, standard addition (not scope creep). Both are handled in `handlers.onKeyDown`. [ASSUMPTION: headless run — Home/End included as standard listbox keys; if the reviewer objects they can be removed without touching Arrow/Enter/Escape.]
5. **New items / query reset:** when a new fetch resolves or the query changes, `highlightedIndex` resets to `null` (no item pre-highlighted until the user presses a nav key), consistent with 1.1.
6. **Prop getters (§3.4, AR-6, NFR-1):** the hook exposes three prop getters that the component spreads so it cannot mis-wire ARIA:
   - `getInputProps()` → `{ role: 'combobox', 'aria-expanded': isOpen, 'aria-controls': listboxId, 'aria-autocomplete': 'list', 'aria-activedescendant': highlightedOptionId | undefined, value: query, onChange, onKeyDown }` (a real `<label>`/`aria-label` is supplied by the component in 1.3, not by the getter).
   - `getListboxProps()` → `{ role: 'listbox', id: listboxId }`.
   - `getItemProps(item, index)` → `{ role: 'option', id: optionId(item), 'aria-selected': index === highlightedIndex, onClick, onMouseMove/onMouseEnter (hover) }`.
7. **Id scheme (AR-6, §3.5):** a stable per-instance base id (e.g. via `useId()`); `listboxId = ${base}-listbox`; `optionId(item) = ${base}-option-${getItemKey(item)}`. `aria-activedescendant` on the input equals the highlighted option's id, or `undefined` when no highlight. Option ids derive from `getItemKey` so they are stable across renders. (§3.5)
8. **Live-region status text derivation:** the hook derives a `statusMessage: string` (or exposes a `getStatusMessage()` helper) from the state for the visually-hidden `aria-live="polite"` region the component renders in 1.3 — e.g. `'Searching…'` (loading), `'N results'` (success, N = items.length), `'No matches'` (empty), the error `message` (error), `''` (idle/closed). Text is generic/override-friendly (defaults live in the lib; the adapter can override in 1.3), containing **no GitHub knowledge**. (AR-6, §3.5, NFR-5)
9. `handlers.onKeyDown` handles ArrowDown, ArrowUp, Home, End, Enter, Escape and calls `preventDefault()` on the keys it consumes (so Arrow keys don't move the text cursor and Enter doesn't submit a form). Unhandled keys pass through untouched. (§3.4)
10. The added surface is fully typed with TSDoc, TS strict clean, and `src/lib/autocomplete/` still has **zero** imports from `features/`/app code and zero GitHub strings. (NFR-4, NFR-5, AR-2)
11. RTL integration tests, driven through a **minimal test-only harness component** that renders an input + list over the hook and spreads the getters, assert: navigation + clamping (no wrap) both ends, Home/End, Enter-calls-onSelect-with-highlighted-item, click and hover route through the same handlers, Escape (closes + clears highlight + query retained + focus stays on input), and the exact ARIA attribute wiring (roles, `aria-expanded`, `aria-controls`, `aria-activedescendant` → option id, `aria-selected`). (FR-18, §3.6)

## Tasks / Subtasks

- [ ] Task 1 — Extend types (`src/lib/autocomplete/types.ts`) (AC: 6, 7, 8, 10)
  - [ ] Add the prop-getter signatures to the `handlers` type: `getInputProps()`, `getListboxProps()`, `getItemProps(item: T, index: number)`, plus `onKeyDown`, `onItemClick(item, index)`, `onItemHover(index)`, and `getStatusMessage()` (or a `statusMessage` field on state). Require `onSelect(item: T) => void` and `getItemKey(item: T) => string` in the hook options now (they were optional/declared in 1.1). TSDoc each.
  - [ ] Decide and document (Dev Agent Record): whether `statusMessage` is a derived field on `state` or a `handlers.getStatusMessage()`. Default recommendation: a derived `state.statusMessage` for simplicity, or a getter with optional message overrides passed from options — pick one and keep it consistent for 1.3.
- [ ] Task 2 — **Write tests first** via a minimal harness (`src/lib/autocomplete/useAutocomplete.keyboard.test.tsx`) (AC: 11) — TEST-FIRST
  - [ ] Build a **test-only** harness component `<Harness items=… onSelect=… />` that calls `useAutocomplete`, renders `<input {...getInputProps()} />` and `<ul {...getListboxProps()}>` with `<li {...getItemProps(item, i)}>` per item, driven by a stubbed `fetchSuggestions` that resolves the provided items (fake timers to flush debounce). The harness is test-only and is discarded — the shipped generic component is 1.3.
  - [ ] **Navigation + clamp (no wrap):** open with N=3; ArrowDown → index 0 highlighted (`aria-selected` on option 0, `aria-activedescendant` = option-0 id); ArrowDown×2 more → index 2; one more ArrowDown → **still 2** (clamp, no wrap). ArrowUp back to 0; one more ArrowUp → **still 0** (clamp).
  - [ ] **Home/End:** from mid-list, `End` → index N-1; `Home` → index 0.
  - [ ] **Enter:** highlight index 1, press Enter → `onSelect` called once with `items[1]`; Enter with no highlight → `onSelect` not called.
  - [ ] **Click + hover convergence:** clicking option 2 calls the same selection path (`onSelect` with `items[2]`); `mouseenter`/`mousemove` on option 1 sets `highlightedIndex` to 1 (asserted via `aria-selected`).
  - [ ] **Escape:** open + highlight, press Escape → listbox gone (`isOpen:false` / not rendered), `aria-selected` cleared / `highlightedIndex` null, input value unchanged, `document.activeElement` is still the input.
  - [ ] **ARIA wiring:** assert input has `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded` reflecting open state, `aria-controls` === listbox id; listbox has `role="listbox"` + matching id; options have `role="option"` + stable ids from `getItemKey` + correct `aria-selected`.
  - [ ] **Status text:** assert `statusMessage` (or `getStatusMessage()`) yields `'Searching…'` / `'3 results'` / `'No matches'` / the error message across states.
- [ ] Task 3 — Implement reducers + getters in the hook (`src/lib/autocomplete/useAutocomplete.ts`) (AC: 1–10)
  - [ ] Add ArrowDown/ArrowUp/Home/End highlight reducers with clamping (no wrap), Enter (→ `onSelect(items[highlightedIndex])`, guarded), Escape (→ close + clear highlight, keep query, keep focus), all inside `handlers.onKeyDown` with `preventDefault()` on consumed keys.
  - [ ] Implement `onItemClick` (→ select) and `onItemHover` (→ set highlight), routing mouse through the same paths as keyboard.
  - [ ] Implement `useId()`-based id scheme and the three prop getters; compute `aria-activedescendant` from the highlighted option id.
  - [ ] Implement `statusMessage` derivation from `status`/`items.length`/`error.message`; keep strings generic and (optionally) overridable via options — no GitHub terms.
  - [ ] Ensure `highlightedIndex` resets to `null` on new query / new results / close (consistent with 1.1).
- [ ] Task 4 — Verify (AC: all)
  - [ ] `pnpm lint && pnpm typecheck && pnpm test` green. Lib-boundary rule (AR-2) still clean; no GitHub strings in `src/lib/autocomplete/`.

## Documentation deliverables

Part of Definition of Done (see CLAUDE.md). Create the task documentation folder:
`docs/features/epic-1-core-autocomplete/1-2-keyboard-navigation-and-aria/`

- **README.md** — required. Document the keyboard model (ArrowUp/Down clamp-no-wrap, Home/End, Enter, Escape), the mouse-converges-on-keyboard design (click/hover through the same handlers), the three prop getters and the full §3.5 ARIA attribute set they emit, the id scheme, the activedescendant technique (focus stays on input), and the live-region status-text derivation (generic, override-friendly). Note what is deferred to 1.3 (the actual rendered component, CSS, `scrollIntoView`, the visually-hidden live region element).
- **MANUAL_TESTING.md** — **skip.** No shipped UI until 1.3; behavior is fully covered by RTL tests over the test-only harness (epics.md 1.2). Note this in the README.
- **PERFORMANCE.md** — skip (no performance dimension; pure interaction logic).

## Dev Notes

**Prerequisite & scope.** Builds directly on **1.1** (same hook file). 1.1 delivered the state machine, debounce, threshold, and abort, with `highlightedIndex` in the state shape but no reducers. This story adds the keyboard reducers, mouse handlers, ARIA prop getters, id scheme, and live-region status derivation — all still headless. The **rendered** generic component, CSS Modules, portal, `scrollIntoView`, and the visually-hidden live-region element are **1.3**. [Source: docs/planning-artifacts/epics.md#Story 1.2; architecture.md AR-3, §3.4]

**Branch & PR.** `story/1-2-keyboard-navigation-and-aria` → `master`, squash. Commit e.g. `feat(1.2): add keyboard navigation and ARIA combobox wiring to useAutocomplete`. **No `Co-Authored-By` / no AI attribution.** Codex pre-PR review + security check, CI green, record in Dev Agent Record. [Source: CLAUDE.md#Working rules, #Story pipeline; architecture.md §3.7]

**Package manager is pnpm (NOT npm).** `pnpm lint` / `pnpm typecheck` / `pnpm test`, Node 22. No new deps expected. [Source: CLAUDE.md#Stack; architecture.md AR-1]

**Clamp, do not wrap (FR-10, AR-3 — explicit).** Architecture fixes this decision so agents don't drift: ArrowDown/ArrowUp **clamp at the ends, no wrap-around**. Highlight must be kept in view via `scrollIntoView({ block: 'nearest' })` — but that DOM call belongs to the rendered component in **1.3**; here the hook only owns the index. [Source: architecture.md AR-3, §3.5; prd.md#FR-10; docs/design/component-states.html state 05 note "Clamps at ends, no wrap"]

**Focus never leaves the input — activedescendant technique (AR-6, §3.5).** Do **not** use roving `tabindex`/DOM focus on options. The input keeps DOM focus at all times; the highlighted option is indicated only by `aria-activedescendant` on the input + `aria-selected` on the option. This is what makes FR-12 (Escape keeps focus) and the keyboard tests deterministic. [Source: architecture.md AR-6, §3.5; prd.md#FR-12; design-tokens.md#A11y baseline; component-states.html state 05 note]

**Exact §3.5 ARIA checklist (assert every item).**
- Input: `role="combobox"`, `aria-expanded`, `aria-controls={listboxId}`, `aria-autocomplete="list"`, `aria-activedescendant={highlightedOptionId | undefined}`. (The real `<label>`/`aria-label` is added by the 1.3 component.)
- Popup: `role="listbox"`, `id={listboxId}`; items `role="option"`, stable `id` from `getItemKey`, `aria-selected` on the highlighted one.
- Status region: visually hidden, `role="status"`/`aria-live="polite"` announcing loading / "N results" / empty / error — the hook derives the *text*; 1.3 renders the *element*.
[Source: architecture.md §3.5; design-tokens.md#A11y baseline]

**Generic status strings — no GitHub knowledge (NFR-5, AR-2).** The derived status text (`'Searching…'`, `'N results'`, `'No matches'`, error message) stays generic and override-friendly. The adapter supplies specific error/empty text via the component's message-override props in 1.3; the hook and lib layer never learn what a rate limit is. `src/lib/autocomplete/` keeps zero `features/`/app imports. [Source: architecture.md AR-2, §3.3; prd.md#NFR-5; CLAUDE.md#Architecture boundary]

**Enter / click / hover convergence (FR-11 assumption).** Mouse click on an item behaves identically to Enter on the highlighted item — both go through the injected `onSelect`. Hover sets the highlight (so mouse and keyboard share one `highlightedIndex`). The hook stays URL/tab-agnostic; *what* `onSelect` does (open a new tab) is the Epic 2 adapter's job. [Source: architecture.md AR-4, AR-10; prd.md#FR-11 (click === Enter assumption)]

**Testing — minimal harness, RTL (§3.6 integration).** Because there is no shipped component yet, drive the hook through a **test-only** harness that spreads the getters. Use RTL's `userEvent`/`fireEvent` for keys/click/hover and fake timers to flush the debounce before opening. No MSW needed (data source is a stub); MSW-over-HTTP integration arrives with the rendered component in 1.3. [Source: architecture.md §3.6; epics.md#Story 1.2 technical notes ("test harness component is test-only")]

### Project Structure Notes

- Extends **`src/lib/autocomplete/useAutocomplete.ts`** and **`types.ts`** (UPDATE); new co-located test `useAutocomplete.keyboard.test.tsx` (NEW). Test-only harness lives inside the test file (or a `*.test-harness.tsx` that is never imported by shipped code). [Source: architecture.md §3.1/§3.2]
- No CSS, no portal, no rendered component — those are 1.3.

### References

- [Source: docs/planning-artifacts/epics.md#Story 1.2: Keyboard navigation and ARIA combobox wiring in the hook]
- [Source: docs/planning-artifacts/architecture.md#AR-3 (keyboard state, clamp no-wrap)]
- [Source: docs/planning-artifacts/architecture.md#AR-6 Accessibility — WAI-ARIA combobox with `aria-activedescendant`]
- [Source: docs/planning-artifacts/architecture.md#3.4 Hook → component contract (ARIA prop getters)]
- [Source: docs/planning-artifacts/architecture.md#3.5 A11y attributes checklist]
- [Source: docs/planning-artifacts/architecture.md#3.6 Testing conventions (integration level, RTL)]
- [Source: docs/planning-artifacts/prds/prd-github-autocomplete-2026-07-09/prd.md#FR-10, #FR-11, #FR-12, #NFR-1, #NFR-5]
- [Source: docs/design/component-states.html — state 05 (keyboard highlight: clamp no-wrap, focus stays on input, activedescendant)]
- [Source: docs/design/design-tokens.md#A11y baseline (WAI-ARIA combobox, live region)]
- [Source: CLAUDE.md#Architecture boundary, #Working rules]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-09 | 0.1 | Initial draft (headless create-story, Approved) | bmad-create-story |

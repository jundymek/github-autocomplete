# 1.2 — Keyboard navigation and ARIA combobox wiring in the hook

## What was built

Story 1.1's headless `useAutocomplete<T>` hook gained the full interaction and accessibility
layer, still with no rendered UI:

- **Keyboard model** (all inside `handlers.onKeyDown`): ArrowDown/ArrowUp move the highlight one
  step and **clamp at the ends — no wrap-around** (AR-3). ArrowDown from no highlight starts at
  index 0. Home jumps to 0, End to N−1 (standard WAI-ARIA listbox keys). Enter selects the
  highlighted item via the injected `onSelect(item)` and prevents the form submit; Enter with no
  highlight is a no-op that passes through. Escape closes the dropdown, clears the highlight,
  keeps the query text, and keeps focus on the input. `preventDefault()` is called only on keys
  the hook consumes; a closed dropdown consumes nothing.
- **Mouse converges on keyboard:** clicking an option routes through `handlers.onItemClick` →
  the same `onSelect` path as Enter; hovering (`mousemove`) routes through `handlers.onItemHover`
  → the same `highlightedIndex` as the Arrow keys. One selection path, one highlight state.
- **Three ARIA prop getters** the component spreads verbatim so it cannot mis-wire ARIA (§3.4/§3.5):
  - `getInputProps()` → `role="combobox"`, `aria-expanded`, `aria-controls={listboxId}`,
    `aria-autocomplete="list"`, `aria-activedescendant` (highlighted option id or `undefined`),
    controlled `value`, `onChange`, `onKeyDown`.
  - `getListboxProps()` → `role="listbox"`, `id={listboxId}`.
  - `getItemProps(item, index)` → `role="option"`, stable `id`, `aria-selected`, `onClick`,
    `onMouseMove`.
- **Id scheme:** a per-instance base from React `useId()`; `listboxId = ${base}-listbox`,
  `optionId = ${base}-option-${getItemKey(item)}` — option ids derive from `getItemKey`, so they
  are stable across renders.
- **Activedescendant technique:** DOM focus never leaves the input; the highlighted option is
  indicated only via `aria-activedescendant` + `aria-selected` (no roving tabindex). This is what
  makes "Escape keeps focus" hold by construction.
- **Live-region status text:** a derived `state.statusMessage` for the visually-hidden
  `aria-live="polite"` region (rendered in 1.3): `'Searching…'` (loading), `'N results'`
  (success, pluralized), `'No matches'` (empty), the error message (error), `''` (idle/closed).
  Defaults are generic; each (including the error text, via
  `statusMessages.error(error)` with access to the preserved `error.cause`) is overridable via
  `options.statusMessages` so the GitHub adapter can supply specific text without the lib ever
  learning about the data source.

## Files touched

- `src/lib/autocomplete/types.ts` — UPDATE — prop-getter prop types, generic
  `AutocompleteHandlers<T>` with the getter/mouse/keyboard surface, `state.statusMessage`,
  `onSelect`/`getItemKey` now required, `statusMessages` overrides.
- `src/lib/autocomplete/useAutocomplete.ts` — UPDATE — keyboard reducers (clamp no-wrap,
  Home/End, Enter, Escape), `onItemClick`/`onItemHover`, `useId()` id scheme, the three prop
  getters, `statusMessage` derivation, highlight reset when new results arrive.
- `src/lib/autocomplete/useAutocomplete.keyboard.test.tsx` — NEW — RTL integration tests through
  a test-only harness component (input + list spreading the getters).
- `src/lib/autocomplete/useAutocomplete.test.tsx` — UPDATE — pass the now-required
  `getItemKey`/`onSelect`; initial-state assertion includes `statusMessage`.

## Key decisions

- **`statusMessage` is a derived field on `state`** (the spec's default recommendation), not a
  `getStatusMessage()` handler — derived at render time from `status`/`items.length`/
  `error.message`, never stored, with optional overrides via `options.statusMessages`. 1.3 must
  keep this shape.
- **Success message pluralizes** (`1 result` / `3 results`) rather than the literal "N results";
  overridable anyway.
- **Arrow/Home/End are consumed (preventDefault) whenever the dropdown is open, even with zero
  items** (loading/empty/error popup), so the text cursor never jumps while the popup is visible.
  Enter is consumed only when it actually selects; Escape only when open.
- **ArrowUp from no highlight goes to index 0** (clamp semantics at the start edge); the spec
  only fixes ArrowDown-from-null → 0 and clamping, so the symmetric choice is documented here.
- **Hover uses `mousemove`, not `mouseenter`**, so a list scrolling under a resting pointer does
  not steal the highlight; the handler is a no-op when the index is unchanged (no re-render spam).
- **Selection does not auto-close the dropdown** — the hook stays policy-free; what selection
  does (e.g. open a tab, close the popup) belongs to the consumer/adapter (Epic 2/1.3).
- **`close()` cancels pending work** (clears the debounce timer, aborts the in-flight fetch), so
  Escape pressed inside a debounce window can never be undone by the queued fetch reopening the
  dropdown (found by the pre-PR second-pass review, fixed test-first).
- `onItemClick` is typed `(item, index)` per the spec contract; the implementation currently only
  needs `item`.

## How it works

All key logic is one `switch` in `onKeyDown` reading the current state; highlight moves compute
`min/max`-clamped indexes and go through the same `setHighlight` used by hover. Prop getters are
plain `useCallback`s that close over the current state, so every render re-emits correct ARIA
values; consumers just spread them.

## Tests

- **Unit/integration (RTL, 23 new tests):** driven through a test-only harness that spreads the
  getters — clamping at both ends (no wrap) including N=1 and open-empty (N=0) edge cases,
  Home/End, Enter-with/without-highlight, click+hover convergence on the shared paths, Escape
  (closes, clears highlight, keeps query, focus stays on input, cancels a pending debounced
  fetch), highlight reset on new query/results, the exact §3.5 ARIA attribute set with matching
  stable ids, key-consumption rules (`preventDefault` only on consumed keys, pass-through when
  closed), and all `statusMessage` derivations + the results/error overrides.
- **Manual:** none — no shipped UI until 1.3; `MANUAL_TESTING.md` intentionally skipped per the
  story spec (behavior fully covered by the RTL harness tests).

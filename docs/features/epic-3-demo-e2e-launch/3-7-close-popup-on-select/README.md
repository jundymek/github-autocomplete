# 3.7 — Close the popup on selection

## What was built

Selecting an option now closes the combobox. Before this story, `selectItem` only
called the consumer's `onSelect(item)` and returned — it never touched `isOpen` or
`highlightedIndex`, so after Enter or a click the dropdown stayed visibly expanded
with `aria-expanded="true"` and a stale `aria-activedescendant` pointing at the
just-selected option. This was most visible in the GitHub instance, whose `onSelect`
only opens a new tab: focus returned to a still-open dropdown behind it.

The accept transition is now a durable "close + notify": the single `selectItem` path
(shared by Enter in `onKeyDown` and by `onItemClick`) cancels any pending debounce and
aborts any in-flight fetch, sets `isOpen: false` and `highlightedIndex: null` in one state
update, and then calls `onSelect(item)` exactly once. This is standard WAI-ARIA combobox
behavior and it lives entirely in the lib layer, so every `Autocomplete<T>` host — the
GitHub adapter and the country demo instance — inherits the fix with **zero adapter code**,
exactly like `clear()` (3.6).

Query, items, and status are deliberately preserved on accept, so reopen-on-focus
(Story 1.5) still re-shows the existing results without a refetch.

## Files touched

- `src/lib/autocomplete/useAutocomplete.ts` — UPDATE — `selectItem` now collapses the
  popup (`isOpen:false`, `highlightedIndex:null`) in the same handler that calls
  `onSelect(item)`. The state update is a single `setState`; `onSelect` is called from
  the handler, not from inside the updater (a reducer side effect would double-fire
  under StrictMode).
- `src/lib/autocomplete/useAutocomplete.keyboard.test.tsx` — UPDATE — hook tests: Enter
  and click accept close the popup, clear the highlight, keep `query`/`items`/`status`,
  call `onSelect` once, and collapse the ARIA (`aria-expanded=false`, no
  `aria-activedescendant`); plus a preserved-results assertion for reopen-on-focus.
- `src/lib/autocomplete/Autocomplete.test.tsx` — UPDATE — component tests: after Enter
  and after click the listbox is gone / `aria-expanded="false"`; reopen-on-focus (1.5)
  re-shows the same results with no refetch.
- `src/features/github-search/GithubAutocomplete.test.tsx` — UPDATE — adapter tests: the
  two selection tests now also assert the dropdown collapses (options gone,
  `aria-expanded="false"`) in addition to opening the new tab.
- `e2e/newtab.spec.ts` — UPDATE — the Enter and click new-tab flows now also assert the
  combobox reports collapsed (`aria-expanded="false"`, no listbox) after select.
- `docs/features/epic-3-demo-e2e-launch/3-7-close-popup-on-select/{README.md,MANUAL_TESTING.md}` — NEW.

## Key decisions

- **Cancel pending work on accept (durable close).** The first pass set only the two
  collapse fields, reasoning a settled selection has no in-flight work. The codex-rescue
  review found the gap: a new qualifying keystroke keeps the *previous* results visible and
  arms a ~300ms debounce, so a user can accept a still-shown option mid-window; the queued
  fetch would then fire and reopen the popup behind the selection. `selectItem` now calls
  `clearDebounceTimer()` + `abortInFlight()` (the same teardown `close()`/`resetToInitial()`
  use) before the collapse — harmless at a settled accept, correct in the race. It does not
  reuse `close()` itself because accept is "close + notify" and must not depend on `close()`'s
  identity, but it shares the same pending-work invariant.
- **`onSelect` stays outside the `setState` updater.** React reducers must be pure; a side
  effect there can double-fire under StrictMode. The updater only computes the closed
  state; `onSelect(item)` runs in the handler body.
- **No adapter/component behavior change.** The fix is entirely in the hook. The GitHub
  adapter and the component derive their open/expanded state from hook state, so the
  collapse is inherited for free. The adapter and component test edits only *assert* the
  corrected close — no source change in `src/features/` or `src/demo/`. That is the
  reuse/boundary proof.
- **No new props, no `closeOnSelect` flag.** Closing on accept is the correct default, not
  a configurable behavior (per the story's non-goals).

## How it works

Both Enter (`onKeyDown` Enter branch → `selectItem(items[highlightedIndex])`) and click
(`onItemClick` → `selectItem(item)`) route through the one `selectItem`. It cancels any
queued debounce and aborts any in-flight fetch, performs a single
`setState((prev) => ({ ...prev, isOpen: false, highlightedIndex: null }))`, and then
calls `onSelect(item)`. Because `getInputProps()` already derives `aria-expanded` from
`isOpen` and `aria-activedescendant` from the highlighted item, collapsing the state
collapses the ARIA with no new attribute code. `status`, `items`, and `query` are
untouched, so `openIfResults` (reopen-on-focus, 1.5) still finds a settled results state
for the still-qualifying query on the next focus.

## Tests

- **Hook** (`useAutocomplete.keyboard.test.tsx`): Enter-accept and click-accept each
  close + clear highlight + preserve `query`/`items`/`status` + call `onSelect` once +
  collapse ARIA; one test proves items/status survive so reopen-on-focus has results; one
  test proves a debounce queued at accept time is cancelled and the popup does not reopen
  behind the selection (the durable-close regression guard from the review).
- **Component** (`Autocomplete.test.tsx`): listbox gone / `aria-expanded="false"` after
  Enter and after click; reopen-on-focus re-shows the same results with no new fetch.
- **Adapter** (`GithubAutocomplete.test.tsx`): selecting by Enter and by click opens the
  new tab **and** collapses the dropdown.
- **E2E** (`e2e/newtab.spec.ts`): after Enter and after click the demo combobox reports
  collapsed; the axe scans stay clean.
- **Manual:** see MANUAL_TESTING.md — executed through a real browser against the preview
  build on both instances (GitHub + country), keyboard and mouse; all steps pass.

# 3.9 — ArrowDown/ArrowUp reopen a closed popup with retained results

## What was built

Keyboard recovery after Escape. Escape closes the popup but keeps DOM focus on the input
(activedescendant technique), so the focus-only reopen path from Story 1.5 could never fire again —
the results were unreachable from the keyboard without editing the query (and burning a new GitHub
request). Now, per the WAI-ARIA APG combobox pattern, ArrowDown on a closed combobox with settled
results reopens the popup and highlights the first option; ArrowUp reopens it and highlights the
last. Settled `empty`/`error` states reopen too (showing their message, no highlight). No refetch,
no new debounce — the retained results are simply shown again.

## Files touched

- `src/lib/autocomplete/useAutocomplete.ts` — UPDATE — extracted the 1.5 reopen condition into a
  single shared `canReopen(state, minChars)` predicate; added a closed-popup ArrowDown/ArrowUp
  branch in `onKeyDown` that consumes the key and opens + highlights in one `setState`.
- `src/lib/autocomplete/useAutocomplete.keyboard.test.tsx` — UPDATE — 9 hook tests: reopen with
  first/last highlight, empty/error reopen with no highlight, unconsumed arrows for
  idle/loading/below-threshold, Enter stays native, ARIA reflects the reopen.
- `src/lib/autocomplete/Autocomplete.reopen.test.tsx` — UPDATE — RTL: Escape → ArrowDown re-shows
  the same options with an unchanged fetch count; Esc → ArrowDown → Enter selects.
- `e2e/reopen.spec.ts` — UPDATE — extended the reopen flow with the keyboard path: Escape →
  ArrowDown re-expands the same listbox with zero new network requests, first option highlighted.

`types.ts`, `Autocomplete.tsx`, `src/features/`, and `src/demo/` are unchanged — both demo
instances inherit the fix through the hook.

## Key decisions

- **Shared guard, option (a) from the spec's Dev Notes:** the reopen condition
  (`closed + query ≥ minChars + status ∈ {success, empty, error}`) lives in one module-level
  predicate used by both `openIfResults` (focus path, highlight untouched) and the new keyboard
  branch. One reopen definition, zero duplication.
- **ArrowDown/ArrowUp only.** Enter stays native (form submit) per the APG and the Story 1.2
  pass-through contract; Home/End stay text-caret keys on a closed popup. No Alt+ArrowDown, no
  click-to-toggle (spec Non-goals).
- **Consume only when reopening.** When the guard fails (idle, loading, below-threshold), the
  arrows are not `preventDefault()`ed — native caret movement is preserved.
- **Open + highlight in a single `setState`** so the popup never paints unhighlighted and
  `aria-activedescendant` cannot lag a frame.

## How it works

`onKeyDown`'s closed-popup branch checks `canReopen` synchronously from the closure state. On
ArrowDown it opens with `highlightedIndex: 0`; on ArrowUp with the last index; with zero retained
items (empty/error) with `null`. `aria-expanded`/`aria-activedescendant` are derived from state in
`getInputProps()`, and the live-region message re-derives on open, so no ARIA code changed.

## Tests

- Unit/integration: hook-level reopen matrix (settled × key × highlight, no-op states, no-refetch
  proof via `fetchSuggestions` call counts, ARIA assertions) and component-level Escape →
  ArrowDown → Enter loop.
- E2E: `e2e/reopen.spec.ts` counts intercepted requests across search → Escape → ArrowDown; the
  axe suite stays clean.
- Manual: see MANUAL_TESTING.md.

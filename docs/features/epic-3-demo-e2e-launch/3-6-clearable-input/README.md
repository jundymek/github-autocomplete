# 3.6 — Clearable input (a "×" button that resets the combobox)

## What was built

A generic clear ("×") affordance in the reusable lib layer, so every `Autocomplete<T>` instance —
and any future adapter — gets one-action query reset for free (mouse/touch users especially, who
previously had to select the text and delete it).

- **Hook:** `handlers.clear()` on `useAutocomplete<T>` — resets the hook to its initial state
  (empties the query, cancels the pending debounce, aborts any in-flight fetch, closes the popup,
  drops items/highlight/error). It delegates to the existing `onInputChange('')` reset path, so
  there is exactly one reset code path.
- **Component:** a `<button type="button">` in the input's trailing lane, visible only when
  `query.length > 0 && status !== 'loading'` (mutually exclusive with the loading dots — one lane,
  no layout shift). Clicking it clears the query, returns focus to the input, and resets the
  below-threshold hint dismissal so the next typing session behaves like a fresh mount.
- **New prop:** `clearLabel?: string` (default `'Clear'`) → the button's `aria-label`.

Escape semantics are unchanged: Escape still closes the popup and keeps the query. The button is the
*emptying* affordance; the two do not overlap in behavior.

## Files touched

- `src/lib/autocomplete/useAutocomplete.ts` — UPDATE — added `clear()` (delegates to the
  `onInputChange('')` reset branch) and exposed it on the returned `handlers`.
- `src/lib/autocomplete/types.ts` — UPDATE — documented `clear` on `AutocompleteHandlers<T>` and
  `clearLabel` on `AutocompleteProps<T>`.
- `src/lib/autocomplete/Autocomplete.tsx` — UPDATE — conditional clear button (inline-SVG glyph,
  no icon dependency), `clearLabel` prop with default, `clearInput` handler (clear + refocus +
  `setHintDismissedFor(null)`).
- `src/lib/autocomplete/Autocomplete.module.css` — UPDATE — `.clear` styling in the trailing lane:
  muted glyph (`--ac-color-text-muted`), accent on hover/focus-visible (`--ac-color-accent`),
  focus ring consistent with the input.
- `src/lib/autocomplete/useAutocomplete.test.tsx` — UPDATE — `clear()` cases (success, loading with
  late-resolve no-commit, error, below-threshold, pending-debounce cancellation).
- `src/lib/autocomplete/Autocomplete.test.tsx` — UPDATE — button behavior (absent when empty,
  appears on type, hidden while loading, click clears + closes + refocuses, `clearLabel` default and
  override, tab order input → button, inside-root outside-press guarantee, hint re-shown after clear).
- `README.md` — UPDATE — `clearLabel` prop row in the Component API table; `clear` in the hook
  handlers list.

**No `src/features/`, `src/demo/`, or `e2e/` file was edited** — the reuse proof. Both demo
instances (GitHub adapter + country panel) inherit the button with zero adapter code.

## Key decisions

- **`clear()` delegates to `onInputChange('')`.** An empty string is below any `minChars`, so it
  takes the existing below-threshold branch, which already performs the exact reset the story
  requires (clear debounce → abort in-flight → set idle/empty/closed). One reset path, zero
  duplication, and the existing stale-response controller guard keeps a late fetch from committing.
- **Button hidden during loading, not stacked with the dots.** One 40 px trailing lane already
  reserved by the input's right inset; making the button and dots mutually exclusive avoids a wider
  inset (which would shift layout when loading toggles) or overlap. Loading is transient; the button
  reappears the instant the fetch settles. A user who wants to abort a slow search still has Escape.
- **Inline SVG glyph, no icon package** (AR-1). No new `--ac-*` tokens either — the existing
  `--ac-color-text-muted` / `--ac-color-accent` are sufficient, so the documented theming surface
  is unchanged.
- **Focus return** mirrors the existing `retry()` pattern: after a pointer clear the button's job is
  done, so focus goes back to the input to keep the user in the typing flow (WAI-ARIA combobox
  anchor expectation).
- **No `onClear` callback prop.** No host needs to observe clearing today; the state change is
  observable via the controlled behavior. Deferred until a real consumer asks.

## How it works

The button lives in the component root subtree (not the portal), so it exists regardless of popup
state and the outside-press dismissal listener treats a press on it as "inside" (it short-circuits
for targets inside `rootRef`) — pressing it clears rather than racing the close path. The reset
itself flows entirely through the hook (§3.4): the component calls `handlers.clear()` and never
mutates hook state directly.

## Tests

- **Hook (`useAutocomplete.test.tsx`):** `clear()` from `success`, from `loading` (asserts the
  in-flight fetch is aborted and a late resolve commits nothing), from `error`, from a
  below-threshold query, and that a pending qualifying-query debounce is cancelled — all land in the
  exact initial state.
- **Component (`Autocomplete.test.tsx`):** button absent when the query is empty; appears once the
  query has content; hidden while loading (dots visible instead) and back after settle; click empties
  the input, closes the popup and moves focus back to the input; `aria-label` defaults to `Clear`
  and follows `clearLabel`; real `type="button"` in natural tab order after the input; lives inside
  the root so a pointer press on it never triggers the outside-close path first; the below-threshold
  hint is shown again for a fresh query after clearing.
- **E2E:** no new spec (per story non-goal). The existing axe scan already runs against the
  open-with-results state; it stays clean with the new button present.
- **Manual:** see [MANUAL_TESTING.md](MANUAL_TESTING.md) — executed on both demo instances; the
  country panel confirms the button restyles to the teal `--ac-color-accent` override purely via
  tokens (no seam pierced).

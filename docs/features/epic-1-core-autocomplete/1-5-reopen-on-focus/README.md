# 1.5 — Reopen-on-focus for the `Autocomplete<T>` dropdown (retained results, no refetch)

## What was built

A follow-up to Story 1.4. The dropdown already closes on Escape, selection, and outside-click, all
keeping the query in the input — but there was **no way to bring the results back**. Focusing an
input that still read `jun` (a qualifying query whose results were already fetched) only placed a
caret; to see the results again the user had to edit the text, which fired a **new** GitHub request.

Now, focusing (click or Tab) a **closed** input whose current qualifying query already has settled
results reopens the dropdown with those existing results and **fires no new request**. The behavior
lives in the hook (which owns `isOpen` and the state machine); the component just wires the hook's
`onFocus` alongside its existing focus flag.

## Files touched

- `src/lib/autocomplete/useAutocomplete.ts` — UPDATE — new `openIfResults` callback and `onFocus` on
  `getInputProps()`. Sets `isOpen: true` only when the dropdown is closed, the query is `>= minChars`,
  and `status` is a settled results state (`success`/`empty`/`error`). Never fetches, never touches
  the debounce timer or `highlightedIndex`.
- `src/lib/autocomplete/types.ts` — UPDATE — added `onFocus` to `AutocompleteInputProps`.
- `src/lib/autocomplete/Autocomplete.tsx` — UPDATE — the input's `onFocus` now calls the hook's
  `inputProps.onFocus(event)` **and** the existing `setIsFocused(true)` (drives the below-threshold
  hint). No results/`isOpen` logic added to the component.
- `src/lib/autocomplete/useAutocomplete.test.tsx` — UPDATE — hook unit tests for the reopen guard.
- `src/lib/autocomplete/Autocomplete.reopen.test.tsx` — NEW — end-to-end reopen tests.
- 1.3 feature docs — UPDATE — record reopen-on-focus alongside the dismissal paths.

## Key decisions

- **Behavior in the hook, not the component (AR-3/AR-4).** The hook owns `isOpen`, `status`, `items`
  and `query`, so it is the only place that can decide "reopen with existing results". The component
  stays thin — it just spreads the hook's `onFocus` and keeps its own focus flag.
- **No refetch on reopen.** The whole point is to avoid a redundant GitHub call (unauthenticated
  rate limits) when the user returns to results they already have. `openIfResults` flips only
  `isOpen`; it never calls `fetchSuggestions` or creates an `AbortController`. Proven by asserting
  the fetch mock's call count is unchanged across a close→refocus cycle.
- **Tight guard so focus never opens the wrong thing.** Reopen is refused when:
  - `status === 'idle'` — nothing was ever fetched for this query (fresh mount, or reset after the
    query dropped below the threshold);
  - `query.length < minChars` — the results listbox is never the right surface; the component's
    focus-driven below-threshold **hint** still shows exactly as before;
  - `status === 'loading'` — a fetch is already in flight and will open on resolve;
  - `isOpen === true` — already open; focus is a no-op (no highlight change, no refetch).
- **Compose focus, don't replace it.** The component already had `onFocus={() => setIsFocused(true)}`
  for the hint. The new wiring runs **both** handlers so neither the hint nor the reopen is lost.
- **Plays nicely with Story 1.4.** Clicking into the input is inside the component root, so 1.4's
  outside-`pointerdown` close does not fire; focus then reopens. Net effect of clicking into a closed
  input with results is a clean "reopen", with no open-then-close flicker (covered by a test).

## How it works

`close()` keeps `query`, `status` and `items` and only sets `isOpen: false` — so after a close the
hook still holds the last results; they are simply not rendered while `isOpen` is false.
`openIfResults` (wired to the input's `onFocus`) re-flips `isOpen` to `true` when a settled results
state exists for the current qualifying query. Because it goes nowhere near `startFetch`, no request
is made.

## Tests

- Hook unit (`useAutocomplete.test.tsx`): reopen a closed `success` dropdown on focus without
  refetch; `empty` and `error` states also reopen without refetch; no-op on `idle`, below-`minChars`,
  `loading`, and already-open (no second fetch, highlight untouched).
- Component/RTL (`Autocomplete.reopen.test.tsx`): type ≥3 chars → settle → Escape closes → refocus
  reopens the same options with `aria-expanded="true"`, query retained, and the fetch mock call count
  unchanged; fresh/idle focus opens nothing; below-threshold focus shows the hint but not the
  listbox; reopen composes with the 1.4 outside-close without flicker.
- Full lib suite (129 tests) green, including all Story 1.3/1.4 tests unchanged.
- Manual: see [MANUAL_TESTING.md](./MANUAL_TESTING.md) — also verified end-to-end in a real browser
  against the 3.1 demo (both GitHub and country instances): close → refocus reopens with retained
  results and **zero** new network requests (confirmed by counting `api.github.com` calls).

---
baseline_commit: 687c223f4d0e76a5793fd861641612ab426d176d
---

# Story 1.5: Reopen-on-focus for the `Autocomplete<T>` dropdown (retained results, no refetch)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user of any `Autocomplete<T>` instance,
I want the results dropdown to reappear when I click (or tab) back into an input that still holds my
last query and its already-fetched results,
so that I can resume browsing my results without retyping and without the component silently showing
me an empty caret (FR-7 continuity; AR-3 hook-owned state machine; WAI-ARIA combobox re-expansion).

## Background (defect origin)

This is a **follow-up bug-fix** for a gap surfaced during manual testing of the Story 3.1 demo,
directly after Story 1.4 (outside-click dismissal). The dropdown closes on `Escape`, on selection,
and — after 1.4 — on an outside pointer press. All three **retain the query in the input** (they
never clear it). But there is **no way to reopen** the results after closing: focusing back into an
input that still shows `jun` (a qualifying query whose results were already fetched) only places a
caret — the dropdown stays closed and nothing is shown, because closing set `isOpen: false` and only
typing (`onInputChange`) or the below-threshold focus-hint can reopen the popup.

Observed: type `jun` → results open → close (Escape or outside click) → the input still reads `jun`
→ click back into the input → caret blinks, **no dropdown, no results**. To see the results again the
user must edit the text (e.g. delete and retype a character), which also fires a **new** GitHub
request. On the live GitHub instance that needlessly consumes the unauthenticated rate limit.

The fix belongs in the **generic lib** — the hook owns the state machine and `isOpen` (AR-3), so
focus must be able to re-open the dropdown when results for the current query already exist. It
affects **both** demo instances (GitHub + country), so it is a lib-contract fix, not a demo special
case (CLAUDE.md: "fix the component's genericity, don't special-case the demo").
[Source: docs/implementation-artifacts/1-4-outside-click-dismiss.md; src/lib/autocomplete/useAutocomplete.ts (`close`, `onInputChange`, `getInputProps`); src/lib/autocomplete/Autocomplete.tsx (`onFocus`); observed in the 3.1 demo]

## Acceptance Criteria

1. **Focusing a closed input with existing results reopens the dropdown — no refetch.** When the
   input holds a query that is at or above `minChars` **and** the hook already has a settled result
   state for that query (`status` is `success`, `empty`, or `error`) but the dropdown is closed
   (`isOpen === false`), focusing the input (click or Tab) sets `isOpen: true` and re-renders the
   **existing** results/empty/error popup. **No new `fetchSuggestions` call is made** and **no new
   `AbortController` is created** — the previously fetched `items`/error are shown as-is. The query
   text is unchanged.
2. **No spurious open when there is nothing to show.** Focus must **not** open the results listbox
   when the hook has no settled results for the current query: specifically when `status === 'idle'`
   (never fetched, e.g. a fresh mount with an empty or below-threshold input), or the query is below
   `minChars`. In the below-`minChars` case the existing component-owned below-threshold **hint**
   still shows on focus exactly as today (that path is unchanged); the results listbox does not open.
3. **A stale query does not reopen stale results.** If the input's current text no longer matches the
   query the stored results belong to, focus must not reopen those results. Reopen is allowed only
   when the stored result state corresponds to the input's current query (i.e. the hook's `state.query`
   equals the query the `items`/status were produced for). This prevents showing `jun`'s results over
   a now-different input value. (In practice the hook only stores results for the current `state.query`,
   so the guard is: reopen only when `status` is a settled results state for the current query.)
4. **Reopen is idempotent and fires no request while already open or loading.** If the dropdown is
   already open, or a fetch is in flight (`status === 'loading'`), focus/refocus is a no-op for the
   open state — it never starts a second fetch, never resets the debounce, and never changes
   `highlightedIndex`. Re-focusing an already-open combobox does nothing observable.
5. **Existing dismissal + typing paths are unchanged (no regression).** `Escape`, selection, and the
   Story 1.4 outside-pointer press still close and retain the query; typing still debounces, aborts,
   and fetches through `onInputChange`; keyboard navigation (Arrow/Home/End/Enter) is untouched. In
   particular, reopen-on-focus must not fight Story 1.4: clicking **into** the input is inside the
   component root, so the 1.4 outside-close does not fire, and focus reopens the dropdown — the net
   effect of a click into the input is "reopen", not "open then immediately close".
6. **Behavior lives in the hook; the component stays thin (AR-3/AR-4).** The reopen decision is
   implemented in `useAutocomplete` (it owns `isOpen`, `status`, `items`, and `query`), exposed via
   the input prop getter so the component wires it declaratively (e.g. `getInputProps().onFocus`),
   with **no** results/state logic added to `Autocomplete.tsx`. No data-source knowledge, no
   app/`features`/demo imports, no new runtime dependency. The `no-restricted-imports` boundary
   (Story 0.1) stays green, the lib type-checks in isolation, and the public props surface is
   unchanged (no new required prop).
7. **Tests prove all of the above (FR-18).** Hook unit tests (`useAutocomplete.test.ts`) assert:
   (a) after a settled `success` fetch then `close()`, calling the focus handler sets `isOpen: true`
   and does **not** call `fetchSuggestions` again; (b) focus with `status === 'idle'` does not open
   the listbox and fires no fetch; (c) focus with a below-`minChars` query does not open the results
   listbox and fires no fetch; (d) focus while `loading` or already open is a no-op (no second fetch,
   debounce untouched); (e) `empty` and `error` result states also reopen on focus without refetch.
   Component/RTL tests (`Autocomplete.test.tsx` or a focused new file) assert the end-to-end flow:
   type ≥3 chars → settle → close (Escape) → refocus reopens the same options with no new request;
   and that the below-threshold hint focus behavior and Story 1.3/1.4 tests continue to pass
   unchanged.

## Tasks / Subtasks

- [x] Task 1 — Add reopen-on-focus to the hook (AC: 1, 2, 3, 4, 6)
  - [x] In `src/lib/autocomplete/useAutocomplete.ts`, add an `onFocus` handler (e.g. `openIfResults`
        / `reopenOnFocus`) that, using current `state`, sets `isOpen: true` **only when** `!isOpen`
        **and** `status` is one of `success | empty | error` **and** `query.length >= minChars`.
        Otherwise it is a no-op. It must **not** call `startFetch`, must **not** create an
        `AbortController`, must **not** touch the debounce timer, and must **not** change
        `highlightedIndex` (results reopen with nothing pre-highlighted, exactly as after a fetch).
  - [x] Do not reopen when `status === 'idle'` (never fetched) or `status === 'loading'` (a fetch is
        already in flight and will open on resolve) or when `query.length < minChars`. Below the
        threshold the results listbox stays closed; the component's existing focus-driven
        below-threshold hint is unaffected (it is component-owned and keyed off `isFocused`).
  - [x] Expose the handler on the input prop getter: add `onFocus` to `AutocompleteInputProps` (in
        `types.ts`) and return it from `getInputProps()` so the component can spread it. Keep the
        change minimal and consistent with the existing `onChange`/`onKeyDown` prop-getter pattern.
- [x] Task 2 — Wire the component to the hook's focus handler (AC: 5, 6)
  - [x] In `src/lib/autocomplete/Autocomplete.tsx`, route the input's focus through the hook. The
        component already has its own `onFocus={() => setIsFocused(true)}` for the below-threshold
        hint — compose the two so **both** run: keep `setIsFocused(true)` (drives the hint) **and**
        call the hook's `inputProps.onFocus?.(event)` (drives results reopen). Do not drop or
        reorder the existing focus behavior. Add no results/`isOpen` logic in the component.
  - [x] Confirm the composition with Story 1.4: because a click into the input targets the component
        root, the 1.4 document `pointerdown` outside-close does not fire; focus then reopens. Verify
        there is no open→close flicker (add a test if the ordering is non-obvious).
- [x] Task 3 — Tests (AC: 7)
  - [x] Extend `src/lib/autocomplete/useAutocomplete.test.ts`: settle a `success` fetch, call
        `close()`, then invoke `getInputProps().onFocus` (or the exposed handler) and assert
        `state.isOpen === true` with `fetchSuggestions` **not** called again and no new controller.
  - [x] Assert the no-op cases: focus with `idle` (fresh) → stays closed, no fetch; focus with a
        below-`minChars` query → results listbox stays closed, no fetch; focus while `loading` or
        already open → no second fetch, debounce/`highlightedIndex` untouched.
  - [x] Assert `empty` and `error` states reopen on focus without refetch.
  - [x] Extend `src/lib/autocomplete/Autocomplete.test.tsx` (or add a focused
        `Autocomplete.reopen.test.tsx`): type ≥3 chars → settle → Escape closes → refocus the input →
        the same options reappear, `aria-expanded="true"`, and `fetchSuggestions` call count is
        unchanged. Confirm the below-threshold hint focus path and the Story 1.3/1.4 tests still pass.
- [x] Task 4 — Docs
  - [x] Update the Story 1.3 feature docs
        (`docs/features/epic-1-core-autocomplete/1-3-autocomplete-component/{README.md,MANUAL_TESTING.md}`)
        to record reopen-on-focus alongside the dismissal paths: focusing a closed input that still
        holds a qualifying query with results reopens the dropdown with no new request.
  - [x] Ship the story's own doc folder per CLAUDE.md:
        `docs/features/epic-1-core-autocomplete/1-5-reopen-on-focus/` with `README.md` (what changed,
        why, the hook-owns-`isOpen` and no-refetch decisions, and the focus-composition with the
        below-threshold hint) and `MANUAL_TESTING.md` (type → close → refocus reopens with retained
        results and no network call; idle/below-threshold focus does not open results).
- [x] Task 5 — Verify (AC: all)
  - [x] `pnpm lint && pnpm typecheck && pnpm test` all green (+ `pnpm test:e2e` if present). Manually
        verify in `pnpm dev` on the 3.1 demo: type `jun` in the GitHub instance, close, click back →
        results reappear with **no** new network request (check the Network panel); repeat on the
        country instance. Confirm idle focus and below-threshold focus behave as before.

## Dev Notes

**The exact seam (read before coding).** The hook already stores everything needed; this is a small,
additive change — one new focus handler in the hook plus a one-line composition in the component.
- `useAutocomplete` state is `{ query, status, items, highlightedIndex, isOpen, error? }`. `close()`
  sets `isOpen: false, highlightedIndex: null` while **keeping** `query`, `status`, and `items`. So
  after a close the hook still holds the last results — they are simply not rendered because
  `isOpen` is false and the component only renders options when `state.isOpen` is true.
  [Source: src/lib/autocomplete/useAutocomplete.ts (`createInitialState`, `close`)]
- `onInputChange` is the **only** current path that sets `isOpen: true` (via `startFetch`), and it
  always fetches. Reopen must **not** go through it. Add a separate, fetch-free handler that flips
  only `isOpen` when a settled results state already exists for the current qualifying query.
  [Source: src/lib/autocomplete/useAutocomplete.ts (`onInputChange`, `startFetch`)]
- `getInputProps()` returns `{ role, aria-*, value, onChange, onKeyDown }`. Add `onFocus` here so
  wiring stays declarative and ARIA cannot be mis-wired. `AutocompleteInputProps` in `types.ts` is
  the shape to extend. [Source: src/lib/autocomplete/useAutocomplete.ts (`getInputProps`);
  src/lib/autocomplete/types.ts (`AutocompleteInputProps`)]

**Why the guard is `status ∈ {success, empty, error}` and `query.length >= minChars`.**
- `idle` means "nothing fetched for this query" (initial state, or reset when the query drops below
  the threshold in `onInputChange`). Reopening on `idle` would show an empty listbox for no reason.
- `loading` means a fetch is already in flight; it will open the dropdown itself on resolve. Focus
  during loading must not start a second fetch or force-open.
- Below `minChars`, the results listbox is never the right surface — the component's
  below-threshold **hint** (focus-driven, `isFocused && 0 < len < minChars && not dismissed`) is,
  and it already works on focus. The hook's reopen must stay clear of that path.
[Source: src/lib/autocomplete/useAutocomplete.ts (`onInputChange` idle-reset below threshold);
src/lib/autocomplete/Autocomplete.tsx (`belowThreshold`, `onFocus`)]

**Compose focus, don't replace it (AC 5/6).** The component's input currently has
`onFocus={() => setIsFocused(true)}` for the hint. Spread the hook's `getInputProps()` (which will
now include `onFocus`) and ensure the component's own focus side-effect still runs — e.g. wrap both
in a single `onFocus` that calls `inputProps.onFocus?.(event)` and `setIsFocused(true)`. Never let
one clobber the other. [Source: src/lib/autocomplete/Autocomplete.tsx (input element `onFocus`,
`getInputProps` spread)]

**Interaction with Story 1.4 (must not fight).** 1.4 closes the dropdown on a document `pointerdown`
that is outside both the root and the popup. A click **into the input** is inside the root, so 1.4's
handler returns early and does not close; this story's focus handler then reopens. Net result of
clicking into a closed input with results: the dropdown reopens (no open-then-close flicker). If a
test shows any ordering issue, prefer fixing the guard/ordering over adding timeouts.
[Source: docs/implementation-artifacts/1-4-outside-click-dismiss.md; src/lib/autocomplete/Autocomplete.tsx]

**No new request on reopen (rate limits).** The whole point is to avoid a redundant GitHub call when
the user is just returning to results they already have. Reopen must never call `fetchSuggestions`.
This is verifiable by asserting the `fetchSuggestions` mock's call count is unchanged across a
close→refocus cycle. [Source: docs/planning-artifacts/architecture.md#AR-3 (stale-request handling,
threshold); CLAUDE.md#Stack (unauthenticated by default)]

**Scope guard — do only this.** This story is *only* reopen-on-focus with retained results. Do not
add refetch-on-focus, click-to-toggle (focus should not also close an open dropdown), a "stale after
N seconds → refetch" policy, focus-trap, or any styling changes. Keep the state machine's existing
transitions intact; the single new transition is `closed-with-results + focus → open`. Any change to
`onInputChange`, selection, or ARIA wiring is out of scope. [Source: CLAUDE.md#Architecture boundary;
docs/planning-artifacts/architecture.md#AR-3/#AR-4]

**No new runtime dependency (AR-1).** Refs/handlers only; no library. [Source: CLAUDE.md#Stack;
architecture.md#AR-1]

**Branch & PR.** `story/1-5-reopen-on-focus` → `master`, squash. Commit e.g.
`feat(1.5): reopen autocomplete dropdown on focus when results already exist`. **No AI attribution /
no `Co-Authored-By`.** Run the mandatory pre-PR review gate (security review + codex-rescue
second-pass + verified triage), re-run `pnpm lint && pnpm typecheck && pnpm test` after any fix,
then PR. [Source: CLAUDE.md#Working rules / #Story pipeline]

### Project Structure Notes

- Files this story touches:
  - `src/lib/autocomplete/useAutocomplete.ts` — UPDATE (add the reopen-on-focus handler; expose it
    on `getInputProps`). This is the intended home for the behavior per AR-3.
  - `src/lib/autocomplete/types.ts` — UPDATE (add `onFocus` to `AutocompleteInputProps`).
  - `src/lib/autocomplete/Autocomplete.tsx` — UPDATE (compose the hook's `onFocus` with the existing
    `setIsFocused(true)`; no results logic added).
  - `src/lib/autocomplete/useAutocomplete.test.ts` — UPDATE — hook unit tests for the reopen guard.
  - `src/lib/autocomplete/Autocomplete.test.tsx` — UPDATE (or add `Autocomplete.reopen.test.tsx`) —
    end-to-end reopen test.
  - Docs: update `docs/features/epic-1-core-autocomplete/1-3-autocomplete-component/*` and add
    `docs/features/epic-1-core-autocomplete/1-5-reopen-on-focus/{README.md,MANUAL_TESTING.md}`.
- Tests are co-located `*.test.ts(x)` (Vitest + RTL). Hook tests stub `fetchSuggestions` directly;
  component tests stub it too (no MSW at the lib layer, per 1.3).
  [Source: docs/planning-artifacts/architecture.md#3.1 / #3.6;
  docs/implementation-artifacts/1-3-autocomplete-component.md#Dev Notes]

### References

- [Source: docs/implementation-artifacts/1-4-outside-click-dismiss.md — the prior dismissal story; query-retention contract this builds on]
- [Source: docs/implementation-artifacts/1-1-useautocomplete-hook.md — hook state machine, debounce, threshold, cancellation]
- [Source: docs/implementation-artifacts/1-3-autocomplete-component.md — component rendering, below-threshold hint, focus wiring]
- [Source: src/lib/autocomplete/useAutocomplete.ts — `close`, `onInputChange`, `startFetch`, `getInputProps`, state shape]
- [Source: src/lib/autocomplete/types.ts — `AutocompleteInputProps`]
- [Source: src/lib/autocomplete/Autocomplete.tsx — input `onFocus`, `belowThreshold`, `getInputProps` spread]
- [Source: docs/planning-artifacts/architecture.md#AR-3 (hook owns state machine + isOpen) / #AR-4 (thin component) / #NFR-5 (self-contained)]
- [Source: CLAUDE.md#Architecture boundary / #Working rules / #Story pipeline / #Documentation deliverables]
- [Source: WAI-ARIA Authoring Practices 1.2 — Combobox pattern, popup expansion on focus]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context)

### Debug Log References

- Full suite green: `pnpm lint && pnpm typecheck && pnpm test` → 15 files / 200 tests passed; `pnpm test:e2e` → 1 passed.
- New/updated lib tests: `useAutocomplete.test.tsx` reopen block (7 hook cases) + `Autocomplete.reopen.test.tsx` (4 component cases); full lib suite 6 files / 129 tests.
- Browser verification against the live 3.1 demo, counting `api.github.com` requests: type `vuejs` →
  results (2 requests, 200/200) → Escape closes, query retained → refocus reopens the same 50 options
  with **zero** new requests. Country instance reopened identically. Note: an early probe with a
  hammered `react` query showed no reopen — traced to the fetch still being `loading` when Escape hit
  (so `close()` left `status: 'loading'` → guard correctly refuses to reopen, AC 4), not a bug;
  fresh-query runs reopen cleanly on both instances.

### Completion Notes List

- Implemented reopen-on-focus in the hook (`openIfResults`, exposed via `getInputProps().onFocus`);
  the component composes it with its existing `setIsFocused(true)`. No new runtime dependency, public
  props surface adds only the optional-by-nature `onFocus` on the input-prop-getter shape (spread
  verbatim; no new component prop). `no-restricted-imports` boundary stays green (lint passes).
- Guard: reopen only when `!isOpen && query.length >= minChars && status ∈ {success, empty, error}`.
  Idle, below-threshold, loading, and already-open are all no-ops — verified by unit tests.
- No refetch on reopen: `openIfResults` flips only `isOpen`; never calls `startFetch`/creates a
  controller. Proven by unchanged `fetchSuggestions` call count across close→refocus (unit + browser).
- Composes with Story 1.4 without flicker (click into input is inside root → 1.4 outside-close does
  not fire; focus reopens). Covered by a component test.

### File List

- `src/lib/autocomplete/useAutocomplete.ts` — UPDATE — `openIfResults` callback + `onFocus` on `getInputProps`.
- `src/lib/autocomplete/types.ts` — UPDATE — added `onFocus` to `AutocompleteInputProps`.
- `src/lib/autocomplete/Autocomplete.tsx` — UPDATE — compose hook `onFocus` with `setIsFocused(true)`.
- `src/lib/autocomplete/useAutocomplete.test.tsx` — UPDATE — reopen-on-focus hook unit tests.
- `src/lib/autocomplete/Autocomplete.reopen.test.tsx` — NEW — end-to-end reopen tests.
- `docs/features/epic-1-core-autocomplete/1-3-autocomplete-component/README.md` — UPDATE — reopen note.
- `docs/features/epic-1-core-autocomplete/1-3-autocomplete-component/MANUAL_TESTING.md` — UPDATE — reopen manual step.
- `docs/features/epic-1-core-autocomplete/1-5-reopen-on-focus/README.md` — NEW — story docs.
- `docs/features/epic-1-core-autocomplete/1-5-reopen-on-focus/MANUAL_TESTING.md` — NEW — story manual testing.
- `docs/implementation-artifacts/1-5-reopen-on-focus.md` — UPDATE — baseline_commit, task checkboxes, Dev Agent Record, status.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-10 | 0.1 | Story drafted as a follow-up to Story 1.4: reopen the dropdown on focus when results for the current query already exist, without refetching. Found during Story 3.1 demo manual testing (closing then clicking back showed an empty caret). | Łukasz (via BMAD create-story) |
| 2026-07-10 | 1.0 | Implemented reopen-on-focus in the hook (`openIfResults` + `onFocus` prop-getter), composed in the component, added hook + component tests, updated 1.3 + 1.5 docs. All checks green; browser-verified no-refetch on both demo instances. | Amelia (Dev) |

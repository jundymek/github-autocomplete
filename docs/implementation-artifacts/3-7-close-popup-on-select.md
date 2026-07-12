---
baseline_commit: b8ae32ce7be796cc9bcde2606b6624095034bdc4
---

# Story 3.7: Close the popup on selection — one "accept" path that dismisses the dropdown

Status: draft

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user of any `Autocomplete<T>` instance,
I want the dropdown to close (and the highlight to clear) the moment I select an option — by Enter
or by click,
so that the combobox does not stay visibly expanded with a stale `aria-activedescendant` after a
choice is made, which is the standard WAI-ARIA combobox behavior and what assistive technology
announces as "collapsed" on accept (task.md keyboard requirement; AR-4 component surface; NFR-1/§3.5
ARIA correctness).

## Background (why this follow-up exists)

An independent senior review of the delivered implementation (2026-07-12, over commit `b8ae32c`)
found that selection is the one combobox transition the hook does **not** own end-to-end. Today
`selectItem` calls only `onSelect(item)` and returns; it never sets `isOpen: false` or resets
`highlightedIndex`. Consequences:

- After Enter or click, `state.isOpen` stays `true` and the input keeps `aria-expanded="true"` with
  a live `aria-activedescendant` pointing at the just-selected (now stale) option.
- This is most visible in the GitHub adapter, whose `onSelect` only calls `window.open(...)` — the
  focus returns to the still-open dropdown showing the previous results.
- The country demo instance masks it slightly (selection there is also just an observable no-op),
  but the underlying contract gap is the same.

The fix belongs in the lib layer, in the single selection path both Enter and click already route
through (§3.4 — "all state transitions flow through the hook"). It must NOT leak into adapters: a
correct accept transition is generic combobox behavior every `Autocomplete<T>` host inherits for
free, exactly like `clear()` (Story 3.6).
[Source: independent review 2026-07-12; docs/planning-artifacts/architecture.md#AR-4/#3.4/#3.5;
src/lib/autocomplete/useAutocomplete.ts (`selectItem`, `getInputProps` ARIA);
docs/implementation-artifacts/1-2-keyboard-navigation-and-aria.md (Escape-closes contract this
mirrors); CLAUDE.md#Architecture boundary]

## Acceptance Criteria

1. **Selection closes the popup and clears the highlight, via one path (UPDATE `useAutocomplete.ts`).**
   The single `selectItem(item)` path (already shared by Enter in `onKeyDown` and by `onItemClick`)
   sets `isOpen: false` and `highlightedIndex: null` in the **same** state update in which it hands
   the item to the consumer's `onSelect`. Order: the popup-closing state transition and the
   `onSelect(item)` call are both performed; `onSelect` must still receive the selected item exactly
   once. Do NOT duplicate the close logic — reuse/extend the existing single selection path so there
   remains exactly one place that defines "accept".
2. **The query is preserved on accept.** Selecting keeps `state.query` unchanged (a user who selects
   then refocuses can see/edit what they searched). Only `isOpen` and `highlightedIndex` change;
   `status`, `items`, and `query` are untouched. (Contrast with `clear()`, which discards the query,
   and `close()`, which already closes without discarding — selection is "close + notify".)
3. **ARIA reflects the collapse (verify, do not re-wire).** Because `getInputProps()` derives
   `aria-expanded` from `isOpen` and `aria-activedescendant` from the highlight, closing via AC 1
   makes `aria-expanded` become `false` and `aria-activedescendant` become `undefined` with **no
   new ARIA wiring** — assert this in a test rather than adding attribute code.
4. **Interaction consistency.** Enter on the highlighted option and a pointer click on an option
   produce identical post-select state (both close, both clear the highlight, both call `onSelect`
   once) — they already share `selectItem`, so this holds structurally; assert it for both entry
   points.
5. **Reopen-on-focus still works afterwards (no regression to Story 1.5).** After an accept closes
   the popup, refocusing the input with a still-qualifying settled query reopens the existing results
   without a refetch (the `openIfResults` path is unchanged; `status` and `items` survive accept per
   AC 2, so its guard still passes). Confirm 1.5 behavior is intact.
6. **Escape/close/clear semantics are unchanged.** This story only adds the missing close to the
   *accept* transition. `Escape` (close, keep query), outside-press dismissal (1.4), `close()`, and
   `clear()` (3.6) keep their current, tested behavior. No test for those may need changing except
   where it incidentally asserts post-select `isOpen` (which was previously `true` and is now
   `false` — update those to the corrected expectation).
7. **Tests (test-first).**
   - Hook (`useAutocomplete.keyboard.test.tsx` and/or the base test file): Enter on a highlighted
     option sets `isOpen:false`, `highlightedIndex:null`, keeps `query`/`items`/`status`, and calls
     `onSelect` once with the right item; `onItemClick(item)` does the same; `aria-expanded` and
     `aria-activedescendant` (via `getInputProps()`) reflect the collapse.
   - Component (RTL): after Enter and after click, the listbox is gone / `aria-expanded` is `false`;
     reopen-on-focus then re-shows the results (1.5 regression guard).
   - GitHub adapter (`GithubAutocomplete.test.tsx`): selecting (Enter and click) closes the dropdown
     in addition to invoking the new-tab open (mock `window.open`); the popup is not left expanded.
   - Update any existing assertion that relied on the popup staying open post-select.
8. **E2E.** The existing `e2e/newtab.spec.ts` opens a real tab on select; extend it (or add a
   focused assertion) so that after Enter/click the demo page's combobox reports collapsed
   (`aria-expanded="false"` / listbox not visible). Keep e2e thin — one assertion added to the
   existing flow, no new spec file unless the existing flow genuinely cannot host it. The axe scan
   must stay clean.
9. **Everything stays green.** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` all pass.

## Tasks / Subtasks

- [ ] Task 1 — Hook: close-on-accept (AC: 1, 2, 3, 4) — test-first
  - [ ] Add the hook tests from AC 7 (red): Enter-accept and click-accept close + clear + keep
        query/items/status + `onSelect` once + ARIA collapse via `getInputProps()`.
  - [ ] Extend the single `selectItem` path so the state update that accepts an item also sets
        `isOpen:false` and `highlightedIndex:null`; keep `onSelect(item)` firing exactly once
        (green). One accept path, zero duplication.
- [ ] Task 2 — Component + adapter behavior (AC: 5, 7) — test-first
  - [ ] Add the RTL + adapter tests (red): listbox gone / `aria-expanded=false` after Enter and
        click; reopen-on-focus still re-shows results; GitHub adapter closes on select.
  - [ ] Confirm no component code change is needed beyond deriving from the corrected hook state
        (green). If a component change *is* required, it is a smell — the hook should own this.
- [ ] Task 3 — E2E (AC: 8)
  - [ ] Extend `e2e/newtab.spec.ts` with a collapsed-after-select assertion; re-run axe.
- [ ] Task 4 — Verify (AC: 6, 9)
  - [ ] Full suite: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`.
  - [ ] `pnpm dev` spot-check on BOTH instances: select by keyboard and by mouse; dropdown closes;
        refocus reopens the results (1.5).
- [ ] Task 5 — Docs (deliverables below)
  - [ ] `docs/features/epic-3-demo-e2e-launch/3-7-close-popup-on-select/README.md`.
  - [ ] `docs/features/epic-3-demo-e2e-launch/3-7-close-popup-on-select/MANUAL_TESTING.md`
        (keyboard accept path; pointer accept path; verify collapse + reopen-on-focus; both instances).

## Non-goals (deliberate)

- **No change to what selection *does*.** `onSelect` remains the consumer's concern (GitHub opens a
  new tab; the country instance is observational). This story only adds the missing *close* around
  the existing notify.
- **No focus change on accept.** Focus stays where the WAI-ARIA combobox expects it — on the input
  (activedescendant technique; the input was never DOM-blurred). Do not move or blur focus.
- **No "keep open on multi-select".** The component is single-select; there is no multi-select mode
  to preserve an open list for. Add that only if a real host asks.
- **No new props.** Closing on accept is the correct default, not a configurable behavior. Do not add
  a `closeOnSelect` flag for a case no consumer has.
- **No change to Escape/outside-press/clear.** Those transitions are correct and tested.

## Dev Notes

**Current state (verified 2026-07-12, commit b8ae32c).**
- `useAutocomplete.ts`: `selectItem = useCallback((item) => { onSelect(item) }, [onSelect])`. Enter
  (`onKeyDown` → `selectItem(items[highlightedIndex])`) and `onItemClick` both route through it.
  Neither touches `isOpen`/`highlightedIndex`, so the popup stays open post-select.
- `getInputProps()` already derives `aria-expanded` from `state.isOpen` and `aria-activedescendant`
  from the highlighted item — so fixing the state fixes the ARIA with no getter change (AC 3).
- `close()` already performs the exact `isOpen:false` + `highlightedIndex:null` transition (but also
  cancels debounce/aborts, which accept does not need since a settled selection has no in-flight
  fetch). The accept transition should set the two fields directly in the select path rather than
  calling `close()` — accept is "close + notify", and it should not depend on `close()`'s abort
  behavior. (If reusing `close()` proves cleaner and its abort is a harmless no-op at accept time,
  that is acceptable — the invariant is: after accept, `isOpen:false`, `highlightedIndex:null`,
  `query`/`items`/`status` unchanged, `onSelect` called once.)
- `GithubAutocomplete.tsx`: `onSelect` is `window.open(item.htmlUrl, '_blank', 'noopener,noreferrer')`
  — no close of its own, which is correct: closing is the lib's job, not the adapter's.

**Why the query and items survive accept.** Reopen-on-focus (Story 1.5, `openIfResults`) reopens a
closed dropdown for a still-qualifying settled query without refetching. If accept discarded `items`
or `status`, 1.5 would break. Accept must therefore close *without* discarding results — distinct
from `clear()` (3.6), which intentionally discards everything.

**Order of operations.** Perform the state close and the `onSelect` call such that `onSelect` runs
exactly once and the consumer cannot observe a half-updated state that reopens the popup. A single
`setState` for the close plus the `onSelect(item)` call in the same handler is sufficient; do not
call `onSelect` from inside the `setState` updater (side effects in reducers are a React anti-pattern
and can double-fire under StrictMode).

**MSW, not fetch stubs, for component/adapter tests** (CLAUDE.md). Hook tests may use the injected
`fetchSuggestions`/`onSelect` directly (they are the seams). Mock `window.open` in the adapter test.

**Both instances inherit the fix with zero adapter code** — that is the reuse proof again. If any
`src/features/` or `src/demo/` file needs a behavior edit (beyond a test asserting the corrected
close), stop: the close leaked out of the lib layer.

**No new dependency; no version changes (AR-1).**

**Branch & PR.** `story/3-7-close-popup-on-select` → `master`, squash. Commit e.g.
`fix(3.7): close the autocomplete popup on selection`. **No AI attribution / no `Co-Authored-By`.**
Run the mandatory pre-PR review gate (security review + independent second-pass review + verified
triage), re-run the full verification after any fix, then PR.
[Source: CLAUDE.md#Working rules / #Story pipeline]

### Project Structure Notes

- Files this story touches:
  - `src/lib/autocomplete/useAutocomplete.ts` — UPDATE — close + clear highlight in the accept path (AC 1).
  - `src/lib/autocomplete/useAutocomplete.keyboard.test.tsx` — UPDATE — Enter/click accept collapse (AC 7).
  - `src/lib/autocomplete/Autocomplete.test.tsx` — UPDATE — listbox gone after accept; 1.5 reopen guard (AC 7).
  - `src/features/github-search/GithubAutocomplete.test.tsx` — UPDATE — select closes + opens tab (AC 7).
  - `e2e/newtab.spec.ts` — UPDATE — collapsed-after-select assertion (AC 8).
  - `docs/features/epic-3-demo-e2e-launch/3-7-close-popup-on-select/{README.md,MANUAL_TESTING.md}` — NEW.
  - `docs/implementation-artifacts/3-7-close-popup-on-select.md` — UPDATE — Dev Agent Record on completion.
- `src/lib/autocomplete/types.ts` expected UNCHANGED (no API surface change — `close`/`onSelect`
  already documented). `src/demo/` expected UNCHANGED. `Autocomplete.tsx` likely UNCHANGED (it derives
  from hook state) — touch only if a test proves a genuine gap.
- **MANUAL_TESTING.md required** (visible interactive behavior). **PERFORMANCE.md not required**: no
  new performance dimension. [Source: CLAUDE.md#Documentation deliverables]

### References

- [Source: independent senior review, 2026-07-12, over commit b8ae32c — "selecting an option never
  closes the popup or clears aria-activedescendant"]
- [Source: docs/planning-artifacts/architecture.md#AR-4 (component surface) / #3.4 (hook owns state
  transitions) / #3.5 (ARIA checklist: aria-expanded, aria-activedescendant)]
- [Source: src/lib/autocomplete/useAutocomplete.ts — `selectItem`, `onKeyDown` Enter branch,
  `onItemClick`, `close()`, `openIfResults`, `getInputProps` ARIA derivation]
- [Source: src/features/github-search/GithubAutocomplete.tsx — `onSelect` new-tab open]
- [Source: docs/implementation-artifacts/1-2-keyboard-navigation-and-aria.md — Enter-selects and
  Escape-closes contracts]
- [Source: docs/implementation-artifacts/1-5-reopen-on-focus.md — `openIfResults` must keep working
  after accept]
- [Source: CLAUDE.md#Architecture boundary / #Working rules / #Story pipeline / #Documentation deliverables]

## Dev Agent Record

### Agent Model Used

_(to be filled by the dev agent)_

### Implementation Plan

_(to be filled by the dev agent)_

### Debug Log References

_(to be filled by the dev agent)_

### Completion Notes List

_(to be filled by the dev agent)_

### Pre-PR Review Gate

_(to be filled by the dev agent)_

### File List

_(to be filled by the dev agent)_

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-12 | 0.1 | Follow-up story drafted from the independent senior review over commit b8ae32c: the accept transition (Enter/click) must close the popup and clear the highlight in the lib layer's single selection path, so the combobox reports collapsed after selection and no stale `aria-activedescendant` remains. Query/items/status preserved so reopen-on-focus (1.5) is unaffected. | Łukasz (via BMAD create-story) |

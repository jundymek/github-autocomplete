---
baseline_commit: b8ae32ce7be796cc9bcde2606b6624095034bdc4
---

# Story 3.7: Close the popup on selection — one "accept" path that dismisses the dropdown

Status: review

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

- [x] Task 1 — Hook: close-on-accept (AC: 1, 2, 3, 4) — test-first
  - [x] Add the hook tests from AC 7 (red): Enter-accept and click-accept close + clear + keep
        query/items/status + `onSelect` once + ARIA collapse via `getInputProps()`.
  - [x] Extend the single `selectItem` path so the state update that accepts an item also sets
        `isOpen:false` and `highlightedIndex:null`; keep `onSelect(item)` firing exactly once
        (green). One accept path, zero duplication.
- [x] Task 2 — Component + adapter behavior (AC: 5, 7) — test-first
  - [x] Add the RTL + adapter tests (red): listbox gone / `aria-expanded=false` after Enter and
        click; reopen-on-focus still re-shows results; GitHub adapter closes on select.
  - [x] Confirm no component code change is needed beyond deriving from the corrected hook state
        (green). If a component change *is* required, it is a smell — the hook should own this.
- [x] Task 3 — E2E (AC: 8)
  - [x] Extend `e2e/newtab.spec.ts` with a collapsed-after-select assertion; re-run axe.
- [x] Task 4 — Verify (AC: 6, 9)
  - [x] Full suite: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`.
  - [x] `pnpm dev` spot-check on BOTH instances: select by keyboard and by mouse; dropdown closes;
        refocus reopens the results (1.5).
- [x] Task 5 — Docs (deliverables below)
  - [x] `docs/features/epic-3-demo-e2e-launch/3-7-close-popup-on-select/README.md`.
  - [x] `docs/features/epic-3-demo-e2e-launch/3-7-close-popup-on-select/MANUAL_TESTING.md`
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

Claude Opus 4.8 (1M context) — `claude-opus-4-8[1m]`.

### Implementation Plan

1. Verify current state matches Dev Notes (commit HEAD): `selectItem` only calls
   `onSelect(item)`, `getInputProps()` already derives `aria-expanded`/`aria-activedescendant`
   from state — confirmed.
2. Test-first (RED): add hook tests (Enter/click accept close + clear highlight + keep
   query/items/status + `onSelect` once + ARIA collapse) to `useAutocomplete.keyboard.test.tsx`;
   confirm the collapse assertions fail before the fix.
3. GREEN: in `selectItem`, add a single `setState((prev) => ({ ...prev, isOpen: false,
   highlightedIndex: null }))` before the existing `onSelect(item)` — close then notify, one path.
4. Component + adapter tests: listbox gone / `aria-expanded=false` after Enter and click;
   reopen-on-focus (1.5) re-shows results with no refetch; GitHub adapter select closes + opens
   tab. Confirm no component/adapter source change is needed (boundary proof).
5. E2E: extend the Enter and click new-tab flows in `newtab.spec.ts` with a collapsed assertion.
6. Full verification + real-browser spot-check of both instances.
7. Pre-PR review gate (security + codex-rescue + triage), then docs, Dev Agent Record, PR.

### Debug Log References

- RED confirmed: `pnpm vitest run useAutocomplete.keyboard.test.tsx -t "Story 3.7"` → 2 of 3
  new tests failed (both collapse assertions) before the fix; the reopen-on-focus guard passed
  (items already survived), proving it is a true regression guard.
- No existing test asserted the popup stays open post-select, so AC 6 required no stale-assertion
  edits (the dismiss test's `popup()`-not-null check is *before* click, a pre-close guard).

### Completion Notes List

- **The fix is a durable close in the lib layer.** `selectItem` cancels pending work
  (`clearDebounceTimer()` + `abortInFlight()`), collapses the popup (`isOpen:false`,
  `highlightedIndex:null`) in a single `setState`, then calls `onSelect(item)` once in the handler
  (not inside the updater — StrictMode double-fire safety). Both Enter and click already route
  through `selectItem`, so there is exactly one "accept" definition. The pending-work teardown was
  added after the codex-rescue review found accept could otherwise reopen the popup when a debounce
  was queued at accept time (see Pre-PR Review Gate); it preserves the AC 2 invariant since neither
  `clearDebounceTimer` nor `abortInFlight` mutates `query`/`items`/`status`.
- **Zero `src/features/` or `src/demo/` behavior change.** The GitHub adapter and country demo
  instance inherit the close for free; their test edits only *assert* the corrected collapse.
  The architecture boundary held — this is the same reuse proof as `clear()` (3.6).
- **Query/items/status preserved**, so reopen-on-focus (Story 1.5) still re-shows the settled
  results without a refetch — verified in the hook test, component test, and the browser spot-check.
- **Full verification green:** `pnpm lint`, `pnpm typecheck`, `pnpm test` (226 passing),
  `pnpm test:e2e` (14 passing incl. the two extended newtab flows; axe clean).
- **Browser spot-check executed** against the preview build on both instances, keyboard + mouse
  (16 assertions): dropdown opens → closes on accept (`aria-expanded="false"`, 0 options) → query
  preserved → reopen-on-focus re-shows the same results. All 16 passed. (See MANUAL_TESTING.md.)

### Pre-PR Review Gate

- **Security review (`/security-review`):** clean — no HIGH/MEDIUM findings. The only production
  change is a client-side React UI-state collapse; no new input/data-flow sink, `window.open`
  `noopener,noreferrer` handling untouched, no secrets/auth/crypto surface. Other changed files
  are tests and docs (excluded).
- **Independent second-pass review (`codex:codex-rescue`) over the story diff:** raised one **High**
  finding (no Med; one Low that the High's fix subsumes).
  - **High — accept did not cancel a queued debounce, so the popup could reopen behind the
    selection.** A new qualifying keystroke keeps the *previous* results open (`onInputChange` only
    changes `query`/`highlightedIndex`, leaving `isOpen`/`items`) and arms a ~300ms debounce. If the
    user accepts a still-visible option in that window, the first `selectItem` closed UI state but
    left the timer armed; `startFetch` then fired ~300ms later and reopened the popup — violating
    AC 1 ("selection closes the popup").
  - **Low — no test exercised accept during a pending debounce**, so the above was invisible to the
    suite.
- **Triage (verified empirically, not implemented blindly):**
  - The High finding is **REAL — confirmed by a red test** (`useAutocomplete.keyboard.test.tsx`,
    "cancels a debounced fetch queued before accept…"): before the fix `fetchSuggestions` was called
    twice (the queued fetch fired post-accept) and the listbox reopened. **Fix:** `selectItem` now
    calls `clearDebounceTimer()` + `abortInFlight()` before the close+notify — the same pending-work
    teardown `close()` and `resetToInitial()` already use. It preserves the AC 2 invariant
    (`query`/`items`/`status` untouched — neither call mutates those) and is a harmless no-op at a
    genuinely settled accept. The green test now proves the popup stays closed and no second fetch
    fires. This also **resolves the Low finding** (the pending-debounce accept path is now covered).
  - Security-focus notes from the review (no `lib/`→`features/` leak; `window.open(..., 'noopener,noreferrer')`
    unchanged; no StrictMode double-fire) matched my own analysis — no action needed.
- **Re-verified after the fix:** `pnpm lint`, `pnpm typecheck`, `pnpm test` (226 passing, +1 for the
  new guard), `pnpm test:e2e` (14 passing). All green.

### File List

- `src/lib/autocomplete/useAutocomplete.ts` — UPDATE — `selectItem` collapses the popup (close +
  clear highlight) in the same handler that calls `onSelect(item)`.
- `src/lib/autocomplete/useAutocomplete.keyboard.test.tsx` — UPDATE — hook close-on-accept tests
  (Enter/click; ARIA collapse; preserved results for reopen-on-focus).
- `src/lib/autocomplete/Autocomplete.test.tsx` — UPDATE — component: listbox gone after accept;
  reopen-on-focus (1.5) regression guard.
- `src/features/github-search/GithubAutocomplete.test.tsx` — UPDATE — adapter: select closes the
  dropdown in addition to opening the new tab (Enter + click).
- `e2e/newtab.spec.ts` — UPDATE — collapsed-after-select assertions on the Enter and click flows.
- `docs/features/epic-3-demo-e2e-launch/3-7-close-popup-on-select/README.md` — NEW.
- `docs/features/epic-3-demo-e2e-launch/3-7-close-popup-on-select/MANUAL_TESTING.md` — NEW.
- `docs/implementation-artifacts/3-7-close-popup-on-select.md` — UPDATE — status, tasks, Dev Agent
  Record.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-12 | 0.1 | Follow-up story drafted from the independent senior review over commit b8ae32c: the accept transition (Enter/click) must close the popup and clear the highlight in the lib layer's single selection path, so the combobox reports collapsed after selection and no stale `aria-activedescendant` remains. Query/items/status preserved so reopen-on-focus (1.5) is unaffected. | Łukasz (via BMAD create-story) |

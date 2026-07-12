---
baseline_commit: eb59242b22782d12a52bbeb06577fa09af4f8778
---

# Story 1.4: Outside-click / focus-loss dismissal for the `Autocomplete<T>` dropdown

Status: Done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a keyboard-and-pointer user of any `Autocomplete<T>` instance,
I want the open dropdown to close when I click (or tab) away from the component,
so that the combobox behaves like a standard WAI-ARIA combobox and a stale, floating listbox never
covers the page after I lose interest in it (FR-7/FR-8 consequence; AR-4/AR-7; WAI-ARIA combobox
dismissal).

## Background (defect origin)

This is a **follow-up bug-fix** for a gap in Story 1.3 (`Autocomplete<T>` presentational component),
surfaced during manual testing of the Story 3.1 demo. The component today closes the dropdown **only**
on `Escape` and on selecting an item (`src/lib/autocomplete/useAutocomplete.ts` `close()` is called
from the `Escape` branch of `onKeyDown` and after selection). There is **no** outside-pointer or
focus-loss dismissal: typing a query opens the results dropdown, and clicking anywhere else on the
page leaves the portalled listbox open indefinitely. Because the miss is in the generic lib component,
it affects **both** demo instances (GitHub + country) — so the fix belongs in the lib component
contract, not in the demo (CLAUDE.md: "fix the component's genericity, don't special-case the demo").
[Source: docs/implementation-artifacts/1-3-autocomplete-component.md; src/lib/autocomplete/Autocomplete.tsx; src/lib/autocomplete/useAutocomplete.ts; observed in the 3.1 demo]

## Acceptance Criteria

1. **Outside pointer press closes the open dropdown (WAI-ARIA dismissal).** When the dropdown is open
   (`state.isOpen === true`), a `pointerdown` anywhere that is **outside both** the component root
   (input + in-flow chrome) **and** the portalled popup closes it — identical outcome to `Escape`:
   `isOpen` becomes `false`, `highlightedIndex` resets to `null`, and the **query is retained** in the
   input (the text is not cleared). No new request is fired by closing.
2. **Clicking an option still selects it — no premature close.** A pointer press **inside the portalled
   popup** (e.g. on an option row, the footer, or the scrollbar) must **not** trigger the outside-close.
   Selecting an option via click still fires `onSelect` exactly once and behaves as before. The
   portalled popup lives under `document.body` (outside the component root's DOM subtree), so the
   "inside" check must explicitly treat the popup element as inside — a naive `root.contains(target)`
   alone is insufficient and would break option clicks.
3. **The below-threshold hint popup also dismisses on outside press.** When the small "type N more
   characters" hint popup is showing (the component's `belowThreshold` state, which is open even though
   `state.isOpen` is `false`), an outside pointer press dismisses it too (consistent with the existing
   `Escape`-dismisses-hint behavior). Typing again re-shows it as today.
4. **Escape and selection dismissal are unchanged (no regression).** `Escape` still closes and keeps
   the query + input focus; selecting via Enter or click still works; ArrowUp/Down/Home/End navigation
   is untouched. The hook's `close()` semantics (cancel debounce, abort in-flight, reset highlight) are
   reused — the fix must **not** duplicate or diverge from them.
5. **Listener lifecycle is correct — no leaks, no cost when closed.** The document-level listener is
   attached only while the popup is open (results **or** below-threshold hint) and removed on close and
   on unmount. There is no listener churn per render and no work while the component is idle/closed.
6. **Generic + self-contained (AR-4/AR-7/NFR-5).** The behavior is implemented **inside**
   `src/lib/autocomplete/` with no data-source knowledge, no app/`features`/demo imports, and no new
   runtime dependency. The `no-restricted-imports` boundary rule (Story 0.1) stays green and the lib
   type-checks in isolation. The public props surface is unchanged (no new required prop); if a prop is
   introduced it is optional with a safe default and documented.
7. **Tests prove all of the above (FR-18).** RTL tests assert: (a) outside `pointerdown` closes an open
   results dropdown and retains the query; (b) `pointerdown` on an option inside the portal selects it
   and does not pre-close (`onSelect` fires, no double handling); (c) `Escape` still closes and keeps
   the query; (d) outside press dismisses the below-threshold hint; (e) the listener is removed on
   unmount (no "close after unmount"/act warnings; e.g. closing then unmounting is clean). Existing
   Story 1.3 tests continue to pass unchanged.

## Tasks / Subtasks

- [x] Task 1 — Implement outside-dismiss in the component (AC: 1, 2, 3, 4, 5, 6)
  - [x] In `src/lib/autocomplete/Autocomplete.tsx`, add an effect that — only while `popupOpen` is
        true (the existing `state.isOpen || belowThreshold` value) — attaches a `pointerdown` listener
        on `document`. On a press whose `target` is **not** contained by the component root (`rootRef`)
        **and not** contained by the portalled popup element, call `handlers.close()` (results) and, for
        the below-threshold hint, also dismiss the hint (set `hintDismissedFor` to the current query,
        mirroring the existing Escape-dismiss path). Remove the listener in the effect cleanup.
  - [x] Give the portalled popup a ref (or an id) so the effect can test "inside the popup". The popup
        is rendered via `createPortal(..., document.body)`; capturing its DOM node (a ref on the `.pop`
        div) is the cleanest "inside" check. Ensure the check is robust to the press landing on a child
        (option/footer) — use `popupEl.contains(target)`.
  - [x] Use `pointerdown` (not `click`) so the dropdown closes on press, before any focus/blur churn,
        and so it works for mouse + touch + pen. Do **not** add a blur-based close that races with
        option `pointerdown` (clicking an option must still select). If focus-loss dismissal is desired,
        achieve it via the same outside-`pointerdown` path, not an input `onBlur` that would fire before
        the option click resolves.
  - [x] Reuse the hook's `close()` for the results case — do not reimplement debounce-cancel/abort in
        the component. Keep the component's only extra responsibility the hint dismissal it already owns.
- [x] Task 2 — Tests (AC: 7)
  - [x] Extend `src/lib/autocomplete/Autocomplete.test.tsx` (or a focused new
        `Autocomplete.dismiss.test.tsx`): open results (type ≥3 chars, settle), fire a `pointerdown` on
        `document.body` (outside), assert the popup is gone, `aria-expanded="false"`, and the input still
        holds the query.
  - [x] Assert a `pointerdown` on an option inside the portal selects it (`onSelect` called with the
        right item) and does not leave a half-closed state; assert clicking the footer/inside the popup
        does not close it.
  - [x] Assert `Escape` still closes + retains query (guard against regression), and that an outside
        press dismisses the below-threshold hint popup.
  - [x] Assert cleanup: unmount after opening does not throw / warn and the listener no longer fires.
- [x] Task 3 — Docs
  - [x] Update the Story 1.3 feature `README.md`/`MANUAL_TESTING.md` (the component docs under
        `docs/features/epic-1-core-autocomplete/1-3-autocomplete-component/`) to note outside-click /
        focus-loss dismissal as a supported dismissal path alongside Escape and selection. Add a manual
        step: open the dropdown, click elsewhere on the page → it closes, query retained.
  - [x] Ship the story's own doc folder per CLAUDE.md:
        `docs/features/epic-1-core-autocomplete/1-4-outside-click-dismiss/` with `README.md` (what
        changed, why, the pointerdown-vs-click and portal-inside-check decisions) and `MANUAL_TESTING.md`
        (open → click outside closes; click option still selects; Escape still works; below-threshold
        hint dismiss).
- [x] Task 4 — Verify (AC: all)
  - [x] `pnpm lint && pnpm typecheck && pnpm test` all green (+ `pnpm test:e2e` if present). Manually
        verify in `pnpm dev` on the 3.1 demo: type in each instance, click outside → dropdown closes,
        query kept; clicking an option still selects; Escape still works.

## Dev Notes

**The exact seam (read before coding).** The hook already exposes everything needed; this is a small,
surgical component change — do **not** touch `useAutocomplete.ts` logic unless a test proves it
necessary.
- `useAutocomplete` returns `handlers.close()` which cancels the debounce timer, aborts the in-flight
  request, and sets `isOpen: false, highlightedIndex: null` while **keeping** `query`. The `Escape`
  branch of the hook's `onKeyDown` already calls it. Reuse it verbatim for the results case.
  [Source: src/lib/autocomplete/useAutocomplete.ts (`close`, `onKeyDown` → `Escape`)]
- `Autocomplete.tsx` already has `rootRef` (on the component's outer `<div>`) and computes
  `popupOpen = state.isOpen || belowThreshold`. The portalled popup is the `<div className={styles.pop}>`
  rendered through `createPortal(..., document.body)`. Add a ref to that popup div for the inside-check.
  The component already owns the below-threshold hint dismissal via `hintDismissedFor` (Escape sets it);
  mirror that for outside-press. [Source: src/lib/autocomplete/Autocomplete.tsx (`rootRef`, `popupOpen`,
  `hintDismissedFor`, the portal block)]

**Why `pointerdown`, not `click` or `blur` (critical to get option-clicks right).**
- `blur` on the input fires **before** an option's `click`/`pointerup`, so a blur-close would tear down
  the popup before the selection resolves — the classic "clicking my own dropdown closes it and nothing
  gets selected" bug. Avoid input `onBlur`-driven closing.
- A document `pointerdown` with an "is the press inside the popup?" guard closes only for genuinely
  outside presses and lets inside presses (option rows) proceed to selection. `pointerdown` also closes
  promptly on press and covers mouse/touch/pen. This is the standard, race-free pattern.
[Source: WAI-ARIA Authoring Practices — combobox dismissal; the existing selection path in
`useAutocomplete.ts` (`onItemClick`/`getItemProps`)]

**Portal-aware inside check (AC 2).** Because the popup is portalled to `document.body`, it is **not** a
DOM descendant of `rootRef`. So `rootRef.current?.contains(target)` is `false` for clicks on options.
The close condition must be: `!rootRef.current?.contains(target) && !popupRef.current?.contains(target)`.
Missing the popup half of this check will break every option click. [Source:
src/lib/autocomplete/Autocomplete.tsx (`createPortal` to `document.body`); architecture.md#AR-7]

**Listener lifecycle (AC 5).** Attach in a `useEffect` gated on `popupOpen`; return a cleanup that
removes it. Do not attach on every render. Prefer `document.addEventListener('pointerdown', handler)`;
consider `{ capture: true }` only if a test shows an inner `stopPropagation` swallowing it (the lib
does not currently stopPropagation on the popup, so the bubbling phase should be fine — verify with a
test). No global listener may remain after the popup closes or the component unmounts.

**Scope guard — do only this.** This story is *only* the dismissal behavior. Do not add focus-trap,
click-to-reopen, or any styling/state changes beyond closing. Do not alter the hook's state machine,
the portal positioning, or the ARIA wiring from 1.2/1.3. The public props surface stays the same
(a new prop, if any, is optional with a default). [Source: CLAUDE.md#Architecture boundary;
docs/implementation-artifacts/1-3-autocomplete-component.md]

**No new runtime dependency (AR-1).** Use `document.addEventListener` + refs only. No outside-click
library. [Source: CLAUDE.md#Stack; architecture.md#AR-1]

**Branch & PR.** `story/1-4-outside-click-dismiss` → `master`, squash. Commit e.g.
`fix(1.4): close autocomplete dropdown on outside pointer press`. **No AI attribution / no
`Co-Authored-By`.** Run the mandatory pre-PR review gate (security review + codex-rescue second-pass +
verified triage), re-run `pnpm lint && pnpm typecheck && pnpm test` after any fix, then PR.
[Source: CLAUDE.md#Working rules / #Story pipeline]

### Project Structure Notes

- Files this story touches:
  - `src/lib/autocomplete/Autocomplete.tsx` — UPDATE (add the outside-`pointerdown` effect + popup ref).
  - `src/lib/autocomplete/Autocomplete.test.tsx` — UPDATE (or add `Autocomplete.dismiss.test.tsx`) — new
    dismissal tests.
  - `src/lib/autocomplete/useAutocomplete.ts` — likely **no change** (reuse `close()`); touch only if a
    test proves it necessary, and record why.
  - Docs: update `docs/features/epic-1-core-autocomplete/1-3-autocomplete-component/*` and add
    `docs/features/epic-1-core-autocomplete/1-4-outside-click-dismiss/{README.md,MANUAL_TESTING.md}`.
- Tests are co-located `*.test.tsx` (Vitest + RTL), mocking `fetchSuggestions` with a stub (no MSW at
  the lib layer, per 1.3). [Source: docs/planning-artifacts/architecture.md#3.1 / #3.6;
  docs/implementation-artifacts/1-3-autocomplete-component.md#Dev Notes]

### References

- [Source: docs/implementation-artifacts/1-3-autocomplete-component.md — origin component; close-only-on-Escape/selection gap]
- [Source: src/lib/autocomplete/Autocomplete.tsx — rootRef, popupOpen, portal popup, hintDismissedFor]
- [Source: src/lib/autocomplete/useAutocomplete.ts — `close()` semantics; Escape branch of onKeyDown]
- [Source: docs/planning-artifacts/architecture.md#AR-4 (injected contract) / #AR-7 (portal) / #NFR-5]
- [Source: CLAUDE.md#Architecture boundary / #Working rules / #Story pipeline / #Documentation deliverables]
- [Source: WAI-ARIA Authoring Practices 1.2 — Combobox pattern, dismissal behavior]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context)

### Debug Log References

- Full suite green: `pnpm lint && pnpm typecheck && pnpm test` → 14 files / 190 tests passed; `pnpm test:e2e` → 1 passed.
- New lib tests: `Autocomplete.dismiss.test.tsx` → 7 passed; full lib suite 5 files / 119 tests.
- Browser verification against the live Story 3.1 demo (country instance) confirmed: outside click
  closes + query retained; option click still selects (onSelect fires, not swallowed); Escape still
  closes; below-threshold hint dismisses on outside press. Note: this component does not auto-close
  on selection — that is pre-existing, unchanged behavior (verified identical via `git stash`).

### Completion Notes List

- Implemented outside-`pointerdown` dismissal entirely inside the lib component; no hook change, no
  new runtime dependency, public props surface unchanged. `no-restricted-imports` boundary stays
  green (lint passes).
- Portal-aware inside check: close only when the press is outside **both** `rootRef` and the new
  `popupRef` — a naive `root.contains` would break option clicks (popup is portalled to
  `document.body`).
- Chose `pointerdown` over `click`/`blur` to avoid the blur-before-option-click race; focus-loss
  dismissal rides the same outside-press path. Bubbling phase sufficed (no capture needed) — verified
  by test.
- Reused the hook's `close()` for results; mirrored the existing Escape hint-dismiss
  (`setHintDismissedFor`) for the below-threshold hint. Listener attached only while `popupOpen`,
  removed on close and unmount.

### File List

- `src/lib/autocomplete/Autocomplete.tsx` — UPDATE — added `popupRef`, outside-`pointerdown` effect, ref on `.pop`.
- `src/lib/autocomplete/Autocomplete.dismiss.test.tsx` — NEW — RTL tests for AC 7 (a–e).
- `docs/features/epic-1-core-autocomplete/1-3-autocomplete-component/README.md` — UPDATE — dismissal-paths note.
- `docs/features/epic-1-core-autocomplete/1-3-autocomplete-component/MANUAL_TESTING.md` — UPDATE — outside-click manual step.
- `docs/features/epic-1-core-autocomplete/1-4-outside-click-dismiss/README.md` — NEW — story docs.
- `docs/features/epic-1-core-autocomplete/1-4-outside-click-dismiss/MANUAL_TESTING.md` — NEW — story manual testing.
- `docs/implementation-artifacts/1-4-outside-click-dismiss.md` — UPDATE — baseline_commit, task checkboxes, Dev Agent Record, status.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-10 | 0.1 | Story drafted as a follow-up bug-fix for the Story 1.3 outside-click dismissal gap, found during Story 3.1 demo manual testing. | Bob (Scrum Master) |
| 2026-07-10 | 1.0 | Implemented outside-`pointerdown` dismissal in the lib component (popupRef + document listener), added `Autocomplete.dismiss.test.tsx`, updated 1.3 + 1.4 docs. All checks green. | Amelia (Dev) |

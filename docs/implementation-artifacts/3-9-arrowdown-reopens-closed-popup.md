---
baseline_commit: ab570b1ea718cb2102e181f096ffd9ac51f67e64
---

# Story 3.9: ArrowDown/ArrowUp reopen a closed popup with retained results — keyboard parity for reopen

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a keyboard user of any `Autocomplete<T>` instance,
I want ArrowDown (or ArrowUp) on a closed combobox that still holds settled results to reopen the
dropdown — without a refetch and without having to Tab away and back or edit my query,
so that dismissing the popup with Escape is recoverable from the keyboard, as the WAI-ARIA combobox
pattern specifies (Down Arrow opens the popup when closed; NFR-1 / AR-6; FR-7 continuity).

## Background (defect origin)

Reported by an external tester (2026-07-12, over commit `ab570b1`): "press Esc — the dropdown
closes; press Enter — it does not reopen. The query is still active but there is no way to see the
results again without changing the query."

Root cause, verified in code:

- Escape closes the popup but — correctly, per the activedescendant technique (Story 1.2 AC 3) —
  **keeps DOM focus on the input**. Focus never leaves.
- `onKeyDown` starts with `if (!isOpen) return` — with a closed popup, **every** key keeps its
  native behavior, so neither Enter nor ArrowDown can reopen.
- The **only** reopen trigger is the input's `focus` event (`openIfResults`, Story 1.5). Because
  focus never left after Escape, no `focus` event will fire — clicking the already-focused input
  does not help either. The user's sole keyboard recovery is Tab-out/Shift+Tab-in (obscure) or
  editing the query (which also fires a **new** GitHub request and burns rate limit).

So the tester's scenario is real; only the proposed key is off. Per the WAI-ARIA APG combobox
pattern the reopen key is **Down Arrow** (and Up Arrow), not Enter — Enter on a closed editable
combobox keeps its native form-submit behavior (Story 1.2 AC 9 pass-through contract, deliberately
unchanged). The fix belongs in the **generic lib**: the hook owns `isOpen` and all key logic (AR-3,
§3.4), and the gap affects every `Autocomplete<T>` host, not just the GitHub demo.
[Source: external bug report 2026-07-12; src/lib/autocomplete/useAutocomplete.ts (`onKeyDown`
closed-popup early return, `openIfResults`); docs/implementation-artifacts/1-2-keyboard-navigation-and-aria.md
(Escape keeps focus; pass-through contract); docs/implementation-artifacts/1-5-reopen-on-focus.md
(focus-only reopen path); WAI-ARIA APG combobox pattern (Down Arrow opens the popup)]

## Acceptance Criteria

1. **ArrowDown on a closed popup with settled results reopens it — no refetch (UPDATE
   `useAutocomplete.ts`).** With `isOpen === false`, a query at or above `minChars`, and a settled
   result state (`status ∈ {success, empty, error}` — the exact `openIfResults` guard from Story
   1.5), pressing ArrowDown in the input sets `isOpen: true`, consumes the key
   (`preventDefault()`), and re-renders the **existing** popup (results, empty, or error). **No
   `fetchSuggestions` call, no new `AbortController`, no debounce reset** — same no-refetch
   contract as 1.5. Reuse the single reopen guard — extend/share the `openIfResults` predicate, do
   NOT duplicate the condition in `onKeyDown`.
2. **Highlight on reopen follows the APG:** ArrowDown reopens **and highlights the first option**
   (index 0); ArrowUp reopens **and highlights the last option** (index N−1). When the settled
   state has zero items (`empty`/`error` popup), reopen with `highlightedIndex: null` — there is
   nothing to highlight, but the popup (with its message) still reopens so the user sees why.
3. **No spurious open — keys keep native behavior when there is nothing to show.** With a closed
   popup and `status === 'idle'`, `status === 'loading'`, or a below-`minChars` query, ArrowDown/
   ArrowUp are **not consumed**: no `preventDefault()`, no state change — the caret moves natively
   exactly as today. The below-threshold hint behavior (3.8) is untouched.
4. **Enter and Escape on a closed popup stay inert.** Enter keeps its native (form-submit)
   pass-through; Escape on a closed popup remains unconsumed. Only ArrowDown/ArrowUp gain
   closed-popup behavior. (Home/End on a closed popup also stay native — they are text-caret keys
   in a plain input.)
5. **ARIA reflects the reopen (verify, do not re-wire).** After an ArrowDown reopen,
   `aria-expanded` is `true` and `aria-activedescendant` points at the highlighted option's id —
   both already derived in `getInputProps()`, so no new attribute code; assert in a test. The
   live-region `statusMessage` re-derives automatically on open (already keyed off `isOpen`).
6. **Reopen-on-focus (1.5), dismissal (1.4), accept-close (3.7), and clear (3.6) are unchanged.**
   This story adds exactly one new transition: `closed-with-settled-results + ArrowDown/ArrowUp →
   open`. All existing tests keep passing without behavioral edits.
7. **Tests (test-first).**
   - Hook (`useAutocomplete.keyboard.test.tsx`): after settle → Escape close → ArrowDown reopens
     with index 0 highlighted and no second fetch; ArrowUp reopens with the last index; `empty` and
     `error` settled states reopen with `highlightedIndex: null`; `idle`/`loading`/below-threshold
     closed states leave the key unconsumed (native caret move, no state change, no fetch); Enter
     on a closed popup still does nothing; `aria-expanded`/`aria-activedescendant` via
     `getInputProps()` reflect the reopen.
   - Component (RTL, `Autocomplete.reopen.test.tsx`): type ≥3 chars → settle → Escape → ArrowDown
     re-shows the same options with `fetchSuggestions` call count unchanged; the full loop
     Esc → ArrowDown → Enter selects the highlighted option.
8. **E2E — one thin assertion.** Extend the existing `e2e/reopen.spec.ts` flow with the keyboard
   path: results open → Escape collapses → ArrowDown re-expands the same listbox with **zero** new
   network requests (the spec already counts them). No new spec file. Axe stays clean.
9. **Everything stays green.** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` all pass.

## Tasks / Subtasks

- [x] Task 1 — Hook: keyboard reopen (AC: 1, 2, 3, 4, 5) — test-first
  - [x] Add the hook tests from AC 7 (red) to `useAutocomplete.keyboard.test.tsx`.
  - [x] In `onKeyDown`, before the `if (!isOpen) return` early return, handle ArrowDown/ArrowUp:
        when the shared reopen guard passes (same predicate as `openIfResults`), `preventDefault()`
        and open in a **single** state update that also sets the APG highlight (first for
        ArrowDown, last for ArrowUp, `null` when there are no items). When the guard fails, fall
        through untouched (no consume). Share the guard — one reopen definition (green).
- [x] Task 2 — Component behavior (AC: 6, 7) — test-first
  - [x] Add the RTL tests (red): Escape → ArrowDown re-shows options without a refetch;
        Esc → ArrowDown → Enter selects. Confirm no component source change is needed — the hook
        owns this; a required `Autocomplete.tsx` edit is a boundary smell (green).
- [x] Task 3 — E2E (AC: 8)
  - [x] Extend `e2e/reopen.spec.ts` with the Escape → ArrowDown keyboard reopen assertion; re-run axe.
- [x] Task 4 — Verify (AC: 6, 9)
  - [x] Full suite: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`.
  - [x] `pnpm dev` spot-check on BOTH instances: type a qualifying query → Escape → ArrowDown
        reopens with the first option highlighted and zero new requests (Network panel); ArrowUp
        variant; idle/below-threshold ArrowDown moves the caret only.
- [x] Task 5 — Docs (deliverables below)
  - [x] `docs/features/epic-3-demo-e2e-launch/3-9-arrowdown-reopens-closed-popup/README.md`.
  - [x] `.../MANUAL_TESTING.md` (Esc → ArrowDown/ArrowUp reopen; highlight position; no-op cases;
        both instances).

## Non-goals (deliberate)

- **No Enter-reopens.** Enter on a closed editable combobox is native submit per the APG and Story
  1.2's pass-through contract. The tester's proposed key is intentionally not implemented; the APG
  key (ArrowDown) is.
- **No Alt+ArrowDown variant.** APG lists Alt+Down ("open without moving focus") as optional; skip
  it until a real host asks. Do not add a prop or config for it.
- **No click-to-toggle / click-to-reopen.** Pointer users recover via outside-click + refocus
  (1.5). Adding click-open (or click-toggle) is a separate UX decision with its own edge cases
  (caret placement vs. toggle) — out of scope.
- **No refetch-on-reopen or staleness policy.** Reopen shows retained results, exactly like 1.5.
- **No change to Escape, accept, clear, outside-press, or the below-threshold hint.**

## Dev Notes

**Current state (verified 2026-07-12, commit ab570b1).**
- `useAutocomplete.ts` `onKeyDown`: first line of the switch-preamble is
  `if (!isOpen) return` — the closed popup consumes nothing. This is the single line the fix
  inserts before.
- `openIfResults` (1.5) already encodes the correct reopen guard:
  `!isOpen && query.length >= minChars && status ∈ {success, empty, error}` — and deliberately
  never touches highlight. The keyboard reopen must **share** this guard but **differs on
  highlight** (APG: first/last). Options: (a) extract the guard into a small predicate used by
  both, or (b) extend `openIfResults` with an optional highlight argument
  (`'none' | 'first' | 'last'`, default `'none'` so the focus path is unchanged). Either is fine;
  the invariant is one guard definition, zero duplication.
- `onKeyDown` reads `state` from the closure (the hook deps include `state`), so the closed-popup
  branch can check the guard synchronously and decide whether to consume the key. Consume
  (`preventDefault`) **only** when actually reopening (AC 3) — a consumed-but-no-op arrow key would
  break native caret movement in an idle input.
- Reopen + highlight must be **one** `setState` (open and highlight together), otherwise a paint
  between the two updates can flash an unhighlighted popup and `aria-activedescendant` lags a frame.
- `getInputProps()` derives `aria-expanded`/`aria-activedescendant` from state — fixing state fixes
  ARIA (same as 3.7 AC 3). `deriveStatusMessage` returns the results message whenever open — the
  live region re-announces on reopen for free.

**Why ArrowUp highlights the last option.** WAI-ARIA APG editable combobox: "Down Arrow: If the
popup is available, opens it and moves visual focus to the first suggested value. Up Arrow: opens
it and places visual focus on the last suggested value." Following both keeps us APG-conformant and
costs one ternary. Clamping (no wrap, AR-3) is unaffected — it applies to navigation while open.

**Interaction with 3.7's teardown.** Accept (`selectItem`) and `close()` cancel pending work; a
reopen via ArrowDown starts none (no fetch, no debounce), so there is nothing new to cancel and no
interaction with the accept-must-cancel-pending-debounce invariant. Do not add teardown calls to
the reopen path.

**Empty/error reopen shows the message popup.** The 1.5 guard includes `empty` and `error` on
purpose (the user asked "why no results?" — the popup answers). Keyboard reopen keeps that: the
popup reopens showing the empty/error message with no highlight. Enter afterwards does nothing
(no highlighted item) — already guaranteed by the existing Enter guard.

**Hook tests use the injected seams** (`fetchSuggestions` mock call counts prove no-refetch);
component tests via RTL on the existing harness; no MSW needed at the lib layer (per 1.3/1.5).

**No new dependency; no version changes (AR-1). No `types.ts` change expected** — no new public
surface; `onKeyDown` already exists on the input prop getter.

**Branch & PR.** `story/3-9-arrowdown-reopens-closed-popup` → `master`, squash. Commit e.g.
`fix(3.9): reopen the closed autocomplete popup on ArrowDown/ArrowUp`. **No AI attribution / no
`Co-Authored-By`.** Run the mandatory pre-PR review gate (security review + independent second-pass
review + verified triage), execute MANUAL_TESTING.md yourself and report the outcome in the PR,
re-run the full verification after any fix, then PR.
[Source: CLAUDE.md#Working rules / #Story pipeline]

### Project Structure Notes

- Files this story touches:
  - `src/lib/autocomplete/useAutocomplete.ts` — UPDATE — closed-popup ArrowDown/ArrowUp branch in
    `onKeyDown`; shared reopen guard (AC 1–4).
  - `src/lib/autocomplete/useAutocomplete.keyboard.test.tsx` — UPDATE — keyboard-reopen hook tests (AC 7).
  - `src/lib/autocomplete/Autocomplete.reopen.test.tsx` — UPDATE — Escape → ArrowDown component flow (AC 7).
  - `e2e/reopen.spec.ts` — UPDATE — keyboard reopen assertion (AC 8).
  - `docs/features/epic-3-demo-e2e-launch/3-9-arrowdown-reopens-closed-popup/{README.md,MANUAL_TESTING.md}` — NEW.
  - `docs/implementation-artifacts/3-9-arrowdown-reopens-closed-popup.md` — UPDATE — Dev Agent Record on completion.
- `types.ts`, `Autocomplete.tsx`, `src/features/`, `src/demo/` expected UNCHANGED — both instances
  inherit the fix through the hook (the same reuse proof as 3.6/3.7). Touch only if a test proves a
  genuine gap.
- **MANUAL_TESTING.md required** (visible keyboard behavior). **PERFORMANCE.md not required**: the
  reopen path makes no request and arms no timer — no performance dimension.
  [Source: CLAUDE.md#Documentation deliverables]

### References

- [Source: external bug report, 2026-07-12, over commit ab570b1 — "Esc closes the dropdown; Enter
  does not reopen it; the query is active but the results cannot be seen again without editing it"]
- [Source: src/lib/autocomplete/useAutocomplete.ts — `onKeyDown` (`if (!isOpen) return`),
  `openIfResults` guard, `getInputProps` ARIA derivation, `deriveStatusMessage`]
- [Source: docs/implementation-artifacts/1-2-keyboard-navigation-and-aria.md — Escape keeps focus
  (activedescendant technique); "closed dropdown consumes nothing" pass-through contract this story
  narrows for ArrowDown/ArrowUp only]
- [Source: docs/implementation-artifacts/1-5-reopen-on-focus.md — the reopen guard and no-refetch
  contract this story reuses]
- [Source: docs/implementation-artifacts/3-7-close-popup-on-select.md — accept teardown invariant
  (untouched here); state-derived ARIA proof pattern]
- [Source: docs/planning-artifacts/architecture.md#AR-3 (hook owns key logic + isOpen) / #AR-6
  (ARIA combobox, Escape keeps focus) / #3.4 (all key logic in `handlers.onKeyDown`) / #3.5 (ARIA
  checklist)]
- [Source: WAI-ARIA Authoring Practices — Combobox pattern, Down Arrow / Up Arrow open the popup]
- [Source: CLAUDE.md#Architecture boundary / #Working rules / #Story pipeline / #Documentation deliverables]

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code)

### Implementation Plan

1. Extract the 1.5 reopen guard into a shared pure predicate `canReopen(state, minChars)`
   (spec Dev Notes option (a)); `openIfResults` delegates to it unchanged (focus path keeps
   `highlightedIndex` untouched).
2. Test-first: add the AC 7 hook tests (red) to `useAutocomplete.keyboard.test.tsx`, then insert a
   closed-popup ArrowDown/ArrowUp branch in `onKeyDown` before the `if (!isOpen) return` early
   return: when `canReopen` passes, `preventDefault()` and one `setState` that opens and sets the
   APG highlight (first for ArrowDown, last for ArrowUp, `null` with zero items); when it fails,
   fall through unconsumed.
3. Test-first RTL: Escape → ArrowDown re-shows the same options with unchanged fetch count;
   Esc → ArrowDown → Enter selects. No `Autocomplete.tsx` change expected.
4. Extend `e2e/reopen.spec.ts` with the keyboard reopen path (zero new requests); re-run axe suite.
5. Docs folder + full verification + mandatory pre-PR review gate.

### Debug Log References

None — clean red→green cycle at every step; no debugging sessions required.

### Completion Notes List

- Extracted the Story 1.5 reopen condition into a module-level `canReopen(state, minChars)`
  predicate (spec Dev Notes option (a)); `openIfResults` and the new `onKeyDown` closed-popup
  branch both decide through it — one guard definition, zero duplication (AC 1).
- ArrowDown reopens with `highlightedIndex: 0`, ArrowUp with the last index, empty/error settled
  states with `null`; open + highlight commit in a single `setState` so ARIA cannot lag a frame
  (AC 2, AC 5). `minChars` added to the `onKeyDown` deps array (the guard reads it).
- Keys are consumed only when actually reopening; idle/loading/below-threshold arrows, and
  Enter/Escape/Home/End on a closed popup, keep native behavior — asserted by tests (AC 3, AC 4).
- All 242 unit/integration tests and 15 e2e tests pass with zero behavioral edits to existing
  tests (AC 6, AC 9); axe suite clean (AC 8).
- MANUAL_TESTING.md executed end-to-end in a real Chromium browser against `pnpm dev` (real
  GitHub API): all 8 steps pass on both instances, zero extra network requests across every
  reopen, Esc→ArrowDown→Enter opened the highlighted result in a new tab.
- `types.ts`, `Autocomplete.tsx`, `src/features/`, `src/demo/` untouched, as the spec predicted.

### Pre-PR Review Gate

- **Security review** (2026-07-12, over the full story diff): no findings. The production change
  is a pure client-side state transition — no network calls, URL handling, DOM injection, storage,
  or secrets; the reopen path only re-shows in-memory results already shown to the user.
- **Independent second-pass review** (codex-rescue, 2026-07-12, story diff + spec as context):
  no findings; verdict "ready to merge". Checked correctness, React pitfalls (stale closures,
  deps, StrictMode), APG conformance, edge cases (minChars=0, N=1, items changing between close
  and reopen), and the architecture boundary.
- **Triage:** zero findings from both passes — nothing to verify or fix; no false positives to
  document. Full verification (`pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`) green
  before and unchanged after the gate.

### File List

- `src/lib/autocomplete/useAutocomplete.ts` — UPDATE — shared `canReopen` guard; closed-popup
  ArrowDown/ArrowUp reopen branch in `onKeyDown`; `openIfResults` delegates to the guard.
- `src/lib/autocomplete/useAutocomplete.keyboard.test.tsx` — UPDATE — 9 keyboard-reopen hook tests.
- `src/lib/autocomplete/Autocomplete.reopen.test.tsx` — UPDATE — 2 RTL tests (reopen without
  refetch; Esc → ArrowDown → Enter loop).
- `e2e/reopen.spec.ts` — UPDATE — keyboard reopen extension of the request-counting flow.
- `docs/features/epic-3-demo-e2e-launch/3-9-arrowdown-reopens-closed-popup/README.md` — NEW.
- `docs/features/epic-3-demo-e2e-launch/3-9-arrowdown-reopens-closed-popup/MANUAL_TESTING.md` — NEW.
- `docs/implementation-artifacts/3-9-arrowdown-reopens-closed-popup.md` — UPDATE — Dev Agent Record.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-12 | 1.0 | Implemented: shared `canReopen` guard + closed-popup ArrowDown/ArrowUp branch in `onKeyDown` (single setState, APG first/last highlight, no refetch). 9 hook tests, 2 RTL tests, e2e keyboard-reopen extension. Full suite + manual browser run green; security review and codex second-pass review clean. | Dev agent (Claude Code) |
| 2026-07-12 | 0.1 | Follow-up story drafted from an external bug report over commit ab570b1: after Escape the popup cannot be reopened from the keyboard (focus never left the input, so the 1.5 focus-reopen path cannot fire, and `onKeyDown` ignores all keys while closed). Fix: ArrowDown/ArrowUp on a closed popup with settled results reopen it via the shared 1.5 guard, with APG-conformant first/last highlight, no refetch. Enter stays native per APG. | Łukasz (via BMAD create-story) |

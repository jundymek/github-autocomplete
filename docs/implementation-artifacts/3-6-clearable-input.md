---
baseline_commit: 40aa1cf62ad75f96bc16942356b896ad998af169
---

# Story 3.6: Clearable input — a "×" button that resets the combobox

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user of any `Autocomplete<T>` instance (mouse or touch in particular),
I want a small "×" button inside the input that clears the query in one action,
so that I can start a new search without selecting the text and deleting it — a standard
combobox affordance that keyboard users already have via selection+delete, now available to
everyone (task.md "reusable and self-contained"; AR-4 component surface; NFR-4 a11y).

## Background (why this follow-up exists)

A post-release UX pass (2026-07-12) noted the input offers no one-action reset: Escape closes
the popup but deliberately keeps the query (documented hook behavior since 1.2), so the only way
to start over is manual text deletion. A clear button is the canonical complement — it is generic
combobox chrome, so it belongs in the lib layer where every adapter (GitHub instance, country
instance, any future host) inherits it for free.

This story adds behavior to `src/lib/autocomplete/` and therefore must respect everything that
makes the lib the deliverable: no dependency (the glyph is text/inline SVG, not an icon package),
styling only via the component's own CSS Module + `--ac-*` tokens, ARIA correctness, and the §3.4
contract that all state transitions flow through the hook.
[Source: docs/task.md; docs/planning-artifacts/architecture.md#AR-4/#AR-5/#3.4;
src/lib/autocomplete/useAutocomplete.ts (Escape keeps query); CLAUDE.md#Architecture boundary]

## Acceptance Criteria

1. **The hook exposes `clear()` (UPDATE `useAutocomplete.ts`, `types.ts`).**
   `AutocompleteHandlers<T>` gains `clear: () => void`, which returns the hook to its initial
   state: cancels any pending debounce timer, aborts any in-flight fetch, and sets
   `{ query: '', status: 'idle', items: [], highlightedIndex: null, isOpen: false, error: undefined }`.
   Semantically identical to `onInputChange('')` (the existing below-threshold reset path) — reuse
   that path rather than duplicating it. A stale response from an aborted fetch can never commit
   state afterwards (the existing controller guard already ensures this — do not weaken it).
2. **The component renders the clear button (UPDATE `Autocomplete.tsx`, `Autocomplete.module.css`).**
   Inside the component root (NOT the portal), a `<button type="button">` rendered after the
   input, absolutely positioned in the input's existing trailing lane (the `padding: 10px 40px
   10px 12px` right inset already reserves it):
   - Visible **only** when `state.query.length > 0` **and** `state.status !== 'loading'` — while
     loading, the 3-dot pulse keeps the lane (no overlap, no layout shift).
   - Content: a text/inline-SVG "×" glyph — **no icon dependency** (AR-1: no new packages).
   - Activating it calls `handlers.clear()`, returns focus to the input
     (`inputRef.current?.focus()`), and resets the below-threshold hint dismissal
     (`setHintDismissedFor(null)`) so a fresh query behaves like a fresh mount.
3. **Accessibility.**
   - The button has an accessible name via a new `clearLabel?: string` prop on
     `AutocompleteProps<T>` (default `'Clear'`), applied as `aria-label`.
   - It is a real focusable button in the natural tab order after the input; Enter/Space activate
     it natively (no key handling of our own).
   - Focus-visible styling matches the input's focus treatment (accent ring via `--ac-color-accent`).
   - It does **not** alter the combobox ARIA contract: no changes to `getInputProps()` output;
     the popup close that results from clearing flows from hook state, not from extra ARIA wiring.
   - The existing outside-press dismissal treats the button as inside the component
     (it is inside `rootRef`) — pressing it must not fire the outside-close path first. This holds
     structurally; assert it in tests rather than adding code.
4. **Interaction edge cases.**
   - Clear while `loading`: not reachable via pointer (button hidden per AC 2), but `clear()`
     itself is still safe mid-flight (abort + reset) — covered by a hook test.
   - Clear while the popup shows results/empty/error: popup closes (isOpen false), input empties.
   - Clear when the input is empty: button is not rendered; nothing to do.
   - After clear, focus is in the input and typing a new query starts the normal
     threshold→debounce→fetch cycle from scratch.
5. **The public API surface is updated deliberately.**
   - `types.ts`: `clear` documented on `AutocompleteHandlers<T>`; `clearLabel` documented on
     `AutocompleteProps<T>`.
   - The barrel (`src/lib/autocomplete/index.ts`) needs **no new export** (both changes ride on
     already-exported types) — verify, do not assume.
   - Root README Component API table (from Story 3.3): add the `clearLabel` prop row and mention
     `handlers.clear` in the hook section.
6. **Tests (test-first where there is logic).**
   - Hook (`useAutocomplete.clear` cases, new or existing test file): clear from `success`,
     from `loading` (in-flight fetch aborted — resolve the stubbed fetch afterwards and assert
     nothing commits), from `error`, and from below-threshold; all land in the initial state.
   - Component (RTL + MSW): button absent when query is empty; appears after typing; hidden while
     loading (dots visible instead); click empties the input, closes the popup, and moves focus
     back to the input; `aria-label` defaults to `Clear` and follows the `clearLabel` prop;
     tab order is input → clear button.
   - Both demo instances keep passing their existing tests unchanged except where they assert the
     exact DOM around the input (adjust only if genuinely affected).
7. **Everything stays green.** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` all
   pass. The axe e2e scan must stay clean with the new button present (type a query in the a11y
   spec's existing flow — if the current scan already runs with a filled input, no spec change is
   needed; verify before touching e2e).

## Tasks / Subtasks

- [x] Task 1 — Hook: `clear()` (AC: 1) — test-first
  - [x] Add the hook tests from AC 6 (red).
  - [x] Add `clear` to `AutocompleteHandlers<T>` (types.ts, with doc comment) and implement it in
        `useAutocomplete.ts` via the existing reset path (green). *(Refactored the reset into a
        shared `resetToInitial` helper so `clear()` is unconditional — review-gate fix.)*
- [x] Task 2 — Component: button + styling (AC: 2, 3) — test-first
  - [x] Add the RTL tests from AC 6 (red).
  - [x] Render the conditional button in `Autocomplete.tsx` (clear + refocus +
        `setHintDismissedFor(null)`); add `clearLabel` prop with default.
  - [x] Style in `Autocomplete.module.css`: absolute in the trailing lane, muted glyph
        (`--ac-color-text-muted`), accent on hover/focus-visible, focus ring consistent with the
        input; no layout shift when it appears/disappears (green).
- [x] Task 3 — API docs (AC: 5)
  - [x] Doc comments in `types.ts`; verified the barrel needs no change.
  - [x] Root `README.md`: `clearLabel` row in the props table; `clear` in the hook handlers list.
- [x] Task 4 — Verify (AC: 4, 6, 7)
  - [x] Full suite: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`.
  - [x] `pnpm dev` spot-check on BOTH instances (the country panel proves the button inherits the
        teal theme purely via tokens — confirmed: hover glyph resolves to `#0F766E`).
- [x] Task 5 — Docs (deliverables below)
  - [x] `docs/features/epic-3-demo-e2e-launch/3-6-clearable-input/README.md`.
  - [x] `docs/features/epic-3-demo-e2e-launch/3-6-clearable-input/MANUAL_TESTING.md`
        (keyboard path: Tab to ×, Enter; pointer path; focus return; both instances).

## Non-goals (deliberate)

- **Escape behavior is unchanged.** Escape still closes the popup and keeps the query (documented
  since 1.2, tested, and part of the WAI-ARIA pattern). The button is the *emptying* affordance;
  do not add "Escape clears when popup already closed" — it would surprise keyboard users and
  invalidate existing tests for no requested value.
- **No new e2e spec.** RTL covers the behavior (visibility, clearing, focus return); the existing
  axe scan covers the accessibility regression surface. A dedicated e2e for one button is not
  "thin e2e" (CLAUDE.md).
- **No icon package, no `--ac-*` token additions.** The glyph is text/inline SVG; existing tokens
  (`--ac-color-text-muted`, `--ac-color-accent`) are sufficient. New tokens would expand the
  documented theming API (Story 0.3) for no design need.
- **No `onClear` callback prop.** No consumer needs to observe clearing today; the state change is
  observable via the controlled behavior. Add it only when a real host asks for it.

## Dev Notes

**Current state (verified 2026-07-12, commit 40aa1cf).**
- `useAutocomplete.ts`: `onInputChange('')` already performs the exact reset `clear()` needs
  (below-threshold branch: clears debounce, aborts in-flight, resets all fields, `isOpen: false`).
  `clear()` can literally delegate to that branch — keep one reset path, zero duplication.
- `Autocomplete.tsx`: input renders with `{...inputProps}` from `getInputProps()`; the trailing
  lane currently hosts the loading dots (`styles.slot`, `aria-hidden`, shown only while
  `status === 'loading'`). The AC 2 visibility rule (`query.length > 0 && status !== 'loading'`)
  makes button and dots mutually exclusive — they can share the same positioned lane.
- `Autocomplete.module.css`: `.input { padding: 10px 40px 10px 12px }` — the 40 px right inset
  already exists for the dots; the button fits it without touching input padding.
- Component-local state `hintDismissedFor` tracks the query whose below-threshold hint Escape
  dismissed; reset it to `null` on clear so the next typing session gets the hint again (AC 2).
- Outside-press dismissal (`pointerdown` listener) short-circuits for targets inside `rootRef` —
  the button lives there, so pressing it does not race the close path (AC 3, assert in a test).

**Why the button must not be in the portal.** It anchors to the input (component root subtree)
and must exist regardless of popup state; the portal exists only while the popup is open.

**Why hidden during loading, not stacked.** One 40 px lane, two occupants would need a wider
inset (layout shift when loading toggles) or overlap. Loading is transient (debounced, aborted
aggressively); the button reappears the instant the fetch settles. If a user wants to abort a
slow search, Escape already does exactly that (`close()` aborts in-flight).

**Focus return is mandatory.** After pointer-clearing, focus lands on the button whose purpose is
spent; returning it to the input (the same pattern the retry button already uses — see `retry()`
in `Autocomplete.tsx`) keeps the user in the typing flow and matches the WAI-ARIA combobox
expectation that the input is the interaction anchor.

**MSW, not fetch stubs, for component tests** (CLAUDE.md) — the existing
`GithubAutocomplete.test.tsx` and lib component tests show the established harness; hook-level
tests may use the injected `fetchSuggestions` directly (it is the seam, not a stub of `fetch`).

**Both instances inherit the feature with zero adapter code** — that is the story's reuse proof.
The country panel's teal `--ac-color-accent` override must restyle the button's hover/focus
treatment automatically. If any demo/adapter file needs edits beyond tests, stop — the button
leaked out of the lib layer.

**No new dependency; no version changes (AR-1).** This story installs nothing.

**Branch & PR.** `story/3-6-clearable-input` → `master`, squash. Commit e.g.
`feat(3.6): add clear button to the autocomplete input`. **No AI attribution / no
`Co-Authored-By`.** Run the mandatory pre-PR review gate (security review + independent
second-pass review + verified triage), re-run the full verification after any fix, then PR.
[Source: CLAUDE.md#Working rules / #Story pipeline]

### Project Structure Notes

- Files this story touches:
  - `src/lib/autocomplete/types.ts` — UPDATE — `clear` on handlers, `clearLabel` prop (AC 1, 3, 5).
  - `src/lib/autocomplete/useAutocomplete.ts` — UPDATE — `clear()` via the existing reset path (AC 1).
  - `src/lib/autocomplete/Autocomplete.tsx` — UPDATE — conditional clear button, `clearLabel`,
    focus return, hint-dismissal reset (AC 2, 3).
  - `src/lib/autocomplete/Autocomplete.module.css` — UPDATE — button styling in the trailing lane (AC 2, 3).
  - `src/lib/autocomplete/useAutocomplete.test.tsx` (or a focused new test file) — UPDATE/NEW — `clear()` cases (AC 6).
  - `src/lib/autocomplete/Autocomplete.test.tsx` (or a focused new test file) — UPDATE/NEW — button behavior (AC 6).
  - `README.md` — UPDATE — `clearLabel` prop row + `clear` handler mention (AC 5).
  - `docs/features/epic-3-demo-e2e-launch/3-6-clearable-input/{README.md,MANUAL_TESTING.md}` — NEW.
  - `docs/implementation-artifacts/3-6-clearable-input.md` — UPDATE — Dev Agent Record on completion.
- `src/features/`, `src/demo/`, `e2e/` and configuration expected UNCHANGED (see the reuse-proof
  note; adjust e2e only if AC 7's verification genuinely requires it).
- **MANUAL_TESTING.md required** (visible interactive behavior). **PERFORMANCE.md not required**:
  the abort-on-clear path is covered by hook unit tests and adds no new performance dimension
  beyond what Story 1.1 documented. [Source: CLAUDE.md#Documentation deliverables]

### References

- [Source: docs/task.md — "reusable and self-contained autocomplete component"; no autocomplete library]
- [Source: docs/planning-artifacts/architecture.md#AR-1 (no needless deps) / #AR-4 (component surface) / #AR-5 (token theming) / #3.4 (hook owns all state transitions)]
- [Source: src/lib/autocomplete/useAutocomplete.ts — reset path in `onInputChange`, `close()` abort semantics, controller guard]
- [Source: src/lib/autocomplete/Autocomplete.tsx — trailing `slot` dots, `retry()` focus-return pattern, `hintDismissedFor`, outside-press listener]
- [Source: src/lib/autocomplete/Autocomplete.module.css — `.input` right inset (40px), `.slot` lane]
- [Source: src/lib/autocomplete/types.ts — `AutocompleteHandlers`, `AutocompleteProps` being extended]
- [Source: docs/implementation-artifacts/1-2-keyboard-navigation-and-aria.md — Escape-keeps-query contract this story must not change]
- [Source: CLAUDE.md#Architecture boundary / #Working rules / #Story pipeline / #Documentation deliverables]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Code, dev-story pipeline).

### Implementation Plan

1. Hook `clear()` (test-first): red tests for clear from success/loading(+late-resolve no-commit)/
   error/below-threshold and pending-debounce cancellation; implement by delegating to the existing
   `onInputChange('')` reset branch (one path, zero duplication); expose on `handlers`; document on
   `AutocompleteHandlers<T>`.
2. Component button (test-first): red RTL tests for visibility rules, click→clear/close/refocus,
   `clearLabel` default+override, tab order, inside-root guarantee, hint re-show; render the
   conditional `<button>` with inline-SVG glyph in the trailing lane; `clearInput` handler
   (clear + `setHintDismissedFor(null)` + refocus, mirroring `retry`); style `.clear` in the lane.
3. API docs: type doc comments; verified the barrel needs no change (both ride on already-exported
   types); README `clearLabel` row + `clear` handler mention.
4. Verify: full local suite + `pnpm dev` browser spot-check on both instances.
5. Feature docs + pre-PR review gate.

### Debug Log References

- Full suite green: 15 files / 218 unit-integration tests; 14/14 Playwright e2e (incl. 3 axe scans,
  the open-with-results scan runs with the clear button present and stays clean → no e2e change).
- `pnpm dev` browser drive (mocked GitHub, offline): GitHub "×" default accent `#6639BA`, hidden
  while loading (dots present), click clears + closes popup + returns focus. Country "×" inherited
  with zero adapter code; glyph muted `rgb(89,99,110)` by default, **hover teal `rgb(15,118,110)` =
  `#0F766E`** from the panel's `--ac-color-accent` token override → reuse + token-theming proof.

### Completion Notes List

- `clear()` routes through a shared `resetToInitial(value)` helper (also used by `onInputChange`'s
  below-threshold branch) — clears debounce, aborts in-flight, resets all fields, `isOpen:false`;
  the existing controller guard keeps a late/aborted fetch from committing. One reset path, zero
  duplication, and the reset is unconditional (holds at `minChars:0` — see the review-gate fix).
  Verified by the loading-clear test (resolve after clear commits nothing).
- Button is in the component root (not the portal), so the outside-press `pointerdown` listener
  treats a press on it as inside `rootRef` — asserted structurally in a test (no extra code).
- Visibility `query.length > 0 && status !== 'loading'` makes button and loading dots mutually
  exclusive in the one 40 px trailing lane → no layout shift, no overlap.
- Inline-SVG glyph, no icon package (AR-1); no new `--ac-*` tokens (existing muted/accent suffice).
- Escape semantics unchanged (verified by the untouched Escape tests).
- No `src/features/`, `src/demo/`, or `e2e/` file edited — the reuse-proof holds; the barrel is
  unchanged (both additions ride on already-exported `AutocompleteProps`/`AutocompleteHandlers`).

### Pre-PR Review Gate

- **Security review** (`/security-review` over the branch diff): no findings. The change is
  client-side React; the only user value is the controlled query, used as an input value and passed
  to the unchanged injected `fetchSuggestions`. Inline SVG is static; `clearLabel` flows only into
  `aria-label` (React-escaped attribute). No injection/secrets/auth/network/deserialization surface
  introduced. Architecture boundary re-verified: `lib/` imports nothing from `features/`/app.
- **Independent second pass** (codex:codex-rescue over the diff with the spec as context):
  clean on requirements 1/3/4/5 and the core of 2; raised **one Medium** finding — with a
  host-supplied `minChars={0}`, an empty query is "at threshold", so the original
  `clear()`→`onInputChange('')` delegation took the fetch branch instead of the reset branch.
  **Triaged empirically** (throwaway hook test): CONFIRMED — after `clear()` at `minChars:0` the
  state was `success`/`isOpen:true` and a second fetch for `''` fired, violating AC 1's
  "returns to the initial state." **Fixed** by extracting a single `resetToInitial(value)` helper
  that both the below-threshold branch and `clear()` route through; `clear()` now calls it directly,
  making the reset unconditional (one reset path, zero duplication preserved). Added a
  `minChars={0}` regression test (`useAutocomplete.test.tsx`). No other findings. Full suite
  re-run green after the fix (219 unit-integration, 14 e2e).

### File List

- `src/lib/autocomplete/useAutocomplete.ts` — UPDATE — `clear()` (delegates to `onInputChange('')`),
  exposed on `handlers`.
- `src/lib/autocomplete/types.ts` — UPDATE — doc `clear` on `AutocompleteHandlers<T>`, `clearLabel`
  on `AutocompleteProps<T>`.
- `src/lib/autocomplete/Autocomplete.tsx` — UPDATE — conditional clear button (inline-SVG glyph),
  `clearLabel` prop + default, `clearInput` handler.
- `src/lib/autocomplete/Autocomplete.module.css` — UPDATE — `.clear` styling in the trailing lane.
- `src/lib/autocomplete/useAutocomplete.test.tsx` — UPDATE — `clear()` cases.
- `src/lib/autocomplete/Autocomplete.test.tsx` — UPDATE — clear button behavior.
- `README.md` — UPDATE — `clearLabel` prop row + `clear` handler mention.
- `docs/features/epic-3-demo-e2e-launch/3-6-clearable-input/README.md` — NEW.
- `docs/features/epic-3-demo-e2e-launch/3-6-clearable-input/MANUAL_TESTING.md` — NEW.
- `docs/implementation-artifacts/3-6-clearable-input.md` — UPDATE — Dev Agent Record.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-12 | 0.1 | Follow-up story drafted from the post-release UX pass: generic clear ("×") button in the lib layer — `handlers.clear()` on the hook, conditional button in the trailing input lane, `clearLabel` prop, full a11y treatment; Escape semantics unchanged. | Łukasz (via BMAD create-story) |
| 2026-07-12 | 1.0 | Implemented (test-first): `handlers.clear()` via a shared `resetToInitial` reset path, conditional trailing-lane clear button with inline-SVG glyph, `clearLabel` prop, full a11y + token theming (verified on both demo instances). Pre-PR review gate run: security review clean; codex second pass found one Medium (`minChars=0` reset), triaged/confirmed/fixed with a regression test. Full suite green (219 unit-integration, 14 e2e). Status → review. | Dev agent (dev-story) |

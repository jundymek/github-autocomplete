---
baseline_commit: 592e6f4549ff705f065ba4bdc588da661d9e0027
---

# Story 3.10: Popup fits the viewport — clamp the dropdown height to available space, flip above when below is too tight

Status: Done

## Story

As a user of any `Autocomplete<T>` instance in a short browser window (or with the input scrolled
near the bottom of the viewport),
I want the dropdown to always fit inside the visible viewport — shrinking its scrollable list to
the available space, and opening above the input when there is clearly more room there,
so that no result rows (or the footer) are ever cut off by the viewport edge with no way to reach
them (NFR-1 usability; FR-6 result visibility).

## Background (defect origin)

Reported by the project owner (2026-07-12, over commit `592e6f4`): "when my window is small, the
dropdown does not fit" — the results list is visibly cut by the bottom edge of the browser window
(screenshot: the list ends exactly at the viewport edge mid-row).

Root cause, verified in code:

- The popup is portalled to `document.body` and positioned `position: fixed` at
  `rect.bottom + GAP_BELOW_INPUT_PX` (`usePopupStyle` / `measure()` in `Autocomplete.tsx`) —
  **always below the input, never measured against the space that is actually available below.**
- The only height limit is static: `.list { max-height: var(--ac-dropdown-max-height, 368px) }`
  (`Autocomplete.module.css`), independent of the viewport.
- Because the popup is `position: fixed`, it is pinned to the viewport: **scrolling the page can
  never reveal the cut-off part.** Whatever does not fit below the input is simply unreachable —
  by mouse, keyboard scroll, or scrollbar. (Keyboard highlight still works because `scrollIntoView`
  scrolls the inner `.list`, but the popup box itself stays clipped.)

The fix belongs in the **generic lib**: `usePopupStyle` owns the popup geometry (AR-4), and the
defect affects every `Autocomplete<T>` host, not just the GitHub demo.
[Source: user bug report 2026-07-12; src/lib/autocomplete/Autocomplete.tsx (`usePopupStyle`,
`GAP_BELOW_INPUT_PX`); src/lib/autocomplete/Autocomplete.module.css (`.pop`, `.list`);
src/lib/autocomplete/tokens.css (`--ac-dropdown-max-height`)]

## Chosen solution (and why)

**Clamp + flip, hand-rolled in `measure()` — no positioning library.**

1. **Clamp (primary):** every `measure()` pass computes the free space below the input
   (`window.innerHeight - rect.bottom - GAP_BELOW_INPUT_PX - VIEWPORT_MARGIN_PX`) and sets an
   inline `maxHeight` on the popup. The popup becomes a flex column so the inner `.list` shrinks
   and scrolls while messages and the footer stay visible. This alone fixes the reported
   screenshot: the list gets shorter and scrolls internally instead of being clipped.
2. **Flip (completeness):** clamping has a floor — a 40px popup is not usable. When the space
   below is smaller than `MIN_POPUP_MAX_HEIGHT_PX` **and** the space above the input is larger,
   the popup opens above the input (`bottom`-anchored) and clamps to the space above. Without
   this, an input near the bottom of a scrolled page still produces a clipped or unusably short
   popup — clamp-only is not a complete fix.

Why not only-clamp: see the floor case above. Why not a positioning library (Floating UI):
the deliverable advertises **zero runtime deps** and the component must stay self-contained
(AR-1/AR-4); `measure()` already re-runs on `scroll` (capture) and `resize`, so both the clamp
and the flip decision stay fresh for free — the whole fix is a handful of lines in code we
already own. Why not `position: absolute` in-flow (so the page could scroll to reveal it):
the portal + `fixed` architecture was chosen deliberately (escapes `overflow: hidden` ancestors,
Story 1.3) — reverting it would be a regression, not a fix.

## Acceptance Criteria

1. **The popup never overflows the viewport (UPDATE `Autocomplete.tsx` — `usePopupStyle`).** On
   every `measure()` pass the inline style includes a `maxHeight` equal to the free space on the
   chosen side (below by default) minus `VIEWPORT_MARGIN_PX` (new constant, 8px) of breathing room
   from the viewport edge. The popup's rendered bottom edge (or top edge when flipped) never
   crosses the viewport boundary, at any window height and any input position.
2. **The inner list shrinks and scrolls; chrome stays visible (UPDATE `Autocomplete.module.css`).**
   `.pop` becomes `display: flex; flex-direction: column; box-sizing: border-box`. `.list` gets
   `min-height: 0` and keeps `overflow-y: auto` and its `--ac-dropdown-max-height` cap — the token
   remains the upper bound; the viewport clamp can only make the popup smaller, never larger.
   Loading/empty/error messages (`popupBody()`) and the `.foot` footer are never clipped — the
   list absorbs all shrinkage.
3. **Flip above when below is too tight.** When free space below `< MIN_POPUP_MAX_HEIGHT_PX` (new
   constant, 160px ≈ 3 rows + chrome) **and** free space above is greater, the popup is anchored
   above the input: inline `bottom: window.innerHeight - rect.top + GAP_BELOW_INPUT_PX` (and
   `top: 'auto'`), `maxHeight` clamped to the space above. Otherwise it stays below (below is
   preferred; equal-or-worse space above never flips). The flip decision is re-evaluated on every
   `measure()` — resizing or scrolling flips back when space below recovers.
4. **No behavioral regressions.** Keyboard navigation, highlight `scrollIntoView`, outside-press
   dismiss (the popup node is still one element for the "inside" test), reopen paths (1.5, 3.9),
   accept-close (3.7), and the token bridge (`AC_TOKENS`) are unchanged. The style-memo guard in
   `setStyle` keeps working (no re-render loops from `measure()` on scroll).
5. **ARIA/axe unaffected.** No ARIA wiring changes; axe stays clean, including a flipped-popup
   state.
6. **Tests (test-first).**
   - Component (RTL, `Autocomplete.test.tsx` or a new `Autocomplete.position.test.tsx`): with a
     mocked `getBoundingClientRect`/`window.innerHeight`, assert (a) plenty of space below →
     `top`-anchored, `maxHeight` = space below − margin; (b) tight below, roomy above → flipped:
     `bottom`-anchored, `maxHeight` = space above − margin; (c) tight on both sides → stays below,
     clamped (no flip when above is not better); (d) `resize` re-measures and un-flips when space
     below recovers.
   - Existing tests keep passing without behavioral edits.
7. **E2E — one thin spec.** New `e2e/viewport-fit.spec.ts`: set a short viewport (e.g. 1280×400),
   open results, assert the popup's bounding box fits fully inside the viewport and the last
   option can be scrolled to and clicked inside the list. Axe on the open (short-viewport) state.
8. **Everything stays green.** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` all pass.

## Tasks / Subtasks

- [x] Task 1 — Geometry: clamp + flip in `usePopupStyle` (AC: 1, 3, 4) — test-first
  - [x] Add the AC 6 position tests (red).
  - [x] In `measure()`: compute `spaceBelow`/`spaceAbove` from `rect` and `window.innerHeight`;
        decide side (below unless the AC 3 flip condition holds); emit `top` **or** `bottom` plus
        `maxHeight` in the same inline-style object (single `setStyle`, memo guard untouched) (green).
- [x] Task 2 — CSS: flex-column popup, shrinkable list (AC: 2)
  - [x] `.pop` → flex column + `box-sizing: border-box`; `.list` → `min-height: 0` (keeps token
        max-height and `overflow-y: auto`). Verify messages and footer never clip.
- [x] Task 3 — E2E (AC: 5, 7)
  - [x] New `e2e/viewport-fit.spec.ts` (short viewport; popup inside viewport; last option
        reachable; axe clean).
- [x] Task 4 — Verify (AC: 4, 8)
  - [x] Full suite: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`.
  - [x] `pnpm dev` spot-check on BOTH instances: short window → list shrinks + scrolls, footer
        visible; scroll input near the page bottom → popup flips above; resize back → un-flips.
- [x] Task 5 — Docs (deliverables below)
  - [x] `docs/features/epic-3-demo-e2e-launch/3-10-dropdown-viewport-fit/README.md`.
  - [x] `.../MANUAL_TESTING.md` (short-window clamp; flip above; resize re-measure; both instances).

## Non-goals (deliberate)

- **No positioning library** (Floating UI etc.) — zero runtime deps stays true; the two constants
  + one branch do not justify a dependency.
- **No horizontal collision handling.** The popup keeps `left`/`width` mirroring the input; a
  window narrower than the input clips horizontally today and that is a separate (theoretical)
  story — the input itself is responsive, so the popup is too.
- **No `visualViewport` / on-screen-keyboard handling.** Mobile soft-keyboard geometry is out of
  scope for this desktop-brief deliverable; `window.innerHeight` is the contract.
- **No new public API.** No new props or tokens; `--ac-dropdown-max-height` keeps its meaning as
  the upper cap. `VIEWPORT_MARGIN_PX` and `MIN_POPUP_MAX_HEIGHT_PX` are internal constants like
  `GAP_BELOW_INPUT_PX`.
- **No animation changes.** `ac-in` (translateY 4px) plays identically on a flipped popup; not
  worth a mirrored keyframe.

## Dev Notes

**Current state (verified 2026-07-12, commit 592e6f4).**
- `usePopupStyle` (`Autocomplete.tsx:126-170`) builds the whole inline style in `measure()`:
  `position: fixed`, `top: rect.bottom + GAP_BELOW_INPUT_PX` (6), `left`, `width`, plus the
  bridged `AC_TOKENS` custom-property values. Listeners: `scroll` (capture) + `resize`, both
  already re-running `measure()` — the clamp/flip needs **no new listeners**.
- `setStyle` has a shallow-equality memo (`Autocomplete.tsx:150-157`) so scroll storms do not
  re-render; the new `maxHeight`/`bottom` keys flow through it unchanged. Emit numbers (px) like
  the existing keys.
- The popup element (`.pop`) contains, in order: the `.list` UL (only element that may scroll),
  `popupBody()` (loading/empty/error/hint messages), and the optional `.foot` footer with
  negative margins (`margin: 6px -6px -6px`) — flex-column layout must keep the footer's
  full-bleed trick working (it does: negative margins are orthogonal to flex sizing, but verify
  visually).
- When anchored above, prefer `bottom: window.innerHeight - rect.top + GAP_BELOW_INPUT_PX` over a
  computed `top`: with `bottom`-anchoring the popup **grows upward** as results arrive, keeping
  the gap to the input constant — a computed `top` would need the popup's own height, which is
  unknown before render (avoids a measure-after-render double pass).
- One inline-style subtlety: when flipping, also emit `top: 'auto'` — React removes omitted keys
  on re-render of the same element, but the memo guard compares key sets, so being explicit keeps
  the comparison honest and the intent readable. Mirror with `bottom: 'auto'` when below.
- RTL/jsdom has no layout: mock `anchor.getBoundingClientRect` and stub `window.innerHeight`
  per test (the existing `Autocomplete.test.tsx` popup-position tests show the pattern — reuse
  their harness). Fire `window.dispatchEvent(new Event('resize'))` for the re-measure case.
- E2E: `page.setViewportSize({ width: 1280, height: 400 })`, then compare
  `popup.boundingBox()` against the viewport. The e2e harness already stubs the GitHub API
  (see e2e network-isolation notes) — no new fixtures needed.

**Why 160px for `MIN_POPUP_MAX_HEIGHT_PX`.** ≈ 3 result rows (each ~44px: 28px glyph + 2×8px
padding) + popup padding/border — the smallest popup that still communicates "there is a list
here and it scrolls". Below that, a flip (when profitable) serves the user better than a sliver.

**No new dependency; no version changes (AR-1). No `types.ts` change** — no public surface.

**Branch & PR.** `story/3-10-dropdown-viewport-fit` → `master`, squash. Commit e.g.
`fix(3.10): clamp the popup to the viewport and flip above when space below is tight`. **No AI
attribution / no `Co-Authored-By`.** Run the mandatory pre-PR review gate (security review +
independent second-pass review + verified triage), execute MANUAL_TESTING.md yourself and report
the outcome in the PR, re-run the full verification after any fix, then PR.
[Source: CLAUDE.md#Working rules / #Story pipeline]

### Project Structure Notes

- Files this story touches:
  - `src/lib/autocomplete/Autocomplete.tsx` — UPDATE — clamp + flip in `usePopupStyle`'s
    `measure()`; `VIEWPORT_MARGIN_PX` / `MIN_POPUP_MAX_HEIGHT_PX` constants (AC 1, 3).
  - `src/lib/autocomplete/Autocomplete.module.css` — UPDATE — `.pop` flex column, `.list`
    `min-height: 0` (AC 2).
  - `src/lib/autocomplete/Autocomplete.position.test.tsx` — NEW (or extend `Autocomplete.test.tsx`)
    — geometry tests (AC 6).
  - `e2e/viewport-fit.spec.ts` — NEW — short-viewport fit + axe (AC 7).
  - `docs/features/epic-3-demo-e2e-launch/3-10-dropdown-viewport-fit/{README.md,MANUAL_TESTING.md}` — NEW.
  - `docs/implementation-artifacts/3-10-dropdown-viewport-fit.md` — UPDATE — Dev Agent Record on completion.
- `useAutocomplete.ts`, `types.ts`, `tokens.css`, `src/features/`, `src/demo/` expected UNCHANGED —
  the fix is pure popup geometry; both instances inherit it through the component. Touch only if a
  test proves a genuine gap.
- **MANUAL_TESTING.md required** (visible browser behavior). **PERFORMANCE.md not required**: the
  work adds arithmetic to an existing measure pass behind an existing memo guard — no new render
  volume, timers, or requests.
  [Source: CLAUDE.md#Documentation deliverables]

### References

- [Source: user bug report, 2026-07-12, over commit 592e6f4 — "when the window is small the
  dropdown does not fit"; screenshot shows the list clipped at the bottom viewport edge]
- [Source: src/lib/autocomplete/Autocomplete.tsx — `usePopupStyle` / `measure()` /
  `GAP_BELOW_INPUT_PX` / `AC_TOKENS` bridge / `setStyle` memo guard; popup children order]
- [Source: src/lib/autocomplete/Autocomplete.module.css — `.pop` chrome, `.list` max-height +
  overflow, `.foot` negative-margin full bleed]
- [Source: src/lib/autocomplete/tokens.css — `--ac-dropdown-max-height: 368px`]
- [Source: docs/implementation-artifacts/1-3-autocomplete-component.md — portal + `position: fixed`
  architecture this story deliberately keeps]
- [Source: docs/planning-artifacts/architecture.md#AR-1 (no new deps) / #AR-4 (self-contained
  generic component owns popup geometry)]
- [Source: CLAUDE.md#Architecture boundary / #Working rules / #Story pipeline / #Documentation deliverables]

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5) via Claude Code

### Implementation Plan

1. Test-first: new `src/lib/autocomplete/Autocomplete.position.test.tsx` mocking the anchor's
   `getBoundingClientRect` and `window.innerHeight` — four cases: (a) roomy below → `top`-anchored
   with `maxHeight` = space below − margin; (b) tight below, roomy above → flipped (`bottom`
   anchored, `top: auto`, `maxHeight` = space above − margin); (c) tight on both sides → stays
   below, clamped; (d) `resize` re-measures and un-flips.
2. `usePopupStyle.measure()`: compute `spaceBelow`/`spaceAbove` from the rect,
   `window.innerHeight`, `GAP_BELOW_INPUT_PX` and new `VIEWPORT_MARGIN_PX` (8); flip when
   `spaceBelow < MIN_POPUP_MAX_HEIGHT_PX` (160) and `spaceAbove > spaceBelow`; emit `top` or
   `bottom` (the inactive one explicitly `'auto'`) + `maxHeight` in the same style object so the
   `setStyle` memo guard keeps working.
3. CSS: `.pop` → flex column (+ explicit `box-sizing: border-box`); `.list` → `min-height: 0`
   (keeps `--ac-dropdown-max-height` cap and `overflow-y: auto`) so the list absorbs all shrinkage
   and messages/footer stay visible.
4. New thin `e2e/viewport-fit.spec.ts`: 1280×400 viewport, big fixture — popup bounding box fully
   inside the viewport, last option scrollable + clickable, axe clean on the open state.
5. Full verification, manual browser check on both demo instances, docs folder, review gate, PR.

### Debug Log References

None — implementation went test-first with no debugging detours.

### Completion Notes List

- Clamp + flip implemented exactly per AC 1/3 inside `usePopupStyle.measure()`; both `top` and
  `bottom` are always emitted (the inactive side `'auto'`) so the `setStyle` memo guard compares
  identical key sets across flip states. `maxHeight` is clamped to ≥ 0.
- CSS went one step further than AC 2 after review: `min-height: 0; overflow-y: auto` is applied
  to **every** non-footer popup child (`.pop > :not(.foot)`), not only `.list`. The independent
  second-pass review (Codex) correctly found that shrinking only the list would let list-less
  bodies (a tall error block with retry, skeletons, hint) overflow the clamped popup; the footer
  gets `flex-shrink: 0`. Verified in a real 260px-tall window: the error state flips above and the
  retry button stays reachable.
- Tests: 7 RTL geometry tests (`Autocomplete.position.test.tsx`) — the four AC 6 cases plus an
  equal-space no-flip case, a scroll-event re-measure case (second review finding), and a
  never-negative `maxHeight` case. New thin `e2e/viewport-fit.spec.ts` (3 tests): popup + footer
  fully inside a 1280×400 viewport, last of 50 options reachable/clickable (stubbed new tab), axe
  clean. All existing tests pass without behavioral edits.
- Review gate: security review — no findings (pure client-side geometry over trusted browser
  APIs feeding React's `style` prop). Codex second pass — 2 findings, both triaged valid and
  fixed (CSS selector broadened; scroll re-measure test added); full verification re-run green.
- Manual testing executed per MANUAL_TESTING.md in real Chromium against `pnpm dev` (real GitHub
  API): short-window clamp with internal scroll + visible footer (GitHub instance), flip above
  near the page bottom (countries instance), un-flip after resize — all confirmed with
  screenshots and bounding-box measurements.
- Final verification: `pnpm lint && pnpm typecheck && pnpm test` (249 passed) and
  `pnpm test:e2e` (18 passed) — all green.

### File List

- `src/lib/autocomplete/Autocomplete.tsx` — UPDATE — clamp + flip in `usePopupStyle.measure()`;
  `VIEWPORT_MARGIN_PX` / `MIN_POPUP_MAX_HEIGHT_PX` constants.
- `src/lib/autocomplete/Autocomplete.module.css` — UPDATE — `.pop` flex column;
  `.pop > :not(.foot)` shrink/scroll rule; `.list` `min-height: 0`; `.foot` `flex-shrink: 0`.
- `src/lib/autocomplete/Autocomplete.position.test.tsx` — NEW — 7 popup-geometry tests.
- `e2e/viewport-fit.spec.ts` — NEW — short-viewport fit + last-option reachability + axe.
- `docs/features/epic-3-demo-e2e-launch/3-10-dropdown-viewport-fit/README.md` — NEW.
- `docs/features/epic-3-demo-e2e-launch/3-10-dropdown-viewport-fit/MANUAL_TESTING.md` — NEW.
- `docs/implementation-artifacts/3-10-dropdown-viewport-fit.md` — UPDATE — Dev Agent Record.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-12 | 0.1 | Follow-up story drafted from the owner's bug report over commit 592e6f4: the fixed-position popup is placed below the input with a static 368px list cap and no viewport awareness, so in a short window it is clipped by the viewport edge and — being `position: fixed` — can never be scrolled into view. Fix: viewport-clamp the popup height on every measure pass (flex-column popup, shrinkable list) and flip above the input when space below is under a 160px floor and above is larger. Hand-rolled in `usePopupStyle` — no positioning dependency. | Łukasz (via Claude Code) |
| 2026-07-12 | 1.0 | Implemented: clamp + flip in `usePopupStyle.measure()`; flex-column popup with every non-footer child shrinkable/scrollable (broadened from list-only after second-pass review); 7 RTL geometry tests + thin viewport-fit e2e; review gate passed; full verification green. | Claude Code (dev agent) |

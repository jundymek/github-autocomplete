# 3.10 — Popup fits the viewport (clamp + flip)

## What was built

The portalled, `position: fixed` popup no longer overflows the viewport. Every `measure()` pass in
`usePopupStyle` now clamps the popup's `maxHeight` to the free space on the chosen side (with an
8px viewport margin), and flips the popup above the input when the space below is under a 160px
usability floor **and** the space above is larger. The popup is a flex column, so shrinkage is
absorbed entirely by the internal scrollable list — state messages and the footer stay visible.
Hand-rolled in code we already own; no positioning library, no new public API or tokens.

## Files touched

- `src/lib/autocomplete/Autocomplete.tsx` — UPDATE — clamp + flip in `usePopupStyle.measure()`;
  new internal constants `VIEWPORT_MARGIN_PX` (8) and `MIN_POPUP_MAX_HEIGHT_PX` (160).
- `src/lib/autocomplete/Autocomplete.module.css` — UPDATE — `.pop` becomes a flex column; every
  popup body (`.pop > :not(.foot)` — the list, state blocks, skeletons) gets `min-height: 0` +
  `overflow-y: auto` so it shrinks and scrolls inside the clamped popup; `.foot` gets
  `flex-shrink: 0`.
- `src/lib/autocomplete/Autocomplete.position.test.tsx` — NEW — seven RTL geometry tests (mocked
  `getBoundingClientRect` + `window.innerHeight`).
- `e2e/viewport-fit.spec.ts` — NEW — thin short-viewport (1280×400) spec: popup fits, last option
  reachable/clickable, axe clean.
- `docs/implementation-artifacts/3-10-dropdown-viewport-fit.md` — UPDATE — Dev Agent Record.

## Key decisions

- **Below is preferred; equal space never flips.** Flip only when below < 160px *and* above is
  strictly larger — resizing/scrolling re-measures and flips back automatically (the existing
  `scroll`-capture and `resize` listeners re-run `measure()`; no new listeners).
- **`bottom`-anchoring when flipped** (`bottom: innerHeight − rect.top + gap`, `top: 'auto'`): the
  popup grows upward as results arrive with a constant gap to the input, avoiding a
  measure-after-render double pass that a computed `top` would need.
- **Both `top` and `bottom` are always emitted** (inactive side `'auto'`) so the `setStyle`
  shallow-equality memo guard compares identical key sets across flip states — no re-render loops.
- **`maxHeight` is clamped to ≥ 0** for the degenerate case of an input touching the viewport edge.
- **`--ac-dropdown-max-height` keeps its meaning** as the upper cap on the list; the viewport clamp
  can only make the popup smaller, never larger.

## How it works

`measure()` computes `spaceBelow = innerHeight − rect.bottom − gap − margin` and
`spaceAbove = rect.top − gap − margin`, picks the side, and emits `top`/`bottom` + `maxHeight` in
the same inline-style object as before. CSS-side, `.pop { display: flex; flex-direction: column }`
plus `min-height: 0; overflow-y: auto` on every non-footer child make whichever body is present
(results list, error/empty/hint block, skeletons) shrink and scroll, while the footer
(`flex-shrink: 0`) stays whole — nothing is ever clipped by the viewport. (The second-pass review
caught that shrinking only `.list` would let list-less states — e.g. a tall error block — overflow
the clamped popup; hence the broader selector.)

## Tests

- Unit/integration (`Autocomplete.position.test.tsx`): top-anchored clamp with roomy space below;
  flip when tight below + roomy above; no flip when above is not larger (strictly-smaller and
  equal cases); resize re-measure un-flips; scroll re-measure flips; `maxHeight` never negative.
- E2E (`viewport-fit.spec.ts`): 1280×400 viewport with the 50-item fixture — popup bounding box
  fully inside the viewport with the footer visible; last option scroll-reachable and clickable
  (opens the stubbed new tab); axe clean on the open short-viewport state.
- Manual: see MANUAL_TESTING.md.

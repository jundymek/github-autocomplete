# Manual testing — 3.5 Sticky footer on tall viewports

## Prerequisites

- `pnpm dev` and open the printed local URL (e.g. `http://localhost:5173`).

## Steps

1. **Tall viewport.** Maximize the browser window on a tall screen (or use DevTools device toolbar
   at ~1400 px height, responsive). Load `/`.
2. **Short viewport.** Shrink the window height to ~600 px (content taller than the viewport). Scroll
   the page.
3. **Narrow / single-column breakpoint.** Set the width below 860 px so the stage collapses to one
   column. Scroll.
4. **Dropdown open with many results.** In the GitHub panel, type a query that returns many results
   (e.g. `react`); wait for the dropdown to open with up to 50 results.
5. **Clipping host route.** Navigate to `/?clip=1`.

## Expected

1. The footer's bottom edge sits flush with the bottom of the viewport. The canvas gap is absorbed
   *above* the footer's top border (bare canvas extends up to the footer line, none below it). The
   footer is not stretched.
2. The page scrolls normally; the footer follows the content to the bottom of the scrollable area
   (it is not pinned to the viewport and does not overlap content). Nothing clips.
3. Same as step 2 — single-column layout scrolls as before; footer follows content, no clipping or
   overlap.
4. The dropdown opens and is fully visible; the page grows/scrolls to accommodate it exactly as
   before. The sticky-footer column does not clip or reposition the portalled dropdown.
5. The clipping-host demo renders as before (no footer in this mode); the `.wrap > ClippingHost`
   layout is unchanged.

## Accessibility checks

- Keyboard focus order and visible focus are unchanged (the change is layout-only; no elements added
  or reordered).
- The e2e axe scan on `/` remains green — no new contrast or landmark issues introduced.

## Result (self-verified 2026-07-12)

Executed against a real `pnpm build && pnpm preview` app, driving Chromium and measuring geometry:

- **Tall (1200×1400):** footer bottom = 1400 px = viewport height, page not scrollable — footer
  pinned; `margin-top: auto` absorbed ~539 px above the footer border. ✅
- **Short (1200×600):** page scrollable (scrollHeight 861 > 600), `footer` margin-top collapses to
  0 — scrolls as before. ✅
- **Narrow (700×600):** `.stage` is single-column, page scrollable — unaffected. ✅
- **Clipping host (`/?clip=1`):** no footer rendered, `#root` has a single `.wrap` child — route
  intact. ✅

The dropdown-open-with-50-results case is covered by the e2e clipping spec (height-bounded list),
which passes unmodified. All checks PASS.

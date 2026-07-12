# 3.5 — Demo polish: pin the footer to the bottom of tall viewports

## What was built

A standard sticky-footer column on the demo page so that, on viewports taller than the page
content, the footer's bottom edge sits at the bottom of the viewport instead of floating mid-page
with bare canvas below it. The spare vertical space is absorbed *above* the footer's top border, so
the canvas simply extends up to the footer line — the intended finished look.

This is a demo-chrome-only change: nothing under `src/lib/autocomplete/` is touched (the reusable
component imposes no layout on a host — AR-5/NFR-5), and the `?clip=1` clipping host route is
unaffected.

## Files touched

- `src/demo/demo.css` — UPDATE — `#root` becomes a min-full-height flex column
  (`display: flex; flex-direction: column; min-height: 100vh; min-height: 100dvh;`) and the existing
  `footer` rule gains `margin-top: auto`.
- `docs/design/demo-page.html` — UPDATE — same pattern ported into the design ground truth so the
  mockup and the app do not drift. There `body` is the flex column (that file wraps `.wrap` +
  `footer` directly in `body`; the app uses `#root` because React mounts there).
- `docs/features/epic-3-demo-e2e-launch/3-5-sticky-footer/README.md` — NEW — this file.
- `docs/features/epic-3-demo-e2e-launch/3-5-sticky-footer/MANUAL_TESTING.md` — NEW — visual
  verification steps.

## Key decisions

- **`#root`, not `body`, in the app.** React mounts the footer as a child of `#root`, so `#root`
  must be the flex container for `margin-top: auto` to reach the footer. Styling `body` instead
  would require `#root { display: contents }` or a grown flex child — more moving parts for the same
  result.
- **`min-height`, never `height`.** `min-height` guarantees the column can still grow past the
  viewport when content is taller (the 860 px single-column breakpoint, or the dropdown open with 50
  results), so short viewports scroll exactly as before. `height: 100vh` would clip.
- **`100vh` then `100dvh`.** The `vh` line is the fallback for browsers without dynamic viewport
  units; `dvh` last so it wins where supported and avoids the mobile URL-bar overshoot of plain
  `vh`. This mirrors the project's "latest platform feature with graceful fallback" posture (AR-1).
- **No `flex: 1` on `.wrap`.** Unnecessary — with `footer { margin-top: auto }` the slack lands
  between `.wrap` and the footer border, which is the intended look. Stretching `.wrap` would change
  nothing visible.
- **No `position: sticky`/`fixed`.** The footer must not overlay content or persist while scrolling;
  the requirement is only "no dead canvas below the footer on tall screens".
- **Design HTML uses `body` as the column.** That file has no `#root`; matching AC 6, `body` gets
  the column rules there so the two files stay visually in parity.

## How it works

`#root` is a vertical flex column of at least the viewport height. Its children in the primary
layout are `.wrap` (header + stage) and `<footer>`. `footer { margin-top: auto }` consumes all free
space above the footer, pushing it to the column's bottom edge on tall viewports. When content
exceeds the viewport, `min-height` lets the column grow and the page scrolls normally — the footer
then simply follows the content as before.

In `/?clip=1` mode the app renders only `<div class="wrap"><ClippingHost /></div>` (no footer), so
the flex column has a single child and the layout inside `.wrap` is unchanged.

## Tests

- Unit/integration: none added — this is a CSS-only story with no logic surface. The full existing
  suite (unit + e2e, including the axe scan and the clipping-host spec) is the regression net
  (AC 5). All green.
- Manual: see [MANUAL_TESTING.md](./MANUAL_TESTING.md) — tall viewport (footer pinned), short/narrow
  viewport (scrolls as before), dropdown open with 50 results (unchanged), `/?clip=1` (clipping host
  renders as before).

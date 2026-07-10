# Manual testing — 1.4 Outside-click / focus-loss dismissal

## Prerequisites

`pnpm dev`, then open the Story 3.1 demo. Both instances (GitHub search + country) exercise the
same lib component, so either proves the fix. The **country** instance is static/offline — use it to
avoid GitHub rate limits.

## Steps and expected results

1. **Outside click closes results, query retained.**
   In the country input, type `pol` and wait for results.
   *Expected:* the dropdown opens (`aria-expanded="true"`, "Poland" listed). Now click anywhere else
   on the page (header, empty area). *Expected:* the dropdown closes (`aria-expanded="false"`) and
   the input still shows `pol` — the text is **not** cleared. No new request fires.

2. **Clicking an option still selects it — no premature close.**
   Type `ger`, then click the "Germany" row (not outside).
   *Expected:* the selection resolves (the demo's selected-country readout updates to Germany). The
   press inside the popup is **not** treated as "outside", so it is not swallowed. Selection fires
   exactly once. (This component does not auto-close on select — behavior unchanged from before.)

3. **Escape still works (regression check).**
   Type `port`, wait for results, press `Escape`.
   *Expected:* the dropdown closes, the query `port` stays in the input, focus stays on the input.

4. **Below-threshold hint dismisses on outside press.**
   Clear the input and type `po` (below the 3-char minimum).
   *Expected:* a small "Type 1 more character to search" hint popup appears. Click elsewhere on the
   page. *Expected:* the hint disappears. Type another character (`pol`) and results appear again.

5. **Both instances behave identically.**
   Repeat step 1 in the GitHub instance (e.g. type `react`).
   *Expected:* same outside-click dismissal — confirming the fix is in the shared lib component, not
   special-cased per demo.

## Accessibility checks

- **Pointer + keyboard parity:** outside-press dismissal reaches the same state as Escape
  (`aria-expanded="false"`, highlight cleared, query kept).
- **No focus trap / no stolen clicks:** clicking an option always selects; clicking the footer or
  scrollbar inside the popup does not close it.
- **Touch/pen:** because the close is driven by `pointerdown`, tapping outside on a touch device
  closes the dropdown the same way a mouse press does.

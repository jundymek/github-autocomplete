# Manual testing — 3.7 Close the popup on selection

Verifies that selecting an option closes the combobox (by keyboard **and** by mouse) on
**both** demo instances, that the searched query is preserved, and that reopen-on-focus
(Story 1.5) still works afterwards.

## Prerequisites

- `pnpm dev` (or `pnpm build && pnpm preview`) and open the demo in a browser.
- The GitHub instance calls the live GitHub Search API. If you hit the rate limit, use
  the country instance for the same checks — the behavior under test is identical and
  lives in the shared lib layer.

## Steps & expected results

### A. GitHub instance — keyboard accept

1. Click the **Search GitHub** input and type `react`.
   - **Expected:** after ~300 ms a dropdown of merged users + repos opens
     (`aria-expanded` becomes `true`).
2. Press **ArrowDown** once to highlight the first option, then press **Enter**.
   - **Expected:** a new browser tab opens to the highlighted item's GitHub page **and
     the dropdown closes** — no list is left visible behind the new tab. The input still
     reads `react`.
3. Return to the demo tab and click back into the **Search GitHub** input (do not retype).
   - **Expected:** the same results reopen immediately (reopen-on-focus, Story 1.5) with
     no new network request and no loading flash.

### B. GitHub instance — mouse accept

1. In the **Search GitHub** input type `react` and wait for the dropdown.
2. **Click** any option with the mouse.
   - **Expected:** a new tab opens to that item **and the dropdown closes**. The input
     keeps `react`.
3. Refocus the input.
   - **Expected:** results reopen (1.5), unchanged.

### C. Country instance — keyboard accept

1. Click the **Search countries** input and type `pol`.
   - **Expected:** a dropdown of matching countries (e.g. Poland, French Polynesia) opens.
2. Press **ArrowDown** to highlight the first option, then press **Enter**.
   - **Expected:** the "selected country" readout updates **and the dropdown closes**. The
     input still reads `pol`.
3. Refocus the input without retyping.
   - **Expected:** the same country results reopen (1.5).

### D. Country instance — mouse accept

1. Type `pol` in **Search countries** and wait for the dropdown.
2. **Click** a country.
   - **Expected:** the readout updates **and the dropdown closes**; the input keeps `pol`.
3. Refocus the input.
   - **Expected:** results reopen (1.5).

## Accessibility checks

- After every accept (keyboard or mouse, either instance) the input's `aria-expanded` is
  `false` and it has **no** `aria-activedescendant` (inspect the element, or use a screen
  reader — it should announce the combobox as collapsed after selection).
- Focus never leaves the input on accept — no focus jump or blur; the caret stays in the
  input (activedescendant technique, not roving focus).
- Escape, outside-click dismissal, and the clear ("×") button are unchanged.

## Result of running these steps

Executed on 2026-07-12 through a real Chromium browser against the preview build, both
instances, keyboard and mouse (16 assertions total: dropdown opens; closes after accept
with `aria-expanded="false"` and zero options; query preserved; reopen-on-focus re-shows
the same result count). **All 16 checks passed.**

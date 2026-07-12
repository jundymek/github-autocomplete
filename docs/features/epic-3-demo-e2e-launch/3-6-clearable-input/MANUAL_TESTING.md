# Manual testing — 3.6 Clearable input

## Prerequisites

- `pnpm dev`, open the demo (Vite prints the local URL, e.g. `http://localhost:5173/`).
- Two instances are on the page: **GitHub** (left) and **Countries** (right, teal theme).

## Steps & expected

### A. Pointer path — GitHub instance

1. Click the GitHub input and type `react` (≥ 3 chars). Wait for results.
   - **Expected:** results dropdown opens; a small "×" button appears at the input's right edge.
     While the request is in flight the three pulsing dots occupy that lane instead (no "×", no
     layout shift as it toggles).
2. Click the "×".
   - **Expected:** the input empties, the dropdown closes, and the **text cursor is back in the
     input** (focus returned). The "×" disappears because the query is empty.
3. Type a single character, then delete it.
   - **Expected:** the "×" appears with the first character and disappears when the field is empty
     again.

### B. Keyboard path — tab order & activation

1. Click the GitHub input and type `react`.
2. Press **Tab** once.
   - **Expected:** focus moves from the input to the "×" button (a visible accent focus ring). The
     button is the next element in natural tab order after the input.
3. Press **Enter** (or **Space**).
   - **Expected:** the query clears and the dropdown closes, exactly like a click. (Focus returns to
     the input.)

### C. Escape is unchanged (regression)

1. Type `react`, wait for results, press **Escape**.
   - **Expected:** the dropdown closes but the query **`react` stays** in the input, and the "×"
     button is still shown (query non-empty, not loading). Escape does **not** clear — only the "×"
     (or manual deletion) empties the field.

### D. Country instance — reuse + theming proof

1. In the **Countries** input (right), type `pol`.
   - **Expected:** results show; the same "×" button appears — no country-specific code added it, it
     is inherited from the lib layer.
2. Hover the "×".
   - **Expected:** the glyph turns **teal** (`#0F766E`), matching the country panel's
     `--ac-color-accent` override — not the GitHub purple. This proves the button is themed purely
     through `--ac-*` tokens (no pierced selectors).
3. Click the "×".
   - **Expected:** the country input empties, the dropdown closes, focus returns to the input.

## Accessibility checks

- **Keyboard:** the "×" is reachable by Tab (input → button), and Enter/Space activate it natively
  (no custom key handling). A visible accent focus ring appears on `:focus-visible`.
- **Screen reader:** the button announces its accessible name — `Clear` by default, or the value of
  the `clearLabel` prop. The glyph SVG is `aria-hidden`, so only the label is read.
- **No ARIA regression:** the combobox contract is untouched — `aria-expanded`, `aria-controls`,
  `aria-activedescendant` behave as before; the popup closing after a clear flows from hook state,
  not extra ARIA wiring. (Verified by the automated axe scan on the open-with-results state.)

## Outcome (executed 2026-07-12)

Executed the pointer path, keyboard/tab-order path, Escape regression, and the country theming path
on both instances via an automated browser drive against `pnpm dev`. All expectations held:

- GitHub "×": visible with a query, hidden while loading (dots present), click clears + closes popup
  + returns focus; default accent `#6639BA`.
- Country "×": inherited with zero adapter code; default glyph muted (`rgb(89,99,110)`), **hover
  teal `rgb(15,118,110)` = `#0F766E`** from the panel's token override; click clears + returns
  focus + button disappears.
- Escape still keeps the query (unchanged).

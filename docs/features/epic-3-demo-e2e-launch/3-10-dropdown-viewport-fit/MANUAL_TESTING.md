# Manual testing — 3.10 Popup fits the viewport (clamp + flip)

## Prerequisites

`pnpm dev`, open the printed URL in a desktop browser.

## Steps

1. Make the browser window short (≈400px tall). In the **GitHub** instance, type `react` and wait
   for results.
2. Inside the open dropdown, scroll the list with the mouse wheel down to the last row and click it.
3. Press Escape. Make the window taller, then scroll the page so the **Country picker** input sits
   near the bottom edge of the window. Type `uni`.
4. With the countries popup open above the input, resize the window taller (or scroll the input
   back up toward the middle of the window).
5. Repeat step 1 with the **Country picker** in a short window (type `uni`) to confirm both
   instances behave identically.

## Expected

1. The dropdown fits entirely inside the window: the list is shortened and scrolls internally; the
   footer line ("50 of … · sorted A→Z") is visible at the popup's bottom edge — nothing is cut off
   by the viewport.
2. The last row can be reached by scrolling *inside* the list and clicking it opens the item in a
   new tab.
3. The popup opens **above** the input (more room above than below), fully visible, with the same
   small gap to the input.
4. The popup flips back **below** the input as soon as the space below recovers — no reopen needed.
5. Same clamp/flip behavior on the second instance (the fix lives in the generic component).

## Accessibility checks

- Keyboard: with a clamped (short) popup, ArrowDown/ArrowUp still moves the highlight and keeps it
  in view inside the scrolled list; Enter opens the highlighted item; Escape closes.
- Focus stays in the input the whole time (visible focus ring, no focus jumps on flip).
- Screen reader: announcements ("N results…") are unchanged — the fix is pure geometry; no ARIA
  changes.

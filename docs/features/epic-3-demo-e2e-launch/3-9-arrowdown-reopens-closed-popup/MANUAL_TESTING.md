# Manual testing — 3.9 ArrowDown/ArrowUp reopen a closed popup with retained results

## Prerequisites

`pnpm dev`, open the printed URL. Open the browser DevTools Network panel (filter: `api.github.com`).

## Steps

1. Focus the **Search GitHub** input and type `react`. Wait for results to appear (two requests in
   the Network panel: users + repositories).
2. Press **Escape** — the dropdown closes; the query stays; focus stays in the input.
3. Press **ArrowDown**.
4. Press **Escape** again, then press **ArrowUp**.
5. Press **Escape**, then **ArrowDown**, then **Enter**.
6. Clear the input, type `ab` (below threshold), and press **ArrowDown** / **ArrowUp**.
7. Reload, focus the empty input, press **ArrowDown**.
8. Repeat steps 1–4 on the second instance (**Search countries**) to prove the fix is generic.

## Expected

- Step 3: the dropdown reopens with the **same** results, the **first** option highlighted, and
  **zero** new requests in the Network panel.
- Step 4: the dropdown reopens with the **last** option highlighted; still no new requests.
- Step 5: the highlighted (first) option is accepted — GitHub result opens in a new tab; the popup
  closes.
- Step 6: the arrows only move the text caret; the hint popup behavior (3.8) is unchanged; nothing
  fetches.
- Step 7: nothing opens; the caret does not produce a dropdown (idle state, key stays native).
- Step 8: identical reopen behavior on the country instance (no network activity at all — static
  data).

## Accessibility checks

- After the ArrowDown reopen: the input has `aria-expanded="true"` and `aria-activedescendant`
  pointing at the highlighted option (inspect in DevTools); focus never leaves the input.
- With a screen reader, the reopen re-announces the results count ("N results") via the polite
  live region.
- Visible highlight on the first/last option matches the ArrowDown/ArrowUp direction.

# Manual testing — 1.5 Reopen-on-focus

## Prerequisites

`pnpm dev`, then open the Story 3.1 demo. Both instances (GitHub search + country) exercise the same
lib component. The **country** instance is static/offline; the **GitHub** instance uses the live API
(open the browser Network panel to prove no request fires on reopen).

## Steps and expected results

1. **Reopen with retained results, no refetch (GitHub).**
   In the GitHub input type `vuejs` and wait for results. Open the Network panel and note the
   `api.github.com` requests. Press `Escape` (or click elsewhere) to close — the input still reads
   `vuejs`. Now click back into the input.
   *Expected:* the dropdown reopens with the **same** results, `aria-expanded="true"`, and **no new
   `api.github.com` request** appears in the Network panel.

2. **Same on the static country instance.**
   Type `pol`, wait for results, press `Escape`, then click back into the input.
   *Expected:* the dropdown reopens with the same options; the query `pol` stays.

3. **Fresh input focus opens nothing.**
   Reload the page. Click into an input without typing.
   *Expected:* only a caret; no dropdown, `aria-expanded="false"`.

4. **Below-threshold focus shows the hint, not the results list.**
   Type `po` (below the 3-char minimum), then click away and back.
   *Expected:* the small "type N more characters" hint shows on focus (as before); the results
   listbox does not open (`aria-expanded="false"`).

5. **No flicker with outside-click (composes with Story 1.4).**
   Type `react`, wait for results, click outside to close, then click straight back into the input.
   *Expected:* the dropdown reopens cleanly — it does not open-then-immediately-close.

## Accessibility checks

- **Keyboard parity:** Tabbing into a closed input that holds a qualifying query with results
  reopens the dropdown the same way a click does (focus, not pointer, is the trigger).
- **No surprise requests:** reopening never hits the network — verifiable in the Network panel and by
  the unauthenticated GitHub rate limit not being consumed on reopen.
- **Combobox semantics:** `aria-expanded` flips back to `true` on reopen and the listbox/option
  ARIA relationships resolve exactly as after the original fetch.

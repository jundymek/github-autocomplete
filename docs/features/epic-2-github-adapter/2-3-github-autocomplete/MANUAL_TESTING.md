# Manual testing — 2.3 `GithubAutocomplete`

## Prerequisites

- `pnpm dev` and open the printed URL (e.g. `http://localhost:5173/`).
- The sandbox harness in `App.tsx` mounts a single `GithubAutocomplete`.
- Requests hit the **live** GitHub API (unauthenticated). Unauthenticated search is limited to ~10
  requests/minute — you can trigger the real rate-limit state simply by searching a few times in
  quick succession. Steps 5–6 below can also be reproduced deterministically with the automated
  driver (see "Automated re-run of these steps").

## Steps & expected

### 1. Merged, sorted results (design state 04)

1. Click the input and type `react` (≥ 3 chars).
2. **Expected:** after a short debounce, a dropdown lists merged users and repositories, sorted A→Z
   on the bare name/login. Each row shows, left→right: an icon (avatar **circle** for users, a
   `{ }` **tile** for repos), the name — repos also show a monospace `owner/repo` path — and a
   right-aligned **KIND** column (`user` / `repo`). The typed substring (`react`) is echoed in the
   accent (purple) color inside the name. Kinds are distinguishable **without color** (icon shape,
   mono path, KIND label).
3. **Footer:** reads **"X of Y · sorted A→Z"** (X = shown/capped count, Y = GitHub's total, e.g.
   `50 of 1,204 · sorted A→Z`) with `↑↓ browse · ↵ open` on the right.

### 2. Keyboard selection → new tab

1. Press **ArrowDown** to highlight the first row (highlight background + accent left bar).
2. Press **Enter**.
3. **Expected:** the highlighted item opens in a **new browser tab** at its GitHub URL; the current
   tab is unchanged — the input still shows `react` and the app keeps its state. The new tab is
   opened with `noopener,noreferrer` (no reverse-tabnabbing).

### 3. Click selection

1. Type `react` again and **click** any row.
2. **Expected:** identical behavior to Enter — the item opens in a new tab with the same
   `noopener,noreferrer`; the host page retains its state.

### 4. Rate-limit state (design state 08)

1. Search several times rapidly (or with an already-throttled IP) until GitHub returns HTTP 403.
2. **Expected:** an **amber** panel (not the red error) titled **"GitHub rate limit reached"**,
   left-aligned, naming the cause, showing a **countdown** ("Try again in Ns", when a `retry-after`
   is present) and a **token hint** ("Add a token to raise the limit"). There is **no** "Try again"
   button in this state.

### 5. Generic error + retry (design state 07)

1. Simulate a failure (e.g. go offline, or use the automated driver's 500 route).
2. **Expected:** a centered **"Search failed"** message (danger color) with a description and a
   **"Try again"** button.
3. Restore connectivity and click **Try again**.
4. **Expected:** the last query re-fires and results render (or the appropriate state shows).

## Accessibility checks

- **Keyboard-only:** the entire flow (type → ArrowDown/ArrowUp/Home/End → Enter) works without a
  mouse.
- **Focus stays on the input:** during navigation the DOM focus never leaves the `combobox` input;
  the highlighted option is referenced via `aria-activedescendant` (activedescendant pattern), and
  `aria-expanded` is `true` while the list is open.
- **Visible focus:** the input shows a clear accent focus ring.
- **Screen reader:** the visually-hidden `aria-live="polite"` region announces state changes
  (searching / N results / no matches / error message).

## Automated re-run of these steps

These steps were executed against the running app with a Playwright driver (in the session
scratchpad, not committed) that stubs the GitHub API to reproduce each state deterministically
(including the 403 rate-limit with `Access-Control-Expose-Headers` mirroring real GitHub, and a 500
error → retry → success). All 16 checks passed, and screenshots of states 04, 07 and 08 were
captured and confirmed to match the design ground truth. See the PR description for the run output.

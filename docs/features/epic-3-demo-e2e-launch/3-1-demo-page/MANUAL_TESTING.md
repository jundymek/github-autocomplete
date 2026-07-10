# Manual testing — 3.1 Demo page

## Prerequisites

- Node 22, pnpm ≥9, dependencies installed (`pnpm install`).
- Start the demo: `pnpm dev`, then open the printed URL (default http://localhost:5173).
- A network connection (instance 01 hits the live GitHub Search API, unauthenticated).

## Steps & expected

### 1. Page layout (AC 2, 8)

1. Load the page.
2. **Expected:** a centered column (max 1080px) with a header — eyebrow `code challenge · makers'
   den`, headline `One autocomplete, any data.` / `Here: github/*` (the `github/*` path in the
   purple accent), a lede mentioning `useAutocomplete<T>` and `<Autocomplete<T>>`, and a contract
   strip of four `▸` facts. Below it, two panels side by side; a footer at the bottom.
3. The headline + panel titles render in **Space Grotesk**; the eyebrow, contract strip, badges, and
   footer render in **JetBrains Mono**.

### 2. Instance 01 — GitHub (AC 3)

1. In the left panel ("GitHub users & repositories", badge `instance 01`), click the input and type
   `rea`.
2. **Expected:** after a brief debounce a dropdown lists merged users + repositories, sorted A→Z,
   with a footer like `50 of 1,204 · sorted A→Z`. Icons distinguish repos (`{ }` tile) from users
   (avatar). The accent (focus ring, highlighted row bar, `<mark>` echo) is **purple** (`#6639BA`).
3. Press `↓`/`↑` to move the highlight; press `Enter` (or click a row).
4. **Expected:** the selected item opens in a **new browser tab** (GitHub page). The demo page keeps
   its state.

### 3. Instance 02 — Country picker (AC 4, 6)

1. In the right panel ("Country picker", badge `instance 02 · same core`), type `pol`.
2. **Expected:** a dropdown lists `French Polynesia` (🇵🇫 · `Papeete · XPF`) and `Poland`
   (🇵🇱 · `Warsaw · PLN`), sorted A→Z, each with a flag glyph, name, and `capital · currency` meta.
   The footer reads `2 results · sorted A→Z` and `↑↓ browse · ↵ select`.
3. **Theming difference:** the focus ring, the highlighted-row accent bar, and the highlight
   background are **teal** (`#0F766E` / `#E9F4F2`) — visibly different from the purple GitHub
   instance, with no other markup difference.
4. Press `↓` then `Enter` (or click a row).
5. **Expected:** below the input a readout appears, e.g. `Selected: 🇵🇱 Poland — Warsaw · PLN`. **No
   new tab opens** — selection stays on the page.

### 4. Below-threshold behavior (contract, both instances)

1. In either instance, type only `po` (2 chars).
2. **Expected:** no request fires; the dropdown shows a countdown hint (`Type 1 more character to
   search`) and a `min 3 characters` footer. The listbox is not expanded.

### 5. Mobile single-column collapse (AC 8)

1. Narrow the window (or use devtools responsive mode) to ≤860px wide.
2. **Expected:** the two panels stack into a single column; the layout stays readable with no
   horizontal page scroll.

## Accessibility checks

- **Keyboard:** both instances are fully operable from the keyboard — Tab into the input, type,
  `↓`/`↑`/`Home`/`End` to move the highlight, `Enter` to select, `Esc` to close. Focus never leaves
  the input (the highlight is tracked via `aria-activedescendant`).
- **Visible focus:** each input shows a 2px accent focus ring (purple for GitHub, teal for
  countries).
- **Combobox semantics:** each input has `role="combobox"` with `aria-expanded` toggling as the
  dropdown opens/closes, and `aria-controls` pointing at its listbox. The two comboboxes have
  distinct accessible names (`Search GitHub`, `Search countries`).
- **Announcements:** typing/settling updates each instance's polite live region (e.g. "3 results",
  "No matches"). Selecting a country updates the readout, which is itself `aria-live="polite"`.
- **Highlight not color-alone:** the highlighted row uses a background **and** a left accent bar.

## Self-verification (executed by the dev agent)

All steps above were run headless (Chromium) against `pnpm dev` before the PR, with screenshots
inspected. Results:

- **Layout** matches the mockup (header, contract strip, two panels, footer). ✅
- **Instance 01 — GitHub live** (`rea`): 50 merged results, repo (`{ }`) vs user (avatar) icons,
  `owner/repo` mono paths, purple `<mark>` query echo. ✅
- **Instance 02 — countries** (`pol`): `French Polynesia` + `Poland`, sorted A→Z, flag + `capital ·
  currency` meta, footer `2 results · sorted A→Z`. ✅
- **Theming difference:** computed `--ac-color-accent` = `#0f766e` (teal) on `.panel--countries` vs
  `#6639ba` (purple) on the GitHub panel; teal focus ring + badge visible. ✅
- **Readout:** keyboard select (↓ then ↵) filled `Selected: 🇵🇫 French Polynesia — Papeete · XPF`;
  `window.open` was not called. ✅
- **Mobile ≤860px** (@800px): `.stage` collapses to a single column (both panels share x, stacked
  vertically); no horizontal page overflow. ✅
- **Footer:** "source on github" links to the repo (same tab); "docs/planning-artifacts" renders as
  plain text (no dead link). ✅

# Manual testing — 3.3 README and GitHub Pages deployment

## Prerequisites

- The release steps have been executed: repository public, GitHub Pages enabled
  (Settings → Pages → Source: **GitHub Actions**), `pages.yml` run green on `master`.
- A browser; no local checkout needed (that is the point).

## Steps

1. Open <https://jundymek.github.io/github-autocomplete/>.
2. Open the browser devtools Network tab and reload — check asset requests.
3. In the **GitHub search** instance, type `react`.
4. Press ArrowDown a few times, then Enter on a highlighted result.
5. Go back to the demo tab. In the **country** instance, type `pol` and select a country.
6. From a clean clone, follow the README quick start verbatim: `pnpm install`, `pnpm dev`,
   `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`.

## Expected

1. The demo loads — both autocomplete instances are visible, no blank page.
2. All JS/CSS assets load from `/github-autocomplete/assets/…` with status 200; no 404s in the
   console or Network tab.
3. After a short debounce, a dropdown lists users and repositories interleaved alphabetically
   (≤ 50 items).
4. The highlighted item's GitHub page opens in a **new tab**; the demo tab keeps its state.
5. The country instance filters and, on selection, fills the selected-country readout (no
   navigation) — and is visibly differently themed (teal accent).
6. Every README command runs verbatim and finishes green on Node 22 + pnpm.

## Accessibility checks

- On the live URL, tab into the search input: a visible 2px accent focus ring appears.
- Arrow keys move the highlight without moving DOM focus off the input; Escape closes the
  dropdown, keeping the query and focus.
- Optional: run a browser axe scan (e.g. axe DevTools) on the live page — no violations expected,
  matching the automated e2e axe scan.

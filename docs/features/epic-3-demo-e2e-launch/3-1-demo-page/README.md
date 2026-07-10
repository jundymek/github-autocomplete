# 3.1 — Demo page with the GitHub instance and a second, differently-themed data source

## What was built

The demo page (`src/App.tsx` + `src/demo/`) — the app entry rendered by `src/main.tsx` and served by
`pnpm dev`. It reproduces `docs/design/demo-page.html` in React and proves reusability + theming by
running code:

- **Header (the thesis):** eyebrow, two-line headline with the accent `github/*` path, a lede
  describing the headless `useAutocomplete<T>` hook + generic `<Autocomplete<T>>` view + adapters,
  and a four-fact **contract strip** (`min 3 characters`, `max 50 results, combined`,
  `sorted A→Z by name`, `↑↓ browse · ↵ opens a new tab`).
- **Instance 01 — GitHub:** renders the real, shipped `GithubAutocomplete` (Story 2.3) against the
  live GitHub Search API, unauthenticated. Keeps the default merge-purple accent (`#6639BA`).
- **Instance 02 — Country picker:** renders the **same generic `Autocomplete<Country>`** (Story 1.3,
  zero lib changes) wired to a static country adapter. It is re-themed teal purely via `--ac-*`
  overrides, and its `onSelect` fills a visible readout instead of opening a tab.
- **Footer:** a real "source on github" link (to this repo, same tab), a plain-text
  `docs/planning-artifacts` label (rendered as text, not a dead link), and the
  `react 19 · typescript strict · zero runtime deps` tagline.

The two instances side by side are the reuse proof (FR-14, SM-3): one core, two data sources, two
themes, no special-casing in the component.

## Files touched

- `src/App.tsx` — UPDATE — replaced the Story 2.3 sandbox with the composed demo page (header +
  two-panel stage + footer).
- `src/App.test.tsx` — UPDATE — smoke test for the demo (headline, contract strip, both panels, both
  comboboxes) replacing the old placeholder-heading assertion.
- `index.html` — UPDATE — demo-only `<link>`s for Space Grotesk + JetBrains Mono; title `— demo`.
- `e2e/smoke.spec.ts` — UPDATE — retargeted the existing Playwright smoke to the new headline + both
  comboboxes (full feature e2e stays Story 3.2).
- `src/demo/countries.ts` — NEW — `Country` type + static `countries` list (in-repo, no dependency).
- `src/demo/countryAdapter.ts` — NEW — `fetchSuggestions(query, signal)`: case-insensitive substring
  filter over the static list, sorted A→Z, resolved; honors `signal` as a no-op guard. ~20 lines.
- `src/demo/countryAdapter.test.ts` — NEW — unit tests: case-insensitive filtering, substring (not
  just prefix), A→Z ordering, empty result, no-mutation, abort no-op, and that the adapter does NOT
  enforce the 3-char threshold (the hook does).
- `src/demo/countryRenderItem.tsx` — NEW — the country `renderItem` (flag + name + `capital · currency`
  meta) using demo global classes.
- `src/demo/constants.ts` — NEW — page copy (eyebrow, contract facts, footer links/tagline).
- `src/demo/demo.css` — NEW — plain, demo-only CSS: page chrome, `.stage` grid (7fr/5fr, single-column
  at ≤860px), panels, badges, the `.panel--countries` teal override, country row content classes, the
  readout, footer.
- `src/demo/components/Panel.tsx` — NEW — shared `<section class="panel">` shell (badge + heading +
  sub + body slot), `aria-labelledby`-wired.
- `src/demo/components/DemoHeader.tsx` — NEW — header/thesis + contract strip.
- `src/demo/components/GithubPanel.tsx` — NEW — instance 01 wrapper around `GithubAutocomplete`.
- `src/demo/components/CountryPanel.tsx` — NEW — instance 02: wires the generic `Autocomplete<Country>`
  + adapter + readout; owns the country footer and `getItemKey`.
- `src/demo/components/SelectedReadout.tsx` — NEW — the visible "selected" readout (`aria-live`).
- `src/demo/components/DemoFooter.tsx` — NEW — footer.
- `src/demo/hooks/useSelectedCountry.ts` — NEW — tiny custom hook owning the readout selection state.
- `src/demo/countryInstance.test.tsx` — NEW — RTL integration test: renders `CountryPanel` (shipped
  generic component + adapter), types ≥3 chars, asserts filtered countries render, that a <3-char
  query fetches nothing (hook-enforced threshold), and that Enter/click select updates the readout
  and never opens a tab.

## Key decisions

- **Senior structure, not a monolith.** The page is decomposed: presentational components
  (`DemoHeader`, `Panel`, `GithubPanel`, `CountryPanel`, `SelectedReadout`, `DemoFooter`), view logic
  (`countryRenderItem`), data (`countries`), the adapter (`countryAdapter`), a custom hook
  (`useSelectedCountry`), and copy constants (`constants`). `App.tsx` is pure composition.
- **The reuse proof is structural.** The country instance imports the shipped `Autocomplete<Country>`
  directly from `src/lib/**` and supplies only data + rendering + selection. The 3-char threshold and
  300ms debounce come from the hook's defaults exactly like the GitHub instance — the adapter does not
  re-implement them. `src/lib/**` was not modified.
- **Theming is only `--ac-*` overrides.** `.panel--countries { --ac-color-accent: #0F766E;
  --ac-color-highlight: #E9F4F2; }` (exact hexes from `design-tokens.md`). No lib class names are
  targeted from demo CSS. The component's portalled dropdown picks up the ancestor tokens via the
  component's own token-bridging (it reads computed `--ac-*` from its root on open).
- **Fonts are demo-only.** Space Grotesk + JetBrains Mono are loaded by `index.html` and referenced
  only in `demo.css`. The lib keeps its system/`ui-monospace` stacks and imposes no font loading on a
  host. (The lib names `"JetBrains Mono"` inside its `--ac-font-mono` *fallback stack* but never loads
  it — that is by design, AR-5.)
- **Badge never overlaps the title.** The badge is absolutely positioned (top-right, per the
  mockup); the title reserves a right-side inset so a long title can't slide under it, and below
  480px the badge drops into normal flow above the title (which then reclaims full width). This
  fixes an overlap seen on narrow panels.
- **Mockup dropdown is illustration only.** The mockup's inline listbox markup and its 300px panel
  bottom-padding (reserved space for a static dropdown) were not ported — the real dropdown is the
  Story 1.3 portal component, so panels use normal padding.

## Deviations

None of substance. The only intentional departures from the raw mockup HTML: the static listbox
illustration is replaced by the real component, and the reserved dropdown padding is dropped (the
portal floats). Both are required by the architecture, not deviations from requirements.

## How it works

`App` renders `.wrap` (header + `.stage`) and the footer. `.stage` is a 7fr/5fr grid that collapses to
one column at ≤860px. `GithubPanel` renders `GithubAutocomplete`; `CountryPanel` renders
`Autocomplete<Country>` with `fetchSuggestions={countryAdapter.fetchSuggestions}`,
`getItemKey={c => c.code}`, `renderItem={renderCountryItem}`, and `onSelect` from
`useSelectedCountry`, which feeds `SelectedReadout`. The teal look is a two-property `--ac-*` override
on the country `<section>`.

## Tests

- **Unit** (`countryAdapter.test.ts`): case-insensitive substring filtering, substring-not-prefix,
  A→Z ordering, empty result, no mutation of the static list, already-aborted signal no-op, and that
  the 3-char threshold is NOT the adapter's job.
- **Integration** (`countryInstance.test.tsx`): the shipped generic component + adapter end-to-end —
  filtered countries render for ≥3 chars; a <3-char query fetches nothing (hook-enforced); Enter and
  click both update the readout and never open a tab.
- **Smoke** (`App.test.tsx`): the demo mounts the headline, contract strip, both section headings, and
  both distinctly-named comboboxes.
- **E2e** (`e2e/smoke.spec.ts`): the built+previewed page loads with both comboboxes visible.
- **Manual:** see `MANUAL_TESTING.md`. Verified in a headless Chromium against `pnpm dev`: teal
  (`#0f766e`) vs purple (`#6639ba`) accents resolved per panel, `pol` → French Polynesia + Poland
  sorted A→Z with flag + `capital · currency`, keyboard-select fills the readout.

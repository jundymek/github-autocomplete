# docs/design — visual ground truth

Dev agents reproduce these mockups in React + CSS Modules; do not improvise visuals.

| File | What it is |
|---|---|
| `design-tokens.md` | Token source of truth: colors (with WCAG AA contrast rationale), type, spacing, motion, the `--ac-*` API contract. Read this first. |
| `component-states.html` | All 9 component states (idle, below-threshold, loading, results, keyboard highlight, empty, error, rate-limit, focus ring) with implementation notes under each. The primary reference for stories 1.3 and 2.3. |
| `demo-page.html` | Demo/sandbox page layout: header with contract strip, GitHub instance + re-themed country instance (reuse proof). Reference for story 3.1. |
| `styleguide.html` | Palette + type specimens and the six rules of the system. |

Open the HTML files directly in a browser. They inline the `--ac-*` tokens so the rendered values
are exactly what the component's CSS Modules should bake in as fallbacks. The dropdown is inline
in mockups; the real implementation renders it through a portal (architecture AR-7).

Webfonts (Space Grotesk, JetBrains Mono) are loaded from Google Fonts **in mockups and the demo
page only** — the component itself uses system stacks (`--ac-font-ui`, `--ac-font-mono`) and must
not load fonts.

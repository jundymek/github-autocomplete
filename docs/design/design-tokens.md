# Design tokens — github-autocomplete

Visual direction: **"command palette, daylight edition"** — the autocomplete reads like the
cmd+K palette of a code editor, in a light, cool-toned interface instead of the dark-terminal
cliché. Identity comes from GitHub's own vernacular (logins, `owner/repo` paths, language dots),
not decoration. The accent is **merge purple** — the color of a merged PR, native to GitHub's
world and distinctive on a light canvas.

These tokens are the source of truth for the component's `--ac-*` CSS custom properties
(`src/lib/autocomplete/*.module.css` bakes them in as `var(--ac-*, <fallback>)`). Demo-page-only
values (canvas, display face) are NOT part of the component's API.

## Color

| Token | Value | Role | Contrast (WCAG AA rationale) |
|---|---|---|---|
| `--ac-color-surface` | `#FFFFFF` | Input + dropdown background | — |
| `--ac-color-text` | `#1F2328` | Primary text | 16.1:1 on surface — AAA |
| `--ac-color-text-muted` | `#59636E` | Meta text (bio, description, counts) | 4.9:1 on surface — AA normal text |
| `--ac-color-accent` | `#6639BA` | Focus ring, active accents, links | 7.1:1 on surface — AA(A); ≥3:1 as non-text focus indicator |
| `--ac-color-highlight` | `#F5F1FB` | Keyboard-highlighted row background | text 15:1, muted 4.6:1, accent 6.5:1 on it — all AA |
| `--ac-color-border` | `#D1D9E0` | Input/dropdown borders, dividers | decorative; focus state relies on accent ring (3:1+) not border |
| `--ac-color-danger` | `#CF222E` | Error state text/icon | 4.7:1 on surface — AA |
| `--ac-color-warning` | `#9A6700` | Rate-limit state text/icon | 4.6:1 on surface — AA |
| `--ac-color-warning-bg` | `#FFF8C5` | Rate-limit callout background | with `#1F2328` text 13.9:1 — AAA |
| `--ac-color-success` | `#1A7F37` | Live-region OK / demo checkmarks | 5.0:1 on surface — AA |

Demo page only (not component API): canvas `#F2F4F8`, ink `#1F2328`, eyebrow/labels use accent.

Theming proof (country-list instance overrides): `--ac-color-accent: #0F766E` (5.4:1 — AA),
`--ac-color-highlight: #E9F4F2`.

## Typography

| Token | Value | Role |
|---|---|---|
| `--ac-font-ui` | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | Component UI text — system stack so the component is self-contained (no font loading imposed on the host) |
| `--ac-font-mono` | `ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace` | Logins and `owner/repo` paths — identifiers are code, monospace encodes that |
| (demo only) display | `"Space Grotesk", var(--ac-font-ui)` | Demo headline + section labels; never used inside the component |

Scale (component): input 15px/1.4; item primary 14px/500; item meta 12.5px; dropdown footer 11.5px
uppercase +0.04em tracking. Demo: display 40/44 (clamp to 30 on mobile), body 15/24.

## Spacing & shape

| Token | Value | Role |
|---|---|---|
| `--ac-radius` | `10px` | Input + dropdown corner radius |
| `--ac-radius-item` | `6px` | Row highlight radius (inset within dropdown padding) |
| `--ac-space` | `8px` | Base unit; row padding 8×12, dropdown inset 6, input padding 10×12 |
| `--ac-shadow` | `0 8px 24px rgba(31,35,40,.12), 0 1px 3px rgba(31,35,40,.08)` | Dropdown elevation (portal floats over any host bg) |
| `--ac-dropdown-max-height` | `368px` | ~8 rows then native scroll (50-item cap, no pagination) |
| `--ac-z-index` | `1000` | Portal layer |

## Motion

Single orchestrated moment: dropdown enters with 120ms ease-out fade + 4px translate-up; loading
indicator is a 3-dot pulse in the input's trailing slot. Everything else is instant. All motion
gated behind `@media (prefers-reduced-motion: reduce)`.

## Signature element

The **dropdown footer narrates the component's contract**: idle hint "Type 3+ characters to
search", results footer "50 of 1,204 · sorted A→Z". The task's requirements (min chars, cap,
alphabetical order) are encoded in the UI itself — structure as information, and an honest answer
to "why do I only see 50?".

## A11y baseline (baked into mockups)

WAI-ARIA combobox: `role="combobox"` + `aria-expanded` + `aria-controls` on input,
`role="listbox"` + `role="option"` + `aria-activedescendant` for the popup; `aria-live="polite"`
status region announcing result counts and states; 2px accent focus ring with 2px offset;
highlighted row uses background + left accent bar (not color alone).

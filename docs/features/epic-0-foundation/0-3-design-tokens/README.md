# 0.3 — Design tokens as `--ac-*` custom properties

## What was built

The component's themeable surface: every `--ac-<area>-<property>` custom property, with values
taken 1:1 from `docs/design/design-tokens.md`, declared in `src/lib/autocomplete/tokens.css` and
pinned by a co-located test suite. This is the token contract Epic 1 styles against
(`var(--ac-x, <fallback>)` in `Autocomplete.module.css`) and the table Story 3.3's lib README
reuses.

## Files touched

- `src/lib/autocomplete/tokens.css` — NEW — the documented `--ac-*` token contract; declarations
  scoped to the `.acRoot` wrapper class (no global styles), one comment per token.
- `src/lib/autocomplete/tokens.test.ts` — NEW — pins every token name/value verbatim, computes
  WCAG contrast ratios for the AA guarantees, and asserts no `:root`/`html`/`body`/`*` selectors
  and no non-custom-property declarations.
- `docs/implementation-artifacts/0-3-design-tokens.md` — UPDATE — Dev Agent Record, status.

## Token table

### Color

| Token | Purpose | Fallback | Contrast (WCAG AA rationale) |
|---|---|---|---|
| `--ac-color-surface` | Input + dropdown background | `#FFFFFF` | — |
| `--ac-color-text` | Primary text | `#1F2328` | 16.1:1 on surface — AAA |
| `--ac-color-text-muted` | Meta text (bio, description, counts) | `#59636E` | 4.9:1 on surface — AA normal text |
| `--ac-color-accent` | Focus ring, active accents, links | `#6639BA` | 7.1:1 on surface — AA(A); ≥3:1 as non-text focus indicator |
| `--ac-color-highlight` | Keyboard-highlighted row background | `#F5F1FB` | text 15:1, muted 4.6:1, accent 6.5:1 on it — all AA |
| `--ac-color-border` | Input/dropdown borders, dividers | `#D1D9E0` | decorative; focus state relies on accent ring (3:1+) not border |
| `--ac-color-danger` | Error state text/icon | `#CF222E` | 4.7:1 on surface — AA |
| `--ac-color-warning` | Rate-limit state text/icon | `#9A6700` | 4.6:1 on surface — AA |
| `--ac-color-warning-bg` | Rate-limit callout background | `#FFF8C5` | with `#1F2328` text 13.9:1 — AAA |
| `--ac-color-success` | Live-region OK / demo checkmarks | `#1A7F37` | 5.0:1 on surface — AA |

### Typography

| Token | Purpose | Fallback |
|---|---|---|
| `--ac-font-ui` | Component UI text — system stack, no font loading imposed on the host | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| `--ac-font-mono` | Logins and `owner/repo` paths — identifiers are code | `ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace` |

The component never loads webfonts. The type scale (input 15px/1.4; item primary 14px/500; item
meta 12.5px; footer 11.5px uppercase +0.04em tracking) is applied by Epic 1's module CSS, not
tokenized.

### Spacing & shape

| Token | Purpose | Fallback |
|---|---|---|
| `--ac-radius` | Input + dropdown corner radius | `10px` |
| `--ac-radius-item` | Row highlight radius (inset within dropdown padding) | `6px` |
| `--ac-space` | Base unit; row padding 8×12, dropdown inset 6, input padding 10×12 | `8px` |
| `--ac-shadow` | Dropdown elevation (portal floats over any host bg) | `0 8px 24px rgba(31,35,40,.12), 0 1px 3px rgba(31,35,40,.08)` |
| `--ac-dropdown-max-height` | ~8 rows then native scroll (50-item cap, no pagination) | `368px` |
| `--ac-z-index` | Portal layer | `1000` |

## Key decisions

- **Scope: `.acRoot`, not `:root`.** The spec (Task 1) explicitly authorizes scoping to a
  documented wrapper class instead of `:root` — a deliberate, recorded deviation from the
  strictest "CSS Modules only" reading of AR-5, chosen so the token contract exists as a real,
  lintable, test-pinnable stylesheet. Two safeguards bound the blast radius: (1) no module
  imports `tokens.css` at this stage — it is purely the documented reference; (2) even when
  imported, it contains only custom-property declarations under `.acRoot`, a class the host does
  not use (test-enforced). Per AR-5, the canonical mechanism remains the fallbacks Epic 1 bakes
  into `Autocomplete.module.css` as `var(--ac-x, <fallback>)` — this file is the documented
  source of those fallback values.
- **Contrast is asserted by WCAG class, not by the design doc's decimal figures.** Computing the
  WCAG 2.x ratios for the baked values shows the design doc's figures are approximations (e.g.
  muted on surface computes to 6.1:1, not the documented 4.9:1; text computes to 15.8:1, not
  16.1:1). Every pair meets or exceeds its documented AA/AAA class, so the tests pin the classes
  (≥4.5, ≥7, ≥3 non-text) — the actual guarantee — rather than figures that don't hold exactly.
- **The contract is test-pinned.** `tokens.test.ts` fails if any token is renamed, its value
  drifts from the design doc, an undocumented token is added, a global selector appears, or a
  baked color stops meeting its AA contrast guarantee (ratios are computed, not assumed).
- **No motion tokens.** Per the story spec, motion (120ms dropdown fade, reduced-motion gating) is
  Epic 1 implementation detail, not part of the token contract.

## How it works

Hosts theme the component by setting any `--ac-*` property on any ancestor element — never by
piercing selectors:

```css
.my-theme {
  --ac-color-accent: #0f766e;
  --ac-color-highlight: #e9f4f2;
}
```

Unset tokens fall back to the design values above, so the component is fully styled in an
unstyled host.

## Tests

- Unit (`src/lib/autocomplete/tokens.test.ts`, 33 tests): exact name/value match for all 18
  tokens; no extra tokens; naming convention; focus-ring token + documented 2px/2px recipe;
  computed WCAG contrast ratios (text AAA, muted/accent/danger/warning/success AA on surface,
  accent ≥3:1 non-text, text on warning-bg AAA, text/muted/accent AA on highlight); no global
  selectors; custom-property-only declarations.
- Manual: not applicable — no rendered UI yet (consumed by Epic 1).

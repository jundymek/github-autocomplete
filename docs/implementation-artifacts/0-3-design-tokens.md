# Story 0.3: Design tokens as `--ac-*` custom properties

Status: Approved

## Story

As an integrating developer,
I want the component's themeable surface defined as documented `--ac-*` custom properties with
baked-in fallback values from the design phase,
so that Epic 1 styles against a stable, documented token contract and hosts can theme without
piercing selectors.

[Source: epics.md#Story 0.3: Design tokens as `--ac-*` custom properties]

## Acceptance Criteria

1. The token map is created in `src/lib/autocomplete/` — a tokens reference (`tokens.css`) intended
   to be consumed by `Autocomplete.module.css` in Epic 1 via `var(--ac-x, <fallback>)`.
   [AR-5, FR-15] [Source: architecture.md#AR-5, #3.1, prd.md#FR-15]
2. Every themeable property has a documented `--ac-<area>-<property>` name and a fallback value taken
   **1:1 from `docs/design/design-tokens.md`** — covering colors, spacing, radius, typography, and
   the focus ring. [AR-5, FR-15] [Source: architecture.md#AR-5, #3.1, design-tokens.md]
3. The default values meet **WCAG AA contrast** and include a **visible focus-ring token**
   (`--ac-color-accent` used as the focus indicator). [NFR-1] [Source: prd.md#NFR-1, design-tokens.md#Color, #A11y baseline]
4. The token list — names, purposes, and fallbacks — is documented in the story docs (a table),
   feeding the lib README token section referenced by Story 3.3. [FR-15, FR-19]
   [Source: epics.md#Story 0.3, #Story 3.3, architecture.md#3.1]
5. **No global styles** are introduced. Tokens are consumed via `var(--ac-x, <fallback>)` inside CSS
   Modules only; the tokens reference does not leak styles into the host. [NFR-5, AR-5]
   [Source: architecture.md#AR-5, prd.md#NFR-5]

## Tasks / Subtasks

- [ ] Task 1 — Create the token reference (AC: 1, 2, 3, 5)
  - [ ] Create `src/lib/autocomplete/tokens.css` declaring every `--ac-*` custom property with its
        design value as the value, under a **`@layer`-neutral, non-global scope**. Per AR-5, the
        canonical consumption is `var(--ac-*, <fallback>)` inside `Autocomplete.module.css` (Epic 1),
        so `tokens.css` is the **documented source of the fallbacks**, not a global reset. If declaring
        the properties on `:root` would risk leaking into the host, scope them to a documented wrapper
        class (e.g. `.acRoot`) or keep `tokens.css` purely as the reference and bake the fallbacks
        directly into the module CSS in Epic 1 — **follow AR-5's exact guidance: the fallbacks baked
        into the component CSS are the design values, so the component is fully styled in an unstyled
        host.** Record the chosen approach in the README. [Source: architecture.md#AR-5, epics.md#Story 0.3]
  - [ ] Add TSDoc/CSS comments next to each token: name, purpose, fallback (per epics §Technical
        notes — documentation is a table in story docs + comments next to the CSS).
        [Source: epics.md#Story 0.3 Technical notes]
- [ ] Task 2 — Bake the exact values from `docs/design/design-tokens.md` (AC: 2, 3)
  - [ ] Copy the **Color**, **Typography**, and **Spacing & shape** token values **verbatim** (see the
        table in Dev Notes below — do **not** invent or round values). [Source: design-tokens.md]
  - [ ] Confirm the focus-ring token exists and is the accent color used as a **2px accent focus ring
        with 2px offset** (per design-tokens.md A11y baseline). [Source: design-tokens.md#A11y baseline]
- [ ] Task 3 — Verify contrast + no leakage (AC: 3, 5)
  - [ ] Confirm the documented AA contrast rationale from `design-tokens.md` holds for the baked
        values (text 16.1:1, muted 4.9:1, accent 7.1:1, danger 4.7:1, warning 4.6:1 on surface — all
        AA/AAA as noted). No new global styles; nothing applied to `body`/`html`.
        [Source: design-tokens.md#Color, prd.md#NFR-1, #NFR-5]
- [ ] Task 4 — Documentation deliverable (Definition of Done) (AC: 4)
  - [ ] Create `docs/features/epic-0-foundation/0-3-design-tokens/README.md` with the full token table
        (name / purpose / fallback) — this is the section Story 3.3's README/lib README reuses. **No
        MANUAL_TESTING.md** (no rendered UI yet). PERFORMANCE.md is **not applicable**.
        [Source: CLAUDE.md, epics.md#Story 0.3]

## Documentation deliverables

Part of Definition of Done (see CLAUDE.md). Create the task documentation folder:
`docs/features/epic-0-foundation/0-3-design-tokens/`

- **README.md** — required. The full `--ac-*` token table (name, purpose, fallback value), where the
  tokens live (`src/lib/autocomplete/tokens.css`), how Epic 1 consumes them (`var(--ac-x, fallback)`
  in CSS Modules), and the AA-contrast + visible-focus-ring guarantees. This feeds the lib README
  token section (Story 1.3 / 3.3).
- **MANUAL_TESTING.md** — **not required** (no rendered UI yet; consumed by Epic 1).
- **PERFORMANCE.md** — **not applicable** for 0.x. [Source: CLAUDE.md]

## Dev Notes

**Prerequisite:** Story 0.1 merged (skeleton `src/lib/autocomplete/` exists). **The design
deliverables in `docs/design/` are a hard prerequisite** — they already exist
(`design-tokens.md`, `component-states.html`, `demo-page.html`, `styleguide.html`).
`[ASSUMPTION (headless): docs/design/ exists at implementation time — verified present now; if any
value were missing this story would block rather than invent tokens.]`
[Source: epics.md#Story 0.3 Dependencies + Technical notes, design/README.md]

**Branch & PR:** `story/0-3-design-tokens` → `master`, squash. Commit e.g.
`feat(0.3): add --ac-* design token map`. No AI attribution. English only.
[Source: CLAUDE.md#Working rules, architecture.md#3.7]

**Where tokens live (AR-5):** CSS Modules only in `lib/`; every themeable property reads a documented
`--ac-*` custom property **with a baked-in fallback from `docs/design/`**. No Tailwind, no CSS
framework, no global styles in the lib layer. Hosts theme by setting `--ac-*` on any ancestor — never
by piercing selectors. Naming convention: `--ac-<area>-<property>` (§3.1). Tokens file:
`src/lib/autocomplete/tokens.css`. [Source: architecture.md#AR-5, #3.1, prd.md#FR-15, #NFR-5]

**Token values — copied 1:1 from `docs/design/design-tokens.md` (do not alter):**

Color [Source: design-tokens.md#Color]

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

- Demo page only (**not** component API): canvas `#F2F4F8`, ink `#1F2328`, eyebrow/labels use accent.
- Theming proof (country-list instance overrides, used by Story 3.1): `--ac-color-accent: #0F766E`
  (5.4:1 — AA), `--ac-color-highlight: #E9F4F2`. [Source: design-tokens.md#Color]

Typography [Source: design-tokens.md#Typography]

| Token | Value | Role |
|---|---|---|
| `--ac-font-ui` | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | Component UI text — system stack so the component is self-contained (no font loading imposed on the host) |
| `--ac-font-mono` | `ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace` | Logins and `owner/repo` paths — identifiers are code, monospace encodes that |

- (demo only) display face `"Space Grotesk", var(--ac-font-ui)` — never used inside the component.
- Scale (component): input 15px/1.4; item primary 14px/500; item meta 12.5px; dropdown footer 11.5px
  uppercase +0.04em tracking. **The component must NOT load webfonts** (system stacks only).
  [Source: design-tokens.md#Typography, design/README.md]

Spacing & shape [Source: design-tokens.md#Spacing & shape]

| Token | Value | Role |
|---|---|---|
| `--ac-radius` | `10px` | Input + dropdown corner radius |
| `--ac-radius-item` | `6px` | Row highlight radius (inset within dropdown padding) |
| `--ac-space` | `8px` | Base unit; row padding 8×12, dropdown inset 6, input padding 10×12 |
| `--ac-shadow` | `0 8px 24px rgba(31,35,40,.12), 0 1px 3px rgba(31,35,40,.08)` | Dropdown elevation (portal floats over any host bg) |
| `--ac-dropdown-max-height` | `368px` | ~8 rows then native scroll (50-item cap, no pagination) |
| `--ac-z-index` | `1000` | Portal layer |

Focus ring & motion [Source: design-tokens.md#Motion, #A11y baseline]

- Focus ring: **2px `--ac-color-accent` ring with 2px offset**; highlighted row uses background +
  left accent bar (not color alone) — this is the visible-focus-ring guarantee for NFR-1.
- Motion (informational for Epic 1): dropdown enters 120ms ease-out fade + 4px translate-up; loading
  is a 3-dot pulse; all motion gated behind `@media (prefers-reduced-motion: reduce)`. No new motion
  tokens are required by this story.

**Consumption pattern (for Epic 1, documented here):** in `Autocomplete.module.css`, e.g.
`background: var(--ac-color-surface, #FFFFFF);` `color: var(--ac-color-text, #1F2328);`
`border-radius: var(--ac-radius, 10px);`. The fallback in each `var()` equals the design value above,
so the component is fully styled even if the host sets no tokens. [Source: architecture.md#AR-5]

**Out of scope:** no `Autocomplete.module.css` / component styling yet (Epic 1, Story 1.3); no demo
theming instance (Epic 3, Story 3.1). This story only establishes the token contract + fallbacks.
[Source: epics.md#Story 1.3, #Story 3.1]

### Project Structure Notes

- Single new file `src/lib/autocomplete/tokens.css` in the reusable layer; zero global styles; no
  imports from `features/` or app. Consistent with AR-2/AR-5. [Source: architecture.md#AR-2, #AR-5]

### References

- [Source: epics.md#Story 0.3: Design tokens as `--ac-*` custom properties]
- [Source: architecture.md#AR-5: Styling — CSS Modules + `--ac-*` design tokens with baked-in fallbacks]
- [Source: architecture.md#3.1 Naming & file conventions (CSS custom properties)]
- [Source: design-tokens.md#Color, #Typography, #Spacing & shape, #Motion, #A11y baseline]
- [Source: design/README.md]
- [Source: prd.md#FR-15 Self-contained styling with themeable tokens, #NFR-1 Accessibility, #NFR-5 Isolation]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-07-09 | 0.1 | Initial draft — story approved, ready for dev | Scrum Master (bmad-create-story) |

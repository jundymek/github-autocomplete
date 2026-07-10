# 1.3 — `Autocomplete<T>` presentational component with CSS Modules and portal dropdown

## What was built

The rendered half of the reusable deliverable: a generic, self-contained `Autocomplete<T>`
component over the `useAutocomplete<T>` hook (1.1/1.2). It renders the combobox input, a
visually-hidden live region, and a dropdown portalled to `document.body`, reproducing all 9 design
states from `docs/design/component-states.html`. It ships zero GitHub knowledge — every text,
row content and footer line is injectable, with generic defaults baked in.

## Files touched

- `src/lib/autocomplete/Autocomplete.tsx` — NEW — the component: hook consumption, portal +
  positioning, token bridging, state rendering, live region, retry wiring.
- `src/lib/autocomplete/Autocomplete.module.css` — NEW — all styling, every themeable property as
  `var(--ac-*, <design fallback>)`; `ac-pulse`/`ac-in` keyframes gated behind
  `prefers-reduced-motion`.
- `src/lib/autocomplete/Autocomplete.test.tsx` — NEW — 43 RTL integration tests (stubbed
  `fetchSuggestions`, no MSW — per the story spec, MSW-over-HTTP is Epic 2).
- `src/lib/autocomplete/types.ts` — UPDATE — added `AutocompleteProps<T>`,
  `AutocompleteMessages`, `AutocompleteErrorContent`, `AutocompleteErrorTone`,
  `AutocompleteFooterContext`.

## Public props (AR-4 surface)

| Prop | Type | Default | Purpose |
|---|---|---|---|
| `fetchSuggestions` | `(query, signal) => Promise<T[]>` | — | Injected data source; the signal aborts stale requests |
| `renderItem` | `(item, { highlighted }) => ReactNode` | — | Row content (the component provides only the row chrome) |
| `getItemKey` | `(item) => string` | — | React keys + stable `aria-activedescendant` option ids |
| `onSelect` | `(item) => void` | — | Selection behavior (Enter and click are identical) |
| `placeholder` | `string` | `'Search…'` | Input placeholder |
| `label` | `string` | `'Search'` | Accessible name (`aria-label`) of the combobox |
| `minChars` | `number` | `3` | Threshold pass-through to the hook |
| `debounceMs` | `number` | `300` | Debounce pass-through to the hook |
| `messages` | `AutocompleteMessages` | generic texts | Display-text overrides (below-threshold, empty, error, retry label) |
| `statusMessages` | hook option | generic texts | Live-region announcement overrides |
| `renderFooter` | `(ctx) => ReactNode` | design texts | Replaces the footer contract line; return `null` to hide |

### Error tone mechanism (design state 08)

The component never learns what a rate limit is. `messages.error(error)` returns
`{ title, description, tone?: 'error' | 'warning', retryable?: boolean }`:

- `tone: 'error'` (default) — centered danger block with a "Try again" retry button.
- `tone: 'warning'` — the amber left-aligned callout. An adapter (2.3) maps its own error cause
  (preserved verbatim in `error.cause`) to this shape; `retryable: false` hides the retry button.

The retry button re-fires the last query through the hook's normal input path (threshold +
debounce + abort semantics apply) and returns focus to the input.

### Footer contract (design "signature element")

`renderFooter` receives `{ status, query, resultCount, minChars, belowThreshold }`. Defaults:
`min N characters / esc to close` (below threshold), `searching…` (loading),
`N result(s) · sorted A→Z / ↑↓ browse · ↵ open` (results), `0 results / esc to close` (empty),
no footer on error. "sorted A→Z" is only a default label — sorting is the data source's job; a
host that knows its total count (e.g. "50 of 1,204") overrides this prop.

## `--ac-*` token table (names / purposes / baked fallbacks)

| Token | Fallback | Purpose |
|---|---|---|
| `--ac-color-surface` | `#ffffff` | Input + dropdown background |
| `--ac-color-text` | `#1f2328` | Primary text |
| `--ac-color-text-muted` | `#59636e` | Meta text, placeholder, footer |
| `--ac-color-accent` | `#6639ba` | Focus ring, highlight bar, pulse dots, retry |
| `--ac-color-highlight` | `#f5f1fb` | Highlighted row background |
| `--ac-color-border` | `#d1d9e0` | Borders and dividers |
| `--ac-color-danger` | `#cf222e` | Error title |
| `--ac-color-warning` | `#9a6700` | Warning-tone title |
| `--ac-color-warning-bg` | `#fff8c5` | Warning-tone callout background |
| `--ac-color-success` | `#1a7f37` | Success accent (documented surface) |
| `--ac-font-ui` | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | UI text |
| `--ac-font-mono` | `ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace` | Identifiers, footer |
| `--ac-radius` | `10px` | Input + dropdown radius |
| `--ac-radius-item` | `6px` | Row/callout/retry radius |
| `--ac-space` | `8px` | Base spacing unit |
| `--ac-shadow` | `0 8px 24px rgba(31,35,40,.12), 0 1px 3px rgba(31,35,40,.08)` | Dropdown elevation |
| `--ac-dropdown-max-height` | `368px` | List max height before internal scroll |
| `--ac-z-index` | `1000` | Popup layer |

Hosts theme by setting any token on any ancestor — never by piercing selectors. In a completely
unstyled host the fallbacks alone reproduce the design.

## Portal + positioning strategy (AR-7)

The popup renders via `createPortal(..., document.body)` with `position: fixed` at the input's
`getBoundingClientRect()` (viewport coordinates — no scroll-offset math), width-matched to the
input, re-measured on open, on `scroll` with `{ capture: true }` (catches scrolling ancestors) and
on `resize`. The list is bounded by `--ac-dropdown-max-height` with internal `overflow-y: auto`;
the highlighted option is kept in view with `scrollIntoView({ block: 'nearest' })`. ARIA
relationships are id-based, so the portal does not break them.

**Token bridging:** because the popup lives under `document.body`, tokens set on a host ancestor
would never cascade to it. On each measurement pass the component reads the computed value of every
documented `--ac-*` token from its root element and sets the non-empty ones inline on the popup.
Unset tokens stay unset, so the CSS fallbacks still apply. Known limitation: the bridge refreshes
on open/scroll/resize (the measurement passes AR-7 mandates), so changing an ancestor token while
the dropdown is already open applies on the next measurement, not synchronously.

**ARIA integrity:** the `role="listbox"` element renders whenever the popup is open — empty in the
loading/empty/error states — so the input's `aria-controls` reference always resolves while
`aria-expanded="true"`; options populate it only in the results state.

## State rendering (all 9 design states)

| # | State | Rendered from |
|---|---|---|
| 01 | idle | closed; `aria-expanded="false"` |
| 02 | below threshold | component-local (focus + `0 < query.length < minChars`); countdown hint + contract footer; no request |
| 03 | loading | `status: 'loading'` → 3 pulse dots in the trailing slot + 3 skeleton rows + `searching…` |
| 04 | results | `status: 'success'` → listbox of `renderItem` rows + count footer |
| 05 | keyboard highlight | `highlightedIndex` → highlight bg + 2px accent left bar + `aria-selected` + kept in view |
| 06 | empty | `status: 'empty'` → query echo + hint + `0 results` |
| 07 | error | `status: 'error'` → danger title + description + retry |
| 08 | warning tone | `status: 'error'` + adapter-supplied `tone: 'warning'` override (the lib knows no causes) |
| 09 | focus ring | `:focus` double box-shadow ring (2px surface offset + 2px accent) |

The below-threshold popup is the one state the hook cannot own (its `isOpen` stays `false` under
the threshold), so the component drives it from input focus, and Escape dismisses it via a
component-level guard that runs only after the hook's `onKeyDown` declined the event — all
navigation/selection keys still route exclusively through the hook (§3.4).

**Dismissal paths.** The dropdown closes on Escape, on selection, and — added in
[Story 1.4](../1-4-outside-click-dismiss/) — on an outside pointer press (a `pointerdown` outside
both the component root and the portalled popup). All three keep the typed query in the input.

## Live region

A visually-hidden `role="status"` / `aria-live="polite"` element rendered in the input's normal
DOM position (not the portal) announces the hook-derived `statusMessage`: "Searching…", "N
results", "No matches", or the error message. Texts are overridable via `statusMessages`.

## Data-source-agnostic guarantee

`T` is unconstrained beyond `getItemKey`; no GitHub types or strings exist in
`src/lib/autocomplete/`. The test suite proves reuse by driving the identical component with a
static in-memory country list and custom `renderItem`/`getItemKey` — zero component changes.

## Tests

- **Unit/integration (43 tests, `Autocomplete.test.tsx`):** every popup state from stubbed
  async outcomes (resolve / reject / empty / never-resolve, fake timers for debounce); message and
  footer overrides incl. the warning-tone proof; portal target = `document.body` with ARIA ids
  resolving across it; keyboard end-to-end (ArrowDown → Enter → `onSelect`, Escape closes keeping
  query + focus); live-region placement and texts; exact `var(--ac-*, fallback)` values pinned
  against the raw CSS; ancestor-override token bridging; reduced-motion gating; the static
  country-source agnosticism proof.
- **Manual:** see MANUAL_TESTING.md. A scripted real-browser pass (Chromium) verified portal
  positioning/width-matching inside an `overflow: hidden` host, Escape focus retention, and token
  bridging — it caught and fixed a missing self-contained `box-sizing` reset.
- **Performance:** no new performance dimension in this story — debounce/abort behavior is
  documented in [1.1's PERFORMANCE.md](../1-1-useautocomplete-hook/PERFORMANCE.md).

# github-autocomplete

A **reusable, self-contained autocomplete component** in React + TypeScript that searches GitHub
users and repositories — built as a recruitment code challenge. The widget is deliberately small;
the deliverable is the engineering around it: a headless-hook architecture with a mechanically
enforced reuse boundary, WAI-ARIA combobox accessibility, exhaustive state handling (including a
dedicated rate-limit state), and a three-layer test pyramid.

**Live demo:** <https://jundymek.github.io/github-autocomplete/>

The demo hosts two instances of the same component: the GitHub search (users + repositories,
merged alphabetically, capped at 50) and a static country list with different rendering, selection
behavior, and theming — the executable proof that the component is genuinely data-source-agnostic.

## Quick start

Prerequisites: **Node 22** and **pnpm** (`corepack enable` is enough to get pnpm).

```bash
pnpm install        # install dependencies
pnpm dev            # start the demo at http://localhost:5173
```

Verification suite — all green on a clean clone, no configuration or token needed:

```bash
pnpm lint           # ESLint (flat config, incl. the architecture boundary rule)
pnpm typecheck      # TypeScript strict, tsc -b --noEmit
pnpm test           # unit + integration (Vitest + RTL + MSW)

pnpm exec playwright install chromium   # one-time: download the e2e browser
pnpm test:e2e       # thin e2e (Playwright + axe)
```

No GitHub token is required — the demo works unauthenticated out of the box (see
[Rate limits](#rate-limits-and-the-optional-token)).

## Architecture

Three layers, one-way imports, physically visible in the tree:

```
src/lib/autocomplete/        ← the reusable deliverable (generic, zero GitHub knowledge)
        ▲
src/features/github-search/  ← GitHub adapter: API client, error mapping, merge/sort/cap, rendering
        ▲
src/App.tsx + src/demo/      ← demo sandbox: wires both instances, free styling
```

- `src/lib/autocomplete/` exports a **headless hook** (`useAutocomplete<T>` — debounce, threshold,
  state machine, stale-request cancellation, keyboard navigation, ARIA prop getters) and a thin
  **presentational component** (`Autocomplete<T>`) over it. It imports nothing from the layers
  above and knows nothing about GitHub. Its only styling is its own CSS Modules reading `--ac-*`
  custom properties with baked-in fallbacks.
- `src/features/github-search/` implements the injected contract for GitHub: two parallel Search
  API calls, merge + locale-aware sort + 50-item cap, a typed error union with a dedicated
  rate-limit variant, and open-in-new-tab selection.
- The demo is a consumer, not part of the deliverable.

**The import rule — `lib/` never imports from `features/` or app code — is ESLint-enforced**
(`no-restricted-imports` scoped to `src/lib/**`), so the reuse boundary cannot erode silently.

## Component API

The public surface is the barrel at [`src/lib/autocomplete/index.ts`](src/lib/autocomplete/index.ts) —
the only supported import path (as the adapter and demo do):

```tsx
import { Autocomplete } from '../lib/autocomplete'
```

### `Autocomplete<T>` props

| Prop | Type | Required | Description |
|---|---|---|---|
| `fetchSuggestions` | `(query: string, signal: AbortSignal) => Promise<T[]>` | yes | The injected data source. `signal` aborts when the request goes stale (new query, threshold drop, unmount). |
| `renderItem` | `(item: T, state: { highlighted: boolean }) => ReactNode` | yes | Renders one suggestion row's content; the component provides the row chrome. |
| `getItemKey` | `(item: T) => string` | yes | Stable item identity — React keys and `aria-activedescendant` option ids derive from it. |
| `onSelect` | `(item: T) => void` | yes | Called on Enter or click (identical behavior). What selection *does* is the host's concern. |
| `placeholder` | `string` | no | Input placeholder. Default `'Search…'`. |
| `label` | `string` | no | Accessible name (`aria-label`) of the combobox input. Default `'Search'`. |
| `clearLabel` | `string` | no | Accessible name (`aria-label`) of the trailing "×" clear button (shown when the input has a query and is not loading). Default `'Clear'`. |
| `minChars` | `number` | no | Minimum query length before any request. Default `3`. |
| `debounceMs` | `number` | no | Debounce window after the last keystroke. Default `300`. |
| `messages` | `AutocompleteMessages` | no | Display-text overrides for the popup states (below-threshold hint, empty, error content incl. tone and retryability). |
| `statusMessages` | see hook options | no | Overrides for the visually-hidden `aria-live` announcements. |
| `renderFooter` | `(ctx: AutocompleteFooterContext) => ReactNode` | no | Replaces the default dropdown footer (which narrates the contract: "min 3 characters", "N results · sorted A→Z"). Return `null` for no footer. |

### `useAutocomplete<T>` (headless)

All behavior with none of the markup — usable directly if a host wants its own UI:

```tsx
const { state, handlers } = useAutocomplete<T>({
  fetchSuggestions, // (query, signal) => Promise<T[]>   — required
  getItemKey,       // (item) => string                  — required
  onSelect,         // (item) => void                    — required
  minChars: 3,      // optional, default 3
  debounceMs: 300,  // optional, default 300
  statusMessages,   // optional live-region text overrides
})
```

- **`state`** — one object, the single source of truth: `query`,
  `status: 'idle' | 'loading' | 'success' | 'empty' | 'error'`, `items: T[]`,
  `highlightedIndex: number | null`, `isOpen`, `error?`, `statusMessage` (the `aria-live` text).
- **`handlers`** — one object: `onInputChange`, `clear` (one-action reset to the initial
  state — empties the query, cancels the debounce, aborts any in-flight fetch, closes the popup),
  `onKeyDown` (ArrowDown/ArrowUp clamped, Home/End, Enter selects, Escape closes keeping query and
  focus), `onItemClick`, `onItemHover`, `close`, plus ARIA prop getters (`getInputProps`,
  `getListboxProps`, `getItemProps`) that are spread verbatim so the combobox wiring cannot be
  mis-assembled.

### Theming — `--ac-*` design tokens

The component ships fully styled (every token has its fallback baked into the CSS Modules) and is
themed exclusively by setting `--ac-*` custom properties on any ancestor — never by piercing
selectors. The demo's country instance proves it with `--ac-color-accent: #0F766E` and
`--ac-color-highlight: #E9F4F2`.

| Token | Purpose | Fallback |
|---|---|---|
| `--ac-color-surface` | Input + dropdown background | `#FFFFFF` |
| `--ac-color-text` | Primary text | `#1F2328` |
| `--ac-color-text-muted` | Meta text (bio, description, counts) | `#59636E` |
| `--ac-color-accent` | Focus ring, active accents, links | `#6639BA` |
| `--ac-color-highlight` | Keyboard-highlighted row background | `#F5F1FB` |
| `--ac-color-border` | Input/dropdown borders, dividers | `#D1D9E0` |
| `--ac-color-danger` | Error state text/icon | `#CF222E` |
| `--ac-color-warning` | Rate-limit state text/icon | `#9A6700` |
| `--ac-color-warning-bg` | Rate-limit callout background | `#FFF8C5` |
| `--ac-color-success` | Live-region OK / demo checkmarks | `#1A7F37` |
| `--ac-font-ui` | Component UI text | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| `--ac-font-mono` | Logins and `owner/repo` paths | `ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace` |
| `--ac-radius` | Input + dropdown corner radius | `10px` |
| `--ac-radius-item` | Row highlight radius | `6px` |
| `--ac-space` | Base spacing unit | `8px` |
| `--ac-shadow` | Dropdown elevation | `0 8px 24px rgba(31,35,40,.12), 0 1px 3px rgba(31,35,40,.08)` |
| `--ac-dropdown-max-height` | Dropdown height bound (~8 rows, then scroll) | `368px` |
| `--ac-z-index` | Portal layer | `1000` |

Default values meet WCAG AA contrast; the rationale per token lives in
[`docs/design/design-tokens.md`](docs/design/design-tokens.md) and
[`src/lib/autocomplete/tokens.css`](src/lib/autocomplete/tokens.css).

## Decisions

The brief left a few points open; these were resolved explicitly (full history in
[`docs/planning-artifacts/`](docs/planning-artifacts/)):

- **D1 — "limited to 50 per request" means both.** Each of the two Search API calls requests
  `per_page=50`, *and* the combined, alphabetically sorted list is trimmed to at most 50 items.
  The ambiguous requirement is read as a cap at both levels, so the user never sees more than 50
  rows and each row is among the alphabetically first of the merged set.
- **D2 — partial failure is a full error, never partial results.** Users and repositories are
  fetched with `Promise.all`; if either fails, the whole query fails into the error state. A
  partial list would silently break the "combined and displayed alphabetically" guarantee and add
  hybrid states — predictability and testability win over showing half an answer.
- **D3 — the ordering key is the bare name.** Sorting uses the repository *name* and the user
  *login* (case-insensitive `localeCompare`, sensitivity `base`), per the brief's literal
  "repository and profile name as ordering keys". The rendered row may display `owner/name`, but
  `owner` never influences order.
- **D4 — the dropdown renders through a React portal** to `document.body`, positioned to the
  input's viewport rect. This is what makes the component render correctly inside
  `overflow: hidden` hosts — a reusability requirement, verified in e2e. ARIA relationships are
  id-based, so the portal does not break the combobox pattern. (A documented in-place
  `position: absolute` fallback exists in the architecture if portal positioning ever proved too
  costly; it was not needed.)
- **D5 — no pagination or infinite scroll, deliberately.** The 50-item cap is a bound, not a
  paging feature: full alphabetical order across both domains requires the whole result set up
  front (GitHub itself sorts by relevance score), so paging would break the ordering guarantee.
  A bounded, scrollable list of ≤50 items needs neither paging nor virtualization.

## Testing

Three layers, each testing what only it can test (`pnpm test` covers the first two,
`pnpm test:e2e` the third):

1. **Unit (Vitest)** — pure logic: merge + sort + cap, GitHub response mapping, error mapping
   including 403 → rate-limit detection.
2. **Integration (Vitest + React Testing Library + jsdom + MSW)** — rendered component behavior
   with HTTP mocked at the network level (never fetch stubs): the 3-character threshold, debounce
   (fake timers), stale-request cancellation, all five states including the rate-limit rendering,
   keyboard navigation and Escape, the full ARIA wiring, and the second-data-source reuse proof.
3. **E2E, thin by design (Playwright + `@axe-core/playwright`)** — only browser-real behavior:
   Enter/click opens a real new tab, focus management, rendering inside an `overflow: hidden`
   host, rate-limit state, and an automated axe accessibility scan. The GitHub API is mocked via
   `page.route`, so e2e is deterministic and rate-limit-proof in CI.

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs lint → typecheck → unit/integration
→ e2e on every push and PR to `master`.

## Rate limits and the optional token

The demo calls the GitHub Search API client-side and unauthenticated by default, which GitHub
throttles at **~10 requests per minute**. Hitting the limit is a first-class UI state, not a
failure: the dropdown shows a distinct rate-limit message including when a retry makes sense
(from `retry-after` / `x-ratelimit-reset` when available).

To raise the limit locally, supply an optional personal access token:

```bash
cp .env.example .env.local     # .env.local is gitignored
# then set: VITE_GITHUB_TOKEN=<your token>
```

The client sends it as `Authorization: Bearer <token>` when present. **Never commit a token** —
`.env.local` is gitignored and `.env.example` documents the variable name only, with no value.

## Deployment

The demo deploys to GitHub Pages via [`.github/workflows/pages.yml`](.github/workflows/pages.yml)
on every push to `master`: the Vite build runs with `VITE_BASE=/github-autocomplete/` (project
pages are served under the repo sub-path) and the `dist/` artifact is published with
`actions/deploy-pages`. `vite.config.ts` reads `base` from the env and defaults to `/`, so local
dev, preview, and the e2e web server are unaffected. Vercel was evaluated as an alternative
(zero-config Vite support, per-PR previews) and documented but not chosen — Pages keeps the repo,
CI, and live demo on one platform with zero extra accounts for the evaluator.

### Release checklist

Performed by the operator at release time (CI cannot make a repo public):

- [x] Repository is **public**
- [x] GitHub Pages enabled (Settings → Pages → Source: *GitHub Actions*), first deploy green
- [x] Live demo URL serves **both instances** and is linked at the top of this README
- [x] CI green on `master`

## Repository map

```
├── src/lib/autocomplete/        # the reusable component (hook, component, tokens, tests)
├── src/features/github-search/  # GitHub adapter (client, merge/sort, error mapping, tests)
├── src/demo/ + src/App.tsx      # demo sandbox (both instances, country data source)
├── e2e/                         # thin Playwright + axe specs
├── docs/task.md                 # the original brief (ground truth)
├── docs/planning-artifacts/     # PRD, architecture, epics
├── docs/implementation-artifacts/  # per-story specs with Dev Agent Records
├── docs/features/               # per-story documentation (what shipped, manual test scripts)
└── docs/design/                 # design tokens and visual ground truth
```

The project was delivered story-by-story (one branch + PR per story, squash-merged) with a
spec-driven process — the planning and per-story documentation under `docs/` is part of the
deliverable, not an afterthought.

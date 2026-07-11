# 3.4 — Structure refactor: lib public API barrel + demo country grouping

## What was built

A structure-only refactor with zero behavior change:

1. **Public API barrel** — `src/lib/autocomplete/index.ts` now defines the lib's public surface
   with explicit named exports (`Autocomplete`, `useAutocomplete`, and the 14 public types via
   `export type`). It is the only supported import path for consumers; everything not re-exported
   is internal and freely renamable. The barrel is a leaf — no lib-internal file imports it, so no
   import cycle can form.
2. **ESLint inward guard** — a second `no-restricted-imports` block in `eslint.config.js`
   (scoped to all `src/**` except `src/lib/**`) forbids deep imports into
   `**/lib/autocomplete/*`/`**`, complementing the existing AR-2 outward block (lib must not
   import features/app/demo). Enforcement was verified by trial: restoring one deep import made
   `pnpm lint` fail with the barrel-pointing message.
3. **Demo country grouping** — the five loose `country*` files and `hooks/useSelectedCountry.ts`
   moved (via `git mv`, so history follows) into `src/demo/country/`; the now-empty
   `src/demo/hooks/` was removed. The demo now reads at a glance: `country/` (second adapter,
   reuse proof) + `components/` (stage chrome).

## Files touched

- `src/lib/autocomplete/index.ts` — NEW — public API barrel (explicit named exports, no `export *`).
- `src/features/github-search/GithubAutocomplete.tsx` — UPDATE — barrel imports.
- `src/features/github-search/describeError.ts` — UPDATE — barrel import.
- `src/demo/components/CountryPanel.tsx` — UPDATE — barrel import + `../country/*` paths.
- `src/demo/components/SelectedReadout.tsx` — UPDATE — `../country/countries` path.
- `src/demo/country/{countryAdapter.ts,countryAdapter.test.ts,countries.ts,countryRenderItem.tsx,countryInstance.test.tsx,useSelectedCountry.ts}` — MOVED from `src/demo/` root and `src/demo/hooks/` (only relative-import paths edited).
- `eslint.config.js` — UPDATE — inward deep-import guard (second `no-restricted-imports` block).
- `docs/planning-artifacts/architecture.md` — UPDATE — §3.2 tree (barrel line + `demo/country/` note).
- `docs/implementation-artifacts/3-3-readme-and-deploy.md` — UPDATE — dependency note on 3.4.

## Key decisions

- **Explicit export list, not `export *`.** The enumerated list *is* the contract — an
  intentional, reviewable API surface. Type re-exports use `export type { … }` to keep type
  erasure unambiguous under strict TS settings.
- **CSS is not re-exported.** `Autocomplete.tsx` imports its own CSS Module; `tokens.css` remains
  a documented opt-in stylesheet (Story 0.3), not a JS export.
- **Two separate ESLint blocks, separately commented.** They enforce the two directions of the
  same AR-2 contract (lib must not reach outward; consumers must not reach inward) and should be
  readable independently.

### Recorded non-goals (considered and rejected)

- **No `adapter.ts` split out of `mergeResults.ts`.** The `createFetchSuggestions*` factories are
  the adapter's construction API and live next to the merge they compose. Splitting had no
  behavioral, readability, or contract driver — only file-name aesthetics — against real costs:
  test/import churn in a 343-line test file, drift from the closed Story 2.2 feature docs, and
  diluted `git blame` in a history that is itself part of the deliverable.
- **No `hooks/`/`styles/`/`types/` subfolders inside `src/lib/autocomplete/`.** Five source files
  with one shared responsibility; type-based folders would add indirection, not clarity.
- **The country instance stays in `demo/`, not `features/`.** `features/` is for production-grade
  adapters; the country adapter is a ~20-line demo fixture proving `Autocomplete<T>` is generic.
  Promoting it would blur the AR-2 "sandbox stage" boundary.

## Tests

- No new tests: this story changes structure, not behavior. All existing suites pass unchanged —
  only import paths inside moved/consumer files were edited; no test assertion changed.
- Guard enforcement proven by trial (deep import → `pnpm lint` fails → reverted).
- Full verification: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` green, plus a
  `pnpm dev` spot-check that both demo instances search, navigate, and select as before.

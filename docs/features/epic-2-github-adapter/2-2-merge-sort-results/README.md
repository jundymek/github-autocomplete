# 2.2 — Merge, sort, cap — the combined-results contract

## What was built

The combined-results pipeline of the GitHub adapter (AR-8 steps 2–4): a pure
`mergeResults(users, repos)` function that concatenates both result lists,
sorts them alphabetically, and caps the output at 50 items — plus the composed
`createFetchSuggestions(token?)` factory whose returned function is the exact
AR-4 contract consumed by the generic `Autocomplete<T>` component (and a
default unauthenticated `fetchSuggestions` instance).

## Files touched

- `src/features/github-search/mergeResults.ts` — NEW — pure merge/sort/cap (`mergeResults`, `MAX_RESULTS`) and the composed `createFetchSuggestions` / `fetchSuggestions` (kept in one module; a sibling file added no value for two small functions over the same types)
- `src/features/github-search/mergeResults.test.ts` — NEW — 17 tests: pure unit tests with direct fixtures + MSW tests for the composition

## Key decisions

- **Sort key is the bare name / login (owner decision U3).** The comparator
  keys on `GithubResult.name` — user `login` or bare repository `name`, never
  the `owner/name` display path. Comparison uses
  `localeCompare(other, undefined, { sensitivity: 'base' })`, so ordering is
  case-insensitive, diacritic-insensitive (`é` ≈ `e`) and locale-aware.
- **Deterministic tie-break (documented assumption):** equal base names are
  ordered by `kind` (`repo` before `user`), then by `id` (string-compared),
  then by id **type** (`number` before `string`). The last tier makes the
  comparator total even for the theoretical `1` vs `'1'` collision (`id` is
  typed `number | string`), so the order is reproducible regardless of input
  order. AR-8/FR-5 fix the primary sort but not ties; relying on input order
  (GitHub's per-endpoint relevance order) would make results and tests
  non-reproducible. Any consumer (2.3 tests included) should share this
  expectation.
- **"50 per request" → 50 combined (PRD §4.2, D2/U1):** each search already
  requests `per_page=50`; the merged list is trimmed to `MAX_RESULTS = 50`
  **after** sorting, so with 50 + 50 available the output is the alphabetically
  first 50 of the merged 100.
- **All-or-nothing via `Promise.all` (owner decision U2):** if either search
  fails, `fetchSuggestions` rejects with the single typed `GithubSearchError`
  from the client — never a partial list, which would silently break the
  combined alphabetical guarantee. `AbortError` propagates unchanged
  (cancellation is not an error and not an empty resolve).
- **AR-4 contract via construction-time token binding:**
  `createFetchSuggestions(token?)` returns
  `(query: string, signal: AbortSignal) => Promise<GithubResult[]>` — the
  optional GitHub token is bound when the fetcher is created, so the injected
  signature stays GitHub-agnostic. `fetchSuggestions` is the exported
  unauthenticated default instance.

## How it works

The fetcher returned by `createFetchSuggestions` awaits `searchGithub` (two
parallel fetches, Story 2.1) and pipes the mapped `{ users, repos }` through
`mergeResults`: concatenate → sort with the comparator above →
`slice(0, MAX_RESULTS)`. The module is otherwise pure — no fetch, no side
effects, imports only the client and the `GithubResult` type.

## Tests

- Unit (direct fixtures, no network): mixed-kind alphabetical ordering; sorting
  on bare name vs `displayPath`; case-insensitivity (`Rea`/`rea`/`REA`
  interleave by base letter); diacritics (`félix` sorts between `felipe` and
  `feliz`); tie-break determinism regardless of input order; the exact-50 trim
  boundary (100 → first 50; 50 → 50 unchanged); empty inputs.
- Integration (MSW at the network boundary): both-success merge through
  `fetchSuggestions`; partial-failure rejection with the typed error (500 and
  rate-limit variants); `AbortError` propagation; token plumb-through to both
  requests; end-to-end cap at 50.
- Manual: **skipped** — pure logic + composition, fully covered by unit tests
  (no browser-verifiable behavior in this story).
- PERFORMANCE.md: **not applicable** — sorting/capping ≤100 items is trivial;
  the adapter's real performance dimension (debounce/abort) lives in the Epic 1
  hook (Story 1.1).

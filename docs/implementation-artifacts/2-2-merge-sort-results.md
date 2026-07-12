---
baseline_commit: b6fb085ee3c1dba9faade84363c747e26806028b
---

# Story 2.2: Merge, sort, cap — the combined-results contract

Status: Done

## Story

As an end user,
I want users and repositories combined into one alphabetical list of at most 50 items — or a single clear error,
so that results are predictable and ordered exactly as the brief requires.

*(FR-4 all-or-nothing, FR-5 alphabetical combined ordering, FR-6 result cap of 50; AR-8 steps 2–4.)*

## Acceptance Criteria

1. Given successful responses from both searches, when the pure merge function runs, users and repositories are merged into a **single** list. (FR-4, AR-8 step 2)
2. The merged list is sorted **case-insensitively and locale-aware** via `localeCompare` with `sensitivity: 'base'`, keyed on `result.name` — which is the **user login** for users and the **bare repository name** for repos (never `owner/name`, even though display may show `owner/name`). (FR-5, PRD §9 U3, AR-8 step 2)
3. `sensitivity: 'base'` treats accented and case-varying letters as equal for ordering (e.g. `é`≈`e`, `Å`≈`a`-region per locale, `Rea`≈`rea`) — diacritics and case do not reorder items relative to their base letter. (FR-5, AR-8 step 2)
4. A **deterministic tie-break** is applied so equal `name` comparisons produce a stable, reproducible order: compare by `name` (base), then by `kind` (`repo` before `user`, documented), then by `id` (string-compared). This makes the sort total and test-stable regardless of input order. (FR-5 consequence; AR-8 step 2)
5. The combined list is trimmed to **at most 50** items **after** sorting — given 50 users + 50 repositories (100 merged), the result is the alphabetically first 50 of the merged set. (FR-6, PRD §4.2 / D2-U1 interpretation)
6. When **either** underlying search fails, the composed `fetchSuggestions(query, signal)` rejects with the single typed `GithubSearchError` — **full error state, never partial results** (`Promise.all` semantics). (FR-4, PRD §9 U2, AR-8 step 4)
7. The composed `fetchSuggestions` satisfies the AR-4 contract signature `(query: string, signal: AbortSignal) => Promise<GithubResult[]>`, ready for any consumer of the generic `Autocomplete<T>` component (the 2.3 wiring and, conceptually, the demo). (AR-4, AR-8)
8. `AbortError` propagates from the client through `fetchSuggestions` unchanged — cancellation is not converted to a `GithubSearchError` and is not a resolved empty list. (AR-3, AR-9)
9. Unit tests cover: (a) mixed-kind ordering across users and repos in one alphabetical sequence; (b) **case-insensitivity** — `Rea`/`rea`/`REA` interleave by base letter, not by ASCII case; (c) **diacritics** via `localeCompare` sensitivity `'base'` (an accented name sorts next to its base-letter neighbor); (d) **tie stability** — equal base names emit the documented deterministic order regardless of input order; (e) the **exact-50 trim boundary** — 100 merged items yield exactly the first 50 sorted; 50 in → 50 out unchanged; (f) **empty inputs** — empty users + empty repos → `[]`; one side empty → the other side sorted/capped; (g) **partial-failure rejection** — the composed `fetchSuggestions` rejects with the typed error when one search fails. (FR-18)

## Tasks / Subtasks

- [x] Task 1 — Pure merge/sort/cap (AC: 1–5)
  - [x] Create `src/features/github-search/mergeResults.ts` exporting a pure, dependency-free function `mergeResults(users: GithubResult[], repos: GithubResult[]): GithubResult[]` that concatenates, sorts, and caps to 50.
  - [x] Sort comparator: primary `a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })`; on `0`, tie-break by `kind` (`repo` < `user`), then by `String(a.id).localeCompare(String(b.id))`. Document the tie-break in a comment (AC 4).
  - [x] Cap: `.slice(0, 50)` **after** sorting (AC 5). Define `MAX_RESULTS = 50` as a named constant.
  - [x] Keep the module pure: no `fetch`, no side effects, no imports beyond the `GithubResult` type. (AR-8 "pure, unit-testable module")
- [x] Task 2 — Composed `fetchSuggestions` (AC: 6, 7, 8)
  - [x] In `mergeResults.ts` (or a small `githubSuggestions.ts` in the same folder — pick one, note it in the README), compose the Story 2.1 client + `mergeResults` into `fetchSuggestions(query, signal)` matching the AR-4 signature.
  - [x] Await the client's two parallel fetches via `Promise.all`; on both-success, map/merge/cap and resolve `GithubResult[]`; on either failure, let the typed `GithubSearchError` reject (do not catch-and-partial). Let `AbortError` propagate unchanged. (AC 6, 8)
  - [x] Ensure the token argument (if any) is plumbed through to the client so 2.3 can pass a prop-supplied token. (FR-16 continuity)
- [x] Task 3 — Tests (AC: 9)
  - [x] `src/features/github-search/mergeResults.test.ts` — pure unit tests for cases (a)–(f): build `GithubResult` fixtures directly (no network needed for the pure function). Assert exact ordering arrays, the 50-boundary slice, and empty-input handling.
  - [x] Test (g) partial-failure rejection through the composed `fetchSuggestions` — use MSW node server (per §3.6) so one endpoint 500s/403s and the other succeeds, and assert `fetchSuggestions` rejects with the typed `GithubSearchError` (never resolves a partial list). Reuse Story 2.1's MSW handler patterns.
- [x] Task 4 — Verify (AC: all)
  - [x] `pnpm lint && pnpm typecheck && pnpm test` all green. No new dependencies. Test-first for the pure function.

## Documentation deliverables

Part of Definition of Done (see CLAUDE.md). Create the documentation folder:
`docs/features/epic-2-github-adapter/2-2-merge-sort-results/`

- **README.md** — required. Document: the merge → `localeCompare(sensitivity:'base')` sort on **bare name / login** → cap-50 pipeline, the deterministic tie-break rule (name → kind → id) and why it exists, the "50 per request → 50 combined" interpretation (PRD §4.2), the all-or-nothing (`Promise.all`) rejection behavior, and the composed `fetchSuggestions` AR-4 signature consumers use.
- **MANUAL_TESTING.md** — **skip** (pure logic + composition, unit-tested only). State this in the README.
- **PERFORMANCE.md** — **not applicable.** Sorting/capping ≤100 items is trivial; the feature's real performance dimension (debounce/abort) lives in the Epic 1 hook (1.1). State the n/a decision in the README.

## Dev Notes

**Prerequisite:** Story 2.1 merged — the `githubClient` (two parallel fetches, `GithubResult` mapping, `GithubSearchError` mapping) and `types.ts`. This story is **independent of Epic 1** and runs in parallel with it; it composes the client into the AR-4-shaped `fetchSuggestions` that Story 2.3 (and conceptually the demo) consume. [Source: docs/planning-artifacts/epics.md#Story 2.2; #Story 2.1; docs/implementation-artifacts/2-1-github-api-client.md]

**Branch & PR:** `story/2-2-merge-sort-results` → `master`, squash. Conventional Commit e.g. `feat(2.2): add merge, sort and cap for combined github results`. **No `Co-Authored-By` / no AI attribution.** Codex pre-PR review + green CI, run URL in the Dev Agent Record. [Source: CLAUDE.md#Working rules, #Story pipeline; architecture.md §3.7]

**Package manager is pnpm (NOT npm), Node 22.** `pnpm lint` / `pnpm typecheck` / `pnpm test`. No new dependencies. [Source: CLAUDE.md#Stack; architecture.md AR-1]

**Ordering key is the bare name / login — NOT `owner/name` (owner decision U3).** The comparator keys on `GithubResult.name`, which Story 2.1 already set to the user `login` and the **bare repository name**. Display may show `displayPath` (`owner/name`) but sorting must never use it. `localeCompare` with `sensitivity: 'base'` gives case-insensitive, diacritic-insensitive, locale-aware ordering exactly as AR-8 mandates. [Source: architecture.md AR-8 step 2; PRD FR-5, §9 U3; design/component-states.html state 04 note ("Sort key: bare repo name / login")]

**Deterministic tie-break (assumption — headless run).** AR-8/FR-5 fix the primary sort but not the tie-break for equal base names; `Array.prototype.sort` is stable in modern engines but input order (users concatenated before repos, GitHub's per-endpoint relevance order) is not a guarantee we want to rely on for reproducible tests. **[ASSUMPTION: tie-break = name(base) → kind (`repo` before `user`) → `id`.]** This is defensible, total, and test-stable; record it in the README so 2.3 tests and any future consumer share the same expectation. [Source: architecture.md AR-8 step 2; PRD FR-5]

**"50 per request" → 50 combined (PRD §4.2, D2/U1).** Each search already requests `per_page=50` (Story 2.1); the **combined** merged list is trimmed to at most 50 **after** sorting, so with 50+50 available the output is the alphabetically first 50 of the merged 100. This is the owner-confirmed interpretation and must also be stated in the root README (Story 3.3). [Source: PRD §4.2 documented interpretation, FR-6, §9 U1; architecture.md AR-8 step 3]

**All-or-nothing via `Promise.all` (owner decision U2).** If either search fails, `fetchSuggestions` rejects with the single typed `GithubSearchError` — never a partial list. A partial list would break the combined alphabetical guarantee (FR-5) and add states. `Promise.all` provides these semantics for free. The generic component receives only an `error` status from this rejection (message mapping is 2.3). `AbortError` still propagates unchanged (not an error, not an empty resolve). [Source: PRD FR-4, §9 U2; architecture.md AR-8 step 4, AR-9, §3.3; design/component-states.html state 07 note]

**AR-4 contract (the single seam).** `fetchSuggestions(query: string, signal: AbortSignal) => Promise<GithubResult[]>` is the exact shape the generic `Autocomplete<T>` injects (AR-4); the hook's `AbortController` signal flows through it. Do not add GitHub-specific parameters to this signature beyond the optional token binding done at construction time. [Source: architecture.md AR-4, AR-8; §4 cross-component dependencies]

**Testability (AR-12, §3.6).** The pure merge/sort/cap is **unit** level (Vitest, direct fixtures, no network). The partial-failure composition test is exercised through MSW at the network boundary (fetch stubs forbidden). Test-first for the pure function. [Source: architecture.md §3.6, AR-12; CLAUDE.md#Working rules]

**Scope boundary / what NOT to build here:**
- **No** raw request construction or error mapping — those live in Story 2.1's `githubClient`; this story imports them. [Source: epics.md#Story 2.1]
- **No** UI, `renderItem`, rate-limit **message text**, or new-tab selection — that is Story 2.3. [Source: epics.md#Story 2.3]
- **No** debounce/threshold — Epic 1 hook. [Source: architecture.md AR-3]

### Project Structure Notes

- New file **`src/features/github-search/mergeResults.ts`** (+ co-located `mergeResults.test.ts`); the composed `fetchSuggestions` lives here (or a sibling `githubSuggestions.ts` in the same folder — document the choice). Imports the client + `GithubResult` from Story 2.1; stays inside the adapter layer. The `lib/` layer must not import from here (AR-2, ESLint-enforced). [Source: architecture.md §3.2, AR-2; CLAUDE.md#Architecture boundary]
- Naming per §3.1: `camelCase.ts` module, co-located `*.test.ts`, `type` aliases, TSDoc on the exported `mergeResults`/`fetchSuggestions`. [Source: architecture.md §3.1]

### References

- [Source: docs/planning-artifacts/epics.md#Story 2.2: Merge, sort, cap — the combined-results contract]
- [Source: docs/planning-artifacts/epics.md#Epic 2: GitHub Adapter]
- [Source: docs/planning-artifacts/architecture.md#AR-8 GitHub adapter data flow (steps 2–4)]
- [Source: docs/planning-artifacts/architecture.md#AR-4 Autocomplete injected contract (fetchSuggestions signature)]
- [Source: docs/planning-artifacts/architecture.md#3.6 Testing conventions]
- [Source: docs/planning-artifacts/prds/prd-github-autocomplete-2026-07-09/prd.md#FR-4, FR-5, FR-6; §4.2; §9 Resolved Questions U1/U2/U3]
- [Source: docs/design/component-states.html#state 04 results; #state 07 error]
- [Source: docs/implementation-artifacts/2-1-github-api-client.md (client + GithubResult/GithubSearchError)]
- [Source: CLAUDE.md#Stack, #Architecture boundary]

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5) via Claude Code

### Implementation Plan

1. TDD (red first): `mergeResults.test.ts` — pure fixture-based unit tests for AC 9 (a)–(f), plus MSW-backed tests for the composed `fetchSuggestions` (AC 6–8, 9g, token plumb-through, end-to-end cap).
2. Implement `mergeResults.ts`: `MAX_RESULTS = 50`, pure `mergeResults` (concat → `localeCompare(sensitivity: 'base')` on `name` → tie-break kind/id → `slice(0, 50)`), and `fetchSuggestions(query, signal, token?)` composing the Story 2.1 `searchGithub` client.
3. Docs folder + full verification + review gate.

### Debug Log References

None — implementation went green on first pass after the failing-test run (17/17 new tests, 148/148 total, e2e smoke green).

### Completion Notes List

- Both `mergeResults` and `fetchSuggestions` live in `mergeResults.ts` (option chosen over a sibling `githubSuggestions.ts` — two small functions over the same types; documented in the feature README).
- Tie-break implemented as `name` (base) → `kind` (`repo` before `user`, via plain `localeCompare` since `'repo' < 'user'`) → `String(id)` comparison, per the spec's documented assumption.
- All-or-nothing rejection comes for free from Story 2.1's `Promise.all` inside `searchGithub`; this story adds no catch — typed `GithubSearchError` and `AbortError` both propagate unchanged (verified by MSW tests).
- Optional `token` is plumbed through to the client as a third parameter; the AR-4 two-argument signature is preserved by binding the token at construction time (documented in TSDoc + README).
- MANUAL_TESTING.md skipped and PERFORMANCE.md n/a per spec — both decisions stated in the feature README.
- Verification: `pnpm lint && pnpm typecheck && pnpm test` and `pnpm test:e2e` all green (150 unit/integration + 1 e2e after review fixes); no new dependencies.

### Review gate (pre-PR)

- **Security review (skill):** no qualifying findings — pure function + thin composition over the 2.1 client; no new I/O, logging, injection or token-exposure surface; tests use a dummy token only.
- **Codex second-pass review:** 3 findings, all triaged and verified:
  1. *Tie-break not total for mixed-type ids (`1` vs `'1'`) — VALID (theoretical).* `String(id)` comparison collides for `1` vs `'1'`; `GithubResult.id` is typed `number | string`, so the comparator was not total over its domain even though GitHub ids are numeric in practice. **Fixed:** added a final `typeof` tier (`number` before `string`) + regression test with both input orders.
  2. *AR-4 signature drift — optional `token` param on `fetchSuggestions` — VALID (design).* A 3-arg function with optional `token` is assignable to the AR-4 shape, but Dev Notes require the token binding "at construction time". **Fixed:** replaced with `createFetchSuggestions(token?)` factory returning the exact AR-4 signature, plus an unauthenticated default `fetchSuggestions` export; tests updated (factory token binding + default-instance no-auth test).
  3. *Missing mixed-type id collision test — VALID.* **Fixed** together with finding 1.
- Re-verified after fixes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` all green.
- **CI:** green on PR #8 — https://github.com/jundymek/github-autocomplete/actions/runs/29037275004

### File List

- `src/features/github-search/mergeResults.ts` — NEW
- `src/features/github-search/mergeResults.test.ts` — NEW
- `docs/features/epic-2-github-adapter/2-2-merge-sort-results/README.md` — NEW
- `docs/implementation-artifacts/2-2-merge-sort-results.md` — UPDATE (status, checkboxes, Dev Agent Record)

## Change Log

- 2026-07-09: Implemented Story 2.2 — pure merge/sort/cap (`mergeResults`, `MAX_RESULTS`) and composed `createFetchSuggestions`/`fetchSuggestions` (AR-4 contract) with 19 unit/integration tests; feature docs added.
- 2026-07-09: Review gate — security review clean; 3 Codex findings triaged and fixed (total tie-break via `typeof` tier, construction-time token binding via factory, mixed-id regression test). Status → Review.

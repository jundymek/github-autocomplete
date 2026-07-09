# Story 2.3: `GithubAutocomplete` — wired instance with new-tab selection and rate-limit state

Status: Approved

## Story

As an end user,
I want to search GitHub from one input and open the selected user or repository in a new tab, with a clear message when GitHub throttles me,
so that I can find and jump to any user/repo by keyboard alone and always understand failures.

*(FR-5 display, FR-9 rate-limit rendering, FR-11 new tab; AR-9 message mapping, AR-10 selection; NFR-3, NFR-5.)*

## Acceptance Criteria

1. Given the generic `Autocomplete<T>` (Story 1.3) and the composed `fetchSuggestions` (Story 2.2), `GithubAutocomplete` is a **thin wrapper** that wires the lib component with the client+merge adapter — it injects `fetchSuggestions`, `renderItem`, `getItemKey`, `onSelect`, and the state-message overrides, and imports **from lib, never the reverse** (AR-2 boundary). (AR-2, AR-4)
2. `renderItem` reproduces design **state 04**: users show an **avatar circle** + login; repositories show a **`{ }` tile** + bare name with a monospace `owner/repo` path; a right-aligned **KIND column** (`user`/`repo`); and the query match is echoed in the accent color within the name. The highlighted state is visually evident (highlight background + accent left bar — passed through by the lib component, not re-implemented). Kinds are distinguished **three ways, never color alone** (icon shape, mono path, KIND label). (FR-5 display note; design/component-states.html state 04)
3. `getItemKey(item)` returns a stable unique id (e.g. `` `${item.kind}:${item.id}` ``) used for React keys and `aria-activedescendant` option ids. (AR-4, §3.5)
4. When Enter is pressed on the highlighted item **or** it is clicked, `onSelect` calls `window.open(item.htmlUrl, '_blank', 'noopener,noreferrer')` — **identically** for both input methods — and the host page retains its state. (FR-11, AR-10)
5. When the fetch rejects with `kind: 'rate-limit'`, the dropdown shows a **rate-limit state** visually and textually distinct from the generic error (design **state 08**: amber/warning styling, names the cause, includes a **countdown of `retryAfterSeconds`** when available, and a **token hint** to raise the limit). (FR-9, §3.3, NFR-3; design state 08)
6. The `network` and `http` variants map to their **own readable messages** (design **state 07**: "Search failed" with a retry affordance) via an **exhaustive `switch` on `error.kind` with a `never` default** — compiler-enforced total handling. This mapping from `GithubSearchError` → user-facing message lives in the adapter (2.3), not the lib. (FR-9, §3.3, NFR-3, NFR-4)
7. The generic lib layer receives only `{ status: 'error'; message }`-level information — it **never learns what a rate limit is** (NFR-5 isolation). The distinct amber rate-limit *presentation* is achieved via the lib's overridable error-message/state hooks driven by the adapter, without teaching the lib GitHub semantics. (NFR-5, AR-9)
8. A footer reads **"X of Y · sorted A→Z"** where X is the displayed (capped) count and Y is the total from the API `total_count` (combined/derived, capped display), consistent with design state 04's `50 of 1,204 · sorted A→Z`. (design state 04; FR-6)
9. The error state offers a **retry** that re-fires the last query (retry affordance from design state 07). (design state 07; NFR-3 "recovers on the next Query")
10. RTL + MSW integration tests cover: (a) a typed query renders the **merged, sorted** list with users/repos visually distinguished (mixed rendering); (b) **Enter** on a highlighted item opens a new tab — a `window.open` **spy** asserts the exact args `(htmlUrl, '_blank', 'noopener,noreferrer')`; (c) **click** selection asserts the **same** `window.open` args; (d) a mocked **403 rate-limit** response renders the dedicated rate-limit state (distinct from generic error, showing the retry/countdown/token hint); (e) a mocked network/`http` failure renders the **generic error** state with a retry; (f) **retry re-fires** the last query and can render results. (FR-18)

## Tasks / Subtasks

- [ ] Task 1 — Wire the component (AC: 1, 3)
  - [ ] Create `src/features/github-search/GithubAutocomplete.tsx` — a thin wrapper rendering `Autocomplete<GithubResult>` from `src/lib/autocomplete/`, injecting `fetchSuggestions` (Story 2.2, with an optional `token` prop plumbed through), `getItemKey` (`` `${kind}:${id}` ``), `renderItem`, `onSelect`, and state-message overrides. Public props typed with TSDoc; optional `token?: string` prop forwarded to `fetchSuggestions`. (NFR-4)
- [ ] Task 2 — `renderItem` per design state 04 (AC: 2)
  - [ ] For `kind: 'user'`: avatar circle (`avatarUrl`) + `name` (login); for `kind: 'repo'`: `{ }` tile + bare `name` with a monospace `displayPath` (`owner/name`); right KIND column; echo the current query substring in the name using the accent (`<mark>`-style, `--ac-color-accent`). Do not re-implement highlight/focus — the lib component supplies highlighted state to `renderItem`. Distinguish kinds three ways (icon, mono path, KIND label), never color alone. [design state 04]
- [ ] Task 3 — Selection → new tab (AC: 4)
  - [ ] `onSelect = (item) => window.open(item.htmlUrl, '_blank', 'noopener,noreferrer')`. Enter and click both route through the lib's single selection path (Story 1.2/1.3), so identical behavior is structural. Host page state is untouched.
- [ ] Task 4 — Error/rate-limit message mapping (AC: 5, 6, 7)
  - [ ] Add a pure `describeError(error: GithubSearchError): { message: string; ... }` (or equivalent) in the adapter that switches exhaustively on `error.kind` with a `never` default: `rate-limit` → amber-styled message naming the throttle + countdown from `retryAfterSeconds` (when present) + token hint; `network` → "Search failed / check your connection"; `http` → "Search failed" (optionally including status). Feed these into the lib's error-state/message override so the lib stays GitHub-ignorant (only `{ status:'error'; message }` crosses the boundary).
  - [ ] Render the rate-limit variant with the design state-08 (warning/amber) presentation and the generic error with state-07 presentation, using the lib's provided state-override seam (per Story 1.3's message/state override props, AR-4). If a distinct amber *container* is needed, drive it from adapter-supplied render, not by adding GitHub knowledge to the lib. (NFR-5)
- [ ] Task 5 — Footer + retry (AC: 8, 9)
  - [ ] Render the footer "X of Y · sorted A→Z" (X = displayed count, Y = API `total_count`, capped display) and the retry affordance that re-invokes the last query, consistent with design states 04/07. Surface `total_count` from the adapter (thread it from 2.1/2.2 as needed, or note if it requires a small return-shape extension — record any such change).
- [ ] Task 6 — Tests (AC: 10)
  - [ ] `src/features/github-search/GithubAutocomplete.test.tsx` — RTL + MSW node server (no fetch stubs). Cover (a)–(f). Spy on `window.open` (`vi.spyOn(window, 'open')`) and assert exact args for both Enter and click. Mock the 403 rate-limit (with `retry-after`) and a 500/network failure via MSW handlers. For retry, assert a second successful query renders results after an initial failure.
- [ ] Task 7 — Verify (AC: all)
  - [ ] `pnpm lint && pnpm typecheck && pnpm test` all green. No new dependencies.

## Documentation deliverables

Part of Definition of Done (see CLAUDE.md). Create the documentation folder:
`docs/features/epic-2-github-adapter/2-3-github-autocomplete/`

- **README.md** — required. Document: the wrapper's public props (incl. optional `token`), the `renderItem` design (user vs repo distinction per state 04), the `onSelect` new-tab behavior (`noopener,noreferrer`), the `GithubSearchError` → message mapping (exhaustive switch, rate-limit vs generic error), how NFR-5 isolation is preserved (lib sees only `{status:'error';message}`), and the footer/retry behavior.
- **MANUAL_TESTING.md** — **required** (this story ships visible, human-verifiable browser behavior). Steps: run `pnpm dev`, type a query, observe merged users/repos with avatar vs `{ }` distinction and the KIND column, ArrowDown + Enter opens a new tab, click opens the same, trigger/observe the rate-limit state (amber, countdown, token hint) and the generic error + retry. Include accessibility checks (keyboard-only operation, visible focus, that focus stays on the input). Per epics.md#Story 2.3 documentation deliverables. [Source: epics.md#Story 2.3; CLAUDE.md#Documentation deliverables]
- **PERFORMANCE.md** — **not applicable.** The debounce/abort/render-volume performance dimension lives in the Epic 1 hook + component (1.1, 1.3); this wrapper adds thin rendering/selection over them. State the n/a decision in the README.

## Dev Notes

**Prerequisite:** Stories **2.2** (composed `fetchSuggestions`, `GithubResult`, `GithubSearchError`) and **1.3** (the generic `Autocomplete<T>` presentational component with its injected contract, state rendering, portal dropdown, ARIA, and message/state overrides) merged. **This is the only Epic 2 story that depends on Epic 1** — it is where the two layers meet. Read the merged 1.3 component's public props (AR-4) before wiring; use its state-message/override seam for the rate-limit presentation rather than inventing a new mechanism. [Source: docs/planning-artifacts/epics.md#Story 2.3; #Story 1.3; #Story 2.2; architecture.md AR-4]

**Branch & PR:** `story/2-3-github-autocomplete` → `master`, squash. Conventional Commit e.g. `feat(2.3): add wired GithubAutocomplete with new-tab selection and rate-limit state`. **No `Co-Authored-By` / no AI attribution.** Codex pre-PR review + **security check** (unsafe URL/target handling — confirm `noopener,noreferrer`; no token leakage), green CI, run URL in the Dev Agent Record. [Source: CLAUDE.md#Working rules, #Story pipeline; architecture.md §3.7]

**Package manager is pnpm (NOT npm), Node 22.** `pnpm lint` / `pnpm typecheck` / `pnpm test`. No new dependencies. [Source: CLAUDE.md#Stack; architecture.md AR-1]

**Architecture boundary — imports go one way (AR-2, critical).** `GithubAutocomplete` lives in `src/features/github-search/` and imports the generic component **from** `src/lib/autocomplete/`; **`lib/` must never import from `features/`.** The ESLint `no-restricted-imports` rule (Story 0.1) enforces this. The lib component must stay GitHub-ignorant: it only ever receives `{ status: 'error'; message: string }`-level information — it "never learns what a rate limit is" (NFR-5). Achieve the distinct amber rate-limit presentation through the lib's documented state/message override props (AR-4), driven by the adapter's `describeError`. [Source: CLAUDE.md#Architecture boundary; architecture.md AR-2, AR-4, §3.3; PRD NFR-5]

**Design ground truth — reproduce these states exactly** (`docs/design/component-states.html`):
- **State 04 (results):** 3-column item grid `28px 1fr auto` — icon slot / name+meta / KIND. Users: `.ac-avatar` circle. Repos: `.ac-repoicon` `{ }` tile + `.ac-name .path` monospace `owner/repo`. Query match echoed via `<mark>` in `--ac-color-accent`. Footer `50 of 1,204 · sorted A→Z` + `↑↓ browse · ↵ open`. **Kinds distinguished three ways, never color alone.** [Source: design/component-states.html state 04]
- **State 07 (error — network/HTTP):** centered "Search failed" (danger color) + description + a **Try again** retry button. All-or-nothing: if either request fails, the whole state is error (owner U2). Retry re-fires the last query. [Source: design/component-states.html state 07; PRD §9 U2]
- **State 08 (rate limit):** amber (`--ac-color-warning` / `--ac-color-warning-bg`), left-aligned, names the cause ("GitHub rate limit reached"), **counts down from `retry-after`** ("Try again in 42s"), points to the **token** option. Distinct from the generic error — "the most likely state an evaluator hits — treat it as a first-class citizen." [Source: design/component-states.html state 08; PRD FR-9, UJ-2]

**Selection — new tab with `noopener,noreferrer` (AR-10, FR-11).** `onSelect` calls `window.open(item.htmlUrl, '_blank', 'noopener,noreferrer')`; `noopener,noreferrer` prevents reverse-tabnabbing. Enter and click are identical because both route through the lib's single selection handler (Stories 1.2/1.3) — the wrapper supplies only `onSelect`. The host/demo page retains state (UJ-1). Verified in tests via a `window.open` spy and later in e2e (Story 3.2) via `context.waitForEvent('page')`. [Source: architecture.md AR-10; PRD FR-11, UJ-1; epics.md#Story 3.2]

**Error message mapping — exhaustive switch (§3.3, NFR-4).** Convert `GithubSearchError` to user-facing text with a `switch (error.kind)` covering `network` | `http` | `rate-limit` and a `default` asserting `never` so a future union member is a compile error. This mapping is the adapter's job (the client only *produces* the typed error in 2.1); the rate-limit branch includes the `retryAfterSeconds` countdown and token hint. [Source: architecture.md §3.3, AR-9; PRD FR-9]

**Testability (AR-12, §3.6 — Integration level).** RTL + jsdom + **MSW node server** (fetch stubs forbidden). Belongs at integration per §3.6: rate-limit rendering (FR-9), mixed-kind rendering, selection. Spy `window.open`. The real-browser new-tab proof (`context.waitForEvent('page')`), focus, clipping and axe are Story 3.2 (e2e) — keep those out of this story. [Source: architecture.md §3.6, AR-12; epics.md#Story 3.2]

**Total-count for the footer (assumption — headless run).** The footer's "Y" (total) comes from the GitHub Search API `total_count`. Stories 2.1/2.2 map `items` to `GithubResult[]` and may not currently surface `total_count`. **[ASSUMPTION: thread the combined `total_count` to the adapter for the footer; if it requires a small return-shape extension to 2.1/2.2, make it minimally and record the change in architecture.md/the READMEs.]** If threading it proves disproportionate, fall back to the displayed count for "X of X"; prefer surfacing the real total to match design state 04. [Source: design/component-states.html state 04; PRD FR-6]

**Scope boundary / what NOT to build here:**
- **No** changes to the generic lib component beyond consuming its public props — if a genuine override seam is missing, that is an Epic 1 (1.3) gap; record it, do not add GitHub code to `lib/`. [Source: architecture.md AR-2; epics.md#Story 1.3]
- **No** e2e (new-tab via `waitForEvent`, focus, clipping, axe) — that is Story 3.2. [Source: epics.md#Story 3.2]
- **No** demo page / second data source — that is Story 3.1. [Source: epics.md#Story 3.1]
- **No** request construction / error *mapping to the union* (2.1) or merge/sort/cap (2.2) — imported, not re-built. [Source: epics.md#Story 2.1, #Story 2.2]

### Project Structure Notes

- New file **`src/features/github-search/GithubAutocomplete.tsx`** (+ co-located `GithubAutocomplete.test.tsx`), plus a small `describeError` helper (co-located or in the adapter's existing module). Component naming `PascalCase.tsx`, tests `*.test.tsx` (§3.1). Imports `Autocomplete<T>` from `src/lib/autocomplete/` and `fetchSuggestions`/types from the 2.1/2.2 adapter modules. Boundary rule (AR-2) forbids the reverse. [Source: architecture.md §3.1, §3.2, AR-2; CLAUDE.md#Architecture boundary]

### References

- [Source: docs/planning-artifacts/epics.md#Story 2.3: GithubAutocomplete — wired instance with new-tab selection and rate-limit state]
- [Source: docs/planning-artifacts/epics.md#Story 1.3 (generic Autocomplete public contract)]
- [Source: docs/planning-artifacts/architecture.md#AR-4 Autocomplete injected contract]
- [Source: docs/planning-artifacts/architecture.md#AR-9 Error modeling (message mapping)]
- [Source: docs/planning-artifacts/architecture.md#AR-10 Selection — new tab with noopener,noreferrer]
- [Source: docs/planning-artifacts/architecture.md#AR-2 Three-layer boundary; #3.3 Error modeling; #3.5 A11y; #3.6 Testing]
- [Source: docs/planning-artifacts/prds/prd-github-autocomplete-2026-07-09/prd.md#FR-5, FR-9, FR-11; UJ-1, UJ-2; NFR-3, NFR-5]
- [Source: docs/design/component-states.html#state 04 results; #state 07 error; #state 08 rate limit]
- [Source: docs/implementation-artifacts/2-1-github-api-client.md, 2-2-merge-sort-results.md]
- [Source: CLAUDE.md#Architecture boundary, #Documentation deliverables]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

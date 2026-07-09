# Story 2.1: GitHub API client with typed errors and optional token

Status: Approved

## Story

As an end user,
I want the app to query GitHub users and repositories reliably, with clear typed failures and an optional token,
so that searches work with zero setup and every failure mode — especially rate limiting — is distinguishable and actionable.

*(FR-4 fetches, FR-6 per-request cap, FR-9 error mapping, FR-16 optional token; AR-8 step 1, AR-9, §3.3; NFR-3, NFR-6.)*

## Acceptance Criteria

1. Given a qualifying query and an `AbortSignal`, when the client is invoked, it fires **exactly two parallel requests** via `Promise.all` — `GET https://api.github.com/search/users?q={q}&per_page=50` and `GET https://api.github.com/search/repositories?q={q}&per_page=50` — both sharing the **caller's** `AbortSignal` (one signal passed to both `fetch` calls). (FR-4, FR-6, AR-8 step 1)
2. Every request carries the headers `Accept: application/vnd.github+json` and a pinned `X-GitHub-Api-Version` (e.g. `2022-11-28`); the `q` value is URL-encoded. (AR-8, GitHub REST API conventions)
3. With no token configured, requests are **unauthenticated** and succeed against the (MSW-mocked) public API; with a token supplied via **function argument/prop** or `import.meta.env.VITE_GITHUB_TOKEN`, every request additionally carries `Authorization: Bearer <token>`. The prop-supplied token takes precedence over the env token. No token value exists anywhere in the repository. (FR-16, NFR-6, AR-9)
4. On success of **both** requests, each response body is mapped to the slim `GithubResult` domain union — `{ kind: 'user' | 'repo', id, name, displayPath, description, avatarUrl, htmlUrl }` — where for a **user** `name` = `login` and `displayPath` = `login`; for a **repo** `name` = the **bare repository name** (`name` field, not `full_name`) and `displayPath` = `owner/name` (`full_name`). `description` and `avatarUrl` are optional/nullable and normalized to `undefined` when absent. (FR-5 display note, AR-8 step 2, §3.3)
5. Response bodies are validated **defensively by hand** (Zod is NOT in this stack — see Dev Notes): the client reads only the fields it maps, guards `items` being an array, coerces/guards each item's required fields, and skips or safely defaults malformed items rather than throwing on shape drift. (NFR-4, NFR-3)
6. Every failure maps — **in this one module only** — to the exact §3.3 `GithubSearchError` discriminated union: `{ kind: 'network' }` when a `fetch` throws (offline, DNS, CORS); `{ kind: 'http'; status }` for a non-2xx response that is not a rate limit; `{ kind: 'rate-limit'; retryAfterSeconds? }` for **HTTP 403 with rate-limit headers** (`x-ratelimit-remaining: 0` or a `retry-after` header). (FR-9, AR-9, NFR-3, §3.3)
7. `retryAfterSeconds` for a rate-limit is derived from the `retry-after` header (seconds, parsed as an integer) when present; otherwise from `x-ratelimit-reset` (epoch seconds) as `max(0, reset - now)`; otherwise left `undefined`. (FR-9, AR-9)
8. `AbortError` is **never** mapped to a `GithubSearchError` — an aborted request rejects with the abort, and cancellation is not surfaced as an error state. (AR-3 contract, §3.3)
9. When either underlying request fails, the composed call rejects with the single typed `GithubSearchError` — **full error, never partial results** (`Promise.all` reject semantics; owner decision U2). Merge/sort/cap composition itself is Story 2.2; this story delivers the client and its error mapping. (FR-4, AR-8 step 4)
10. Unit tests (Vitest + MSW node server, never fetch stubs) cover: (a) both requests fired in parallel with the correct URL, `per_page=50`, and pinned headers; (b) happy path — both succeed → mapped `GithubResult[]` for users and repos; (c) one request fails → the call throws (rejects) with the typed error (full-error decision U2); (d) HTTP 403 rate-limit **with** `retry-after` header → `{ kind: 'rate-limit', retryAfterSeconds }`; (e) HTTP 403 rate-limit via `x-ratelimit-remaining: 0` + `x-ratelimit-reset` (no `retry-after`) → `retryAfterSeconds` from reset; (f) a non-403 non-2xx (e.g. 500) → `{ kind: 'http', status: 500 }`; (g) a thrown fetch → `{ kind: 'network' }`; (h) `Authorization: Bearer` header present when a token is provided (both prop and env paths) and **absent** when none is; (i) abort propagation — aborting the signal rejects with the abort, not a mapped error. (FR-18)

## Tasks / Subtasks

- [ ] Task 1 — Domain + error types (AC: 4, 6)
  - [ ] Create `src/features/github-search/types.ts` exporting the `GithubResult` union `{ kind: 'user'|'repo'; id: number|string; name: string; displayPath: string; description?: string; avatarUrl?: string; htmlUrl: string }` and the `GithubSearchError` union exactly as §3.3 defines it (`network` | `http` with `status` | `rate-limit` with `retryAfterSeconds?`). Add TSDoc to every exported member (NFR-4).
- [ ] Task 2 — Request construction (AC: 1, 2, 3)
  - [ ] Create `src/features/github-search/githubClient.ts`. Build the two URLs against the module constant base `https://api.github.com`, endpoints `/search/users` and `/search/repositories`, with `q` URL-encoded and `per_page=50`.
  - [ ] Build a shared headers object: `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28` (module constant), and conditionally `Authorization: Bearer <token>`. Resolve the token as `argToken ?? import.meta.env.VITE_GITHUB_TOKEN` (prop wins; both may be absent).
  - [ ] Fire both `fetch` calls with the **same** `signal` passed by the caller, awaited together via `Promise.all`.
- [ ] Task 3 — Response mapping + defensive validation (AC: 4, 5)
  - [ ] Map a users response item → `{ kind: 'user', id, name: login, displayPath: login, description: undefined (or bio if present), avatarUrl: avatar_url, htmlUrl: html_url }`.
  - [ ] Map a repositories response item → `{ kind: 'repo', id, name: <bare name>, displayPath: full_name, description, avatarUrl: owner.avatar_url, htmlUrl: html_url }`.
  - [ ] Validate by hand: guard `body.items` is an array; for each item verify the required fields exist and are the expected primitive types; normalize `null`/`"N/A"`-style absent values to `undefined`; drop items missing an `htmlUrl` or identity rather than throwing. Do NOT introduce Zod (see Dev Notes).
- [ ] Task 4 — Error mapping (AC: 6, 7, 8, 9)
  - [ ] In `githubClient.ts` (the single mapping place), wrap fetch/response handling: a thrown fetch that is **not** an `AbortError` → `{ kind: 'network' }`; re-throw/propagate `AbortError` untouched (AC 8).
  - [ ] For a non-OK response: if `status === 403` and (`x-ratelimit-remaining === '0'` or a `retry-after` header is present) → `{ kind: 'rate-limit', retryAfterSeconds }`; else `{ kind: 'http', status }`.
  - [ ] Derive `retryAfterSeconds`: prefer integer parse of `retry-after`; else `x-ratelimit-reset` (epoch seconds) as `Math.max(0, reset - Math.floor(Date.now()/1000))`; else `undefined`.
  - [ ] Because both fetches run under `Promise.all`, either failing rejects the whole call with the mapped error — full-error, no partial results (AC 9).
- [ ] Task 5 — Tests (AC: 10)
  - [ ] `src/features/github-search/githubClient.test.ts` using Vitest + MSW node server (handlers per case; **no fetch stubs**). Cover cases (a)–(i) from AC 10. For header assertions, inspect the intercepted request in the MSW handler. For abort, pass an already/soon-aborted `AbortController.signal` and assert the rejection is the abort, not a `GithubSearchError`.
- [ ] Task 6 — Verify (AC: all)
  - [ ] `pnpm lint && pnpm typecheck && pnpm test` all green. No new dependencies. Test-first (write `githubClient.test.ts` red before the client).

## Documentation deliverables

Part of Definition of Done (see CLAUDE.md). Create the documentation folder:
`docs/features/epic-2-github-adapter/2-1-github-api-client/`

- **README.md** — required. Document: the two endpoints + pinned headers, the token resolution order (prop → `VITE_GITHUB_TOKEN`) and the never-commit rule, the `GithubResult` mapping (bare name vs `displayPath`), the `GithubSearchError` union and the 403→`rate-limit` derivation of `retryAfterSeconds`, the by-hand validation approach (why no Zod), and what is deferred (merge/sort/cap → 2.2, rate-limit rendering → 2.3).
- **MANUAL_TESTING.md** — **skip** (network/logic layer, no UI, fully covered by MSW unit tests). State this explicitly in the README.
- **PERFORMANCE.md** — **not applicable.** The debounce/abort behavior that gives this feature its performance dimension lives in the Epic 1 hook (Story 1.1); this client is a pure request/map/error layer with no render-volume or timing dimension of its own. State the n/a decision in the README.

## Dev Notes

**Prerequisite:** Epics 0.1 and 0.2 merged (scaffold + TS strict + ESLint boundary rule; Vitest/RTL/jsdom + MSW node-server harness). This story is **independent of Epic 1** and runs in parallel with it. It is the first story in `src/features/github-search/` and establishes the adapter's data layer that 2.2 (merge/sort/cap) and 2.3 (wired component) build on. [Source: docs/planning-artifacts/epics.md#Epic 2: GitHub Adapter; #Story 2.1]

**Branch & PR:** `story/2-1-github-api-client` → `master`, squash. Conventional Commit e.g. `feat(2.1): add github api client with typed errors and optional token`. **No `Co-Authored-By` / no AI attribution.** Codex pre-PR review of the diff + security check (secrets, unsafe URL handling), green CI, record the run URL in the Dev Agent Record. [Source: CLAUDE.md#Working rules, #Story pipeline; architecture.md#3.7]

**Package manager is pnpm (NOT npm), Node 22.** Use `pnpm lint` / `pnpm typecheck` / `pnpm test`. No new dependencies for this story. [Source: CLAUDE.md#Stack; architecture.md AR-1]

**Zod is NOT in this stack — validate defensively by hand.** Unlike the reference OMDb project, this project's stack (CLAUDE.md#Stack, architecture.md AR-1) does not include Zod and forbids adding libraries beyond the mandate. Do not `pnpm add zod`. Instead, at the fetch boundary read only the fields you map, guard `items` is an array, check each required field's presence and primitive type, normalize absent values to `undefined`, and skip malformed items instead of throwing. Rationale: the mapped surface is tiny and fixed; hand validation keeps the dependency manifest clean (FR-13 spirit / SM-C1) and satisfies NFR-3 resilience. [Source: CLAUDE.md#Stack; architecture.md AR-1, §3.3; PRD NFR-3, NFR-4]

**GitHub Search API specifics (derive the mapping from this — do not invent fields):**
- Endpoints: `GET https://api.github.com/search/users?q={q}&per_page=50` and `GET https://api.github.com/search/repositories?q={q}&per_page=50`. Both return `{ total_count: number, incomplete_results: boolean, items: [...] }`. [Source: architecture.md AR-8 step 1; epics.md#Story 2.1; PRD FR-4, FR-6, §4.2]
- **Users item** fields used: `id`, `login`, `avatar_url`, `html_url` (search/users items do not include `bio`; treat `description` as `undefined` for users unless a field is available). Sort/order key is the **user login** (used in 2.2). [Source: architecture.md AR-8 step 2; PRD FR-5 / U3]
- **Repositories item** fields used: `id`, `name` (bare repo name — the sort key), `full_name` (`owner/name` — display only), `description`, `owner.avatar_url`, `html_url`. **Sort by the bare `name`, never `full_name`**, even though the UI may show `owner/name` (owner decision U3). [Source: architecture.md AR-8 step 2; PRD FR-5 / §9 U3]
- Rate limit: unauthenticated Search API is ~10 requests/minute; exhaustion returns **HTTP 403** with `x-ratelimit-remaining: 0` and/or a `retry-after` header, plus `x-ratelimit-reset` (epoch seconds). This is the most likely failure an evaluator hits — map it precisely to `rate-limit`, not `http`. [Source: architecture.md AR-9, §3.3; PRD FR-9, UJ-2; design/component-states.html state 08]

**Error union — fixed shape (copy exactly, §3.3):**
```ts
// src/features/github-search/types.ts
export type GithubSearchError =
  | { kind: 'network' }                                  // fetch threw (offline, DNS, CORS)
  | { kind: 'http'; status: number }                     // non-2xx, not a rate limit
  | { kind: 'rate-limit'; retryAfterSeconds?: number };  // 403 + rate-limit headers
```
Mapping happens in **exactly one place** (`githubClient.ts`); consuming UI (2.3) switches exhaustively on `kind` with a `never` default. `AbortError` is never mapped — cancellation is not an error. The generic lib layer only ever learns `{ status: 'error'; message }`-level information (converted in 2.3). [Source: architecture.md §3.3, AR-9, AR-3; epics.md#Story 2.1]

**Optional token / secret hygiene (FR-16, NFR-6).** Token comes from a function argument (adapter prop, plumbed by 2.3) or `import.meta.env.VITE_GITHUB_TOKEN`; sent as `Authorization: Bearer <token>` only when present. Never hardcode or commit a token; `.env.local` is gitignored and `.env.example` documents `VITE_GITHUB_TOKEN=` with no value (from Story 0.1). [Source: architecture.md AR-9; PRD FR-16, NFR-6; epics.md#Story 0.1]

**Testability (AR-12, §3.6).** MSW mocks at the network boundary — **fetch stubs are forbidden**. This client's fetch/abort/error-mapping paths must be exercised through real `fetch` intercepted by MSW so AR-9 mapping is genuinely tested. Unit level per §3.6 (response→type mapping, error mapping incl. 403→`rate-limit`). Test-first. [Source: architecture.md AR-12, §3.6; CLAUDE.md#Working rules]

**Scope boundary / what NOT to build here:**
- **No** merge/sort/cap and **no** composed `fetchSuggestions(query, signal)` — that is Story 2.2 (this story exports the two-request client + mapping only). [Source: epics.md#Story 2.2; architecture.md AR-8 steps 2–4]
- **No** UI, no `renderItem`, no rate-limit **message text** or new-tab selection — that is Story 2.3. Produce the typed error; the user-facing message mapping lives in 2.3. [Source: epics.md#Story 2.3; architecture.md §3.3]
- **No** debounce/threshold/abort *lifecycle* — that is the Epic 1 hook; this client only accepts and forwards the caller's `AbortSignal`. [Source: architecture.md AR-3]

### Project Structure Notes

- New files under **`src/features/github-search/`** (the adapter layer): `githubClient.ts`, `types.ts`, plus co-located `githubClient.test.ts`. This layer imports from `src/lib/autocomplete/` (later stories) but **`lib/` never imports from here** — the boundary rule (AR-2) is ESLint-enforced. [Source: architecture.md §3.2, AR-2; CLAUDE.md#Architecture boundary]
- Naming per §3.1: module files `camelCase.ts` (`githubClient.ts`), shared types in `types.ts`, tests co-located as `<file>.test.ts`. Prefer `type` aliases; TSDoc on the public surface. [Source: architecture.md §3.1]

### References

- [Source: docs/planning-artifacts/epics.md#Story 2.1: GitHub API client with typed errors and optional token]
- [Source: docs/planning-artifacts/epics.md#Epic 2: GitHub Adapter (FR-4, FR-5, FR-6, FR-9, FR-16; AR-8..AR-10)]
- [Source: docs/planning-artifacts/architecture.md#AR-8 GitHub adapter data flow]
- [Source: docs/planning-artifacts/architecture.md#AR-9 Error modeling — discriminated union, rate-limit variant, optional token]
- [Source: docs/planning-artifacts/architecture.md#3.3 Error-type modeling (fixed shape)]
- [Source: docs/planning-artifacts/architecture.md#3.6 Testing conventions (unit level)]
- [Source: docs/planning-artifacts/prds/prd-github-autocomplete-2026-07-09/prd.md#FR-4, FR-5, FR-6, FR-9, FR-16; §4.2; §9 Resolved Questions U2/U3; NFR-3, NFR-6]
- [Source: docs/design/component-states.html#state 08 rate limit]
- [Source: CLAUDE.md#Stack, #Architecture boundary, #Working rules]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

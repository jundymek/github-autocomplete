# 2.1 — GitHub API client with typed errors and optional token

## What was built

The data layer of the GitHub adapter: `searchGithub(query, signal, token?)` fires two parallel
requests — `GET https://api.github.com/search/users?q={q}&per_page=50` and
`GET https://api.github.com/search/repositories?q={q}&per_page=50` — via `Promise.all`, both
sharing the caller's `AbortSignal`, and returns `{ users, repos }` mapped to the slim
`GithubResult` domain shape. Every failure maps, in this one module only, to the typed
`GithubSearchError` union.

## Files touched

- `src/features/github-search/types.ts` — NEW — `GithubResult` domain shape and the
  `GithubSearchError` discriminated union (§3.3, copied exactly), TSDoc on every export.
- `src/features/github-search/githubClient.ts` — NEW — request construction, parallel fetch,
  response mapping with by-hand validation, single-place error mapping.
- `src/features/github-search/githubClient.test.ts` — NEW — 15 Vitest + MSW node-server tests
  covering AC 10 cases (a)–(i).

## Key decisions

- **Endpoints and headers.** Both requests carry `Accept: application/vnd.github+json` and a
  pinned `X-GitHub-Api-Version: 2022-11-28`; `q` is URL-encoded via `URL`/`URLSearchParams`.
- **Token resolution: argument → `VITE_GITHUB_TOKEN`.** A token passed as the function argument
  (adapter prop, plumbed in 2.3) wins over `import.meta.env.VITE_GITHUB_TOKEN`. When present it is
  sent as `Authorization: Bearer <token>`; otherwise requests are unauthenticated. No token value
  exists anywhere in the repository — `.env.local` is gitignored, `.env.example` documents the
  variable with no value.
- **`GithubResult` mapping.** For a user, `name` = `displayPath` = `login`. For a repository,
  `name` is the **bare** repo name (the 2.2 sort key, owner decision U3) while `displayPath` is
  `full_name` (`owner/name`, display only). `description`/`avatarUrl` normalize to `undefined`
  when absent; a repo's avatar comes from `owner.avatar_url`.
- **`GithubSearchError` union (§3.3).** `{ kind: 'network' }` when fetch throws;
  `{ kind: 'http'; status }` for other non-2xx; `{ kind: 'rate-limit'; retryAfterSeconds? }` for
  HTTP 403 with `x-ratelimit-remaining: 0` or a `retry-after` header. `retryAfterSeconds` prefers
  an integer parse of `retry-after`, else derives `max(0, x-ratelimit-reset − now)`, else stays
  `undefined`. A 403 **without** rate-limit headers stays `{ kind: 'http', status: 403 }`.
- **Aborts are not errors.** An `AbortError` propagates untouched — never mapped to the union.
- **Full error, never partial results.** `Promise.all` reject semantics: either request failing
  rejects the whole call with the single typed error (owner decision U2).
- **By-hand validation, no Zod.** Zod is not in this stack (AR-1 keeps the dependency manifest
  minimal, and the mapped surface is tiny and fixed). The client reads only the fields it maps,
  guards `items` being an array, type-checks each required field, and drops malformed items
  instead of throwing. An unparseable 2xx body maps to zero items rather than a failure.

## How it works

`searchGithub` builds one shared headers object, fires both fetches under `Promise.all`, and pipes
each response through `requestJson` (fetch/HTTP error mapping) and `mapItems` (defensive item
mapping). Error mapping lives only in this module; consuming UI (Story 2.3) switches exhaustively
on `kind`.

## Deferred (out of scope here)

- Merge + `localeCompare` sort + cap-to-50 and the composed `fetchSuggestions` → Story 2.2.
- Rate-limit message text, `renderItem`, new-tab selection → Story 2.3.
- Debounce/threshold/abort lifecycle → Epic 1 hook; this client only forwards the caller's signal.

## Tests

- Unit/integration (Vitest + MSW node server, no fetch stubs): parallel firing with correct URLs,
  `per_page=50` and pinned headers; happy-path mapping for users and repos; malformed-item
  skipping and `null` normalization; one-request-fails → full typed rejection; 403 + `retry-after`
  → `rate-limit` with seconds; 403 + `x-ratelimit-remaining: 0` → seconds derived from
  `x-ratelimit-reset`; plain 403 and 500 → `http`; thrown fetch → `network`; abort → rejects with
  the abort, not a mapped error; Authorization header present for argument and env tokens, absent
  without one, argument wins.
- **MANUAL_TESTING.md: intentionally skipped** — this is a network/logic layer with no UI, fully
  covered by the MSW unit tests above.
- **PERFORMANCE.md: not applicable** — the debounce/abort timing dimension lives in the Epic 1
  hook (Story 1.1); this client is a pure request/map/error layer.

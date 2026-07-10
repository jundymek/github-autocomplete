# 2.3 — `GithubAutocomplete`: wired instance with new-tab selection and rate-limit state

## What was built

The wired instance where the two layers meet: a thin `GithubAutocomplete` wrapper that renders the
generic `Autocomplete<GithubResult>` (Story 1.3) and injects the GitHub adapter's data source,
item rendering, selection, footer, and error-message overrides. Imports flow **one way** — from
`lib/`, never the reverse (AR-2). The lib stays GitHub-ignorant: only `{ status: 'error'; message }`-
level content ever crosses the boundary (NFR-5).

## Files touched

- `src/features/github-search/GithubAutocomplete.tsx` — NEW — the wrapper: props (`token?`,
  `placeholder?`, `label?`), `getItemKey`, `onSelect` (new tab), `renderItem` (design state 04),
  and the footer. Wires `messages.error = describeAutocompleteError` for the rate-limit/error
  presentation.
- `src/features/github-search/GithubAutocomplete.module.css` — NEW — GitHub-specific item chrome
  (avatar circle, `{ }` tile, mono `owner/repo` path, KIND label, accent `<mark>`). Reads the same
  `--ac-*` tokens as the lib so it themes in lockstep, without importing lib styles across AR-2.
- `src/features/github-search/describeError.ts` — NEW — pure `describeError(GithubSearchError)`
  (exhaustive `switch` + `never` default) and `describeAutocompleteError(AutocompleteError)` which
  narrows the preserved `error.cause`.
- `src/features/github-search/describeError.test.ts` — NEW — unit tests for the mapping.
- `src/features/github-search/GithubAutocomplete.test.tsx` — NEW — RTL + MSW integration tests (a–f).
- `src/features/github-search/githubClient.ts` — UPDATE — `GithubSearchResults` gains `totalCount`
  (combined API `total_count`, invalid → 0) for the footer's "Y".
- `src/features/github-search/mergeResults.ts` — UPDATE — adds `createFetchSuggestionsWithTotal`,
  which reports `(total, query)` out-of-band via a callback while keeping the AR-4 fetcher signature.
- `src/features/github-search/githubClient.test.ts`, `mergeResults.test.ts` — UPDATE — cover the new
  `totalCount` / callback behavior.
- `src/App.tsx` — UPDATE — minimal sandbox harness mounting the component (NOT part of the
  deliverable; the full demo is Story 3.1).

## Public props

```ts
type GithubAutocompleteProps = {
  token?: string       // optional GitHub PAT (FR-16); forwarded to the client to raise the
                       // rate limit. Never commit a token. Absent → unauthenticated.
  placeholder?: string // default: 'Search GitHub users and repositories…'
  label?: string       // accessible name of the combobox. default: 'Search GitHub'
}
```

Everything else (rendering, selection, error wording) is fixed by the adapter.

## `renderItem` (design state 04)

Kinds are distinguished **three ways, never color alone**:

1. **Icon shape** — users get an avatar circle (`avatarUrl` as a background image); repos get a
   `{ }` tile.
2. **Mono path** — repos append a monospace `owner/repo` (`displayPath`); users have none.
3. **KIND label** — a right-aligned `user` / `repo` column.

The current query substring is echoed inside the name via a `<mark>` in the accent color (first
case-insensitive match). The lib supplies the row grid, highlight background and accent bar; the
wrapper never re-implements highlight/focus.

## Selection — new tab (`noopener,noreferrer`)

`onSelect = (item) => window.open(item.htmlUrl, '_blank', 'noopener,noreferrer')`. Enter and click
are **identical** because both route through the lib's single selection path (Stories 1.2/1.3) — the
wrapper supplies only `onSelect`. `noopener,noreferrer` prevents reverse-tabnabbing (AR-10). The host
page keeps its state (the input still holds the query after selection).

## `GithubSearchError` → message mapping (NFR-5 isolation)

`describeError` switches exhaustively on `error.kind` with a `never` default, so adding a union
member is a compile error until handled:

| kind         | title                       | tone      | retry | body |
|--------------|-----------------------------|-----------|-------|------|
| `rate-limit` | `GitHub rate limit reached` | `warning` | no    | `Try again in Ns` (from `retryAfterSeconds`, rounded up, omitted when absent/≤0) + token hint |
| `network`    | `Search failed`             | `error`   | yes   | connection hint |
| `http`       | `Search failed`             | `error`   | yes   | `HTTP <status>` |

The mapping lives entirely in the adapter. It reaches the lib only through the documented
`messages.error` seam, which returns an `AutocompleteErrorContent` (`title`, `description`, `tone`,
`retryable`). The lib renders `tone: 'warning'` as the amber callout and hides the retry button when
`retryable: false` — **without ever learning what a rate limit is**. `describeAutocompleteError`
bridges the lib's `AutocompleteError` (whose `cause` preserves the original throw) to `describeError`;
an unrecognized `cause` falls back to a generic retryable error.

## Footer / retry

`renderFooter` shows **"X of Y · sorted A→Z"** on success — X = the displayed (capped) count, Y = the
combined API `total_count` (locale-formatted, e.g. `1,204`; clamped so Y ≥ X). Non-success states
defer to the lib's default footer. The retry affordance is the lib's built-in "Try again" button
(rendered for `network`/`http`), which re-fires the last query.

### total_count threading (assumption resolved)

The AR-4 fetcher must resolve a bare `GithubResult[]`, so the total can't ride in the return value.
`createFetchSuggestionsWithTotal(onTotal, token)` reports `(total, query)` via a callback on success
only; the wrapper stores it in state and reads it in the footer (and uses the query for the `<mark>`
echo, since the lib doesn't pass the query to `renderItem`). This was the minimal additive change
called out in the story's Dev Notes; `createFetchSuggestions`/`fetchSuggestions` are unchanged.

## Tests

- **Unit** (`describeError.test.ts`): exhaustive mapping — rate-limit tone/countdown/rounding/token
  hint/no-retry, network + http wording, retryability.
- **Unit** (`githubClient.test.ts`, `mergeResults.test.ts`): combined `totalCount` (sum, invalid → 0)
  and the `createFetchSuggestionsWithTotal` callback (fires on success, silent on failure).
- **Integration** (`GithubAutocomplete.test.tsx`, RTL + MSW node server, no fetch stubs): (a) merged
  sorted mixed list with users/repos distinguished + footer total; (b) Enter opens a new tab —
  `window.open` spy asserts exact `(htmlUrl, '_blank', 'noopener,noreferrer')`; (c) click asserts the
  same args; (d) 403 rate-limit renders the dedicated amber state (countdown + token hint, no retry);
  (e) 500 renders the generic error with a retry; (f) retry re-fires and renders results.
- **Manual**: see `MANUAL_TESTING.md` — executed against the running app; all steps pass.

## PERFORMANCE.md — n/a

The debounce/abort/render-volume performance dimension lives in the Epic 1 hook + component
(1.1, 1.3). This wrapper adds only thin rendering/selection over them, so no `PERFORMANCE.md` is
warranted.

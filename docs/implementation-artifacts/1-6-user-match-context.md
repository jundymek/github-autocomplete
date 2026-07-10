# Story 1.6: Show why a GitHub user matched — display name / bio secondary text + Organization kind

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user searching GitHub in the demo,
I want each user row to show the profile's display name (or bio) when the query didn't match the
visible login,
so that I understand **why** a result like `Beomi` appears for the query `jun` instead of it looking
like a random hit (task brief: results ordered by "repository and **profile name**"; FR-4 merged
user+repo rendering; AR-8 slim domain shape).

## Background (defect origin)

Surfaced during manual testing of the Story 3.1 demo (and confirmed by the user): typing `jun`
returns users such as `Beomi` and `bluele` whose **login has no `jun` in it**. GitHub's
`/search/users` matches on hidden profile fields — most commonly the user's **`name`** (e.g. `Beomi`
→ "Junhoo Lee") and **`bio`** — but the adapter only maps and renders the `login`, so the match
looks arbitrary. Users pasted next to repositories (both sorted A→Z) then read as noise.

Two concrete gaps in the GitHub adapter (`src/features/github-search/`), both in the **feature layer**
(not the reusable `lib/`, which is correctly data-source-agnostic):

1. `mapUserItem` maps only `id`, `login`, `html_url`, `avatar_url` — it **discards** the `name` and
   `bio` fields that `/search/users` already returns (no extra request needed). So the row can never
   show the text the query actually matched.
2. `type` is discarded, so **organizations render as `user`** in the KIND column even though the API
   distinguishes `type: "User"` vs `type: "Organization"`.

[Source: src/features/github-search/githubClient.ts (`mapUserItem`); src/features/github-search/types.ts (`GithubResult`); src/features/github-search/GithubAutocomplete.tsx (`renderGithubItem`); docs/task.md (ordering by "profile name"); docs/design/component-states.html (state 04 row anatomy); observed in the 3.1 demo]

## Acceptance Criteria

1. **User rows show a display name / bio when available (why-it-matched context).** When a
   `/search/users` item has a non-empty `name`, the user row renders it as secondary text next to the
   login. When `name` is absent/empty but `bio` is present, the `bio` is shown instead. When both are
   absent/empty, the row is unchanged from today (login only). No layout regression for repo rows.
2. **No new network request — data comes from the existing search response.** The `name`/`bio` values
   are read from the fields `/search/users` already returns in the merged search. **No** additional
   `GET /users/{login}` (or any other) request is made — the unauthenticated rate limit is not
   further consumed (consistent with Story 1.5's no-refetch principle).
3. **Organizations are labeled as such.** When a search item's `type` is `"Organization"`, the KIND
   column reads `org` (not `user`); `type: "User"` (or a missing/other type) still reads `user`. The
   avatar/icon treatment is unchanged (organizations keep the avatar-circle, like users).
4. **The query match is still echoed, and now also in the secondary text.** The existing `<mark>`
   accent highlight on the login stays. When the match is actually in the `name`/`bio` (not the
   login), that secondary text also echoes the matched substring via the same `highlightMatch`
   helper, so the user can see the matched characters wherever they are.
5. **Robust, safe mapping (no injection, no crashes on odd payloads).** `name`/`bio`/`type` are read
   defensively (unknown-shaped payloads already flow through `isRecord`/`optionalString` guards):
   non-string or missing values normalize to `undefined`, and an item still maps successfully on the
   existing required fields (`id`, `login`, `html_url`). The values are rendered as **text** (React
   auto-escaping); no `dangerouslySetInnerHTML`, and any value used in a CSS/URL context stays behind
   the existing `cssUrl` escaping. Overly long secondary text is visually truncated (ellipsis), not
   allowed to break the row layout.
6. **Boundary respected — feature layer only, lib untouched.** All changes live in
   `src/features/github-search/`. The reusable `src/lib/autocomplete/` gets **no** GitHub knowledge:
   the extra text is carried on the adapter's own `GithubResult` shape and rendered by the adapter's
   `renderItem`, exactly like the existing repo `displayPath`/`description`. The `no-restricted-imports`
   boundary (Story 0.1) stays green; no new runtime dependency.
7. **Tests prove all of the above (FR-18).** Unit tests for `mapUserItem` assert `name`→secondary,
   `bio` fallback, both-absent→login-only, and `type: "Organization"`→`kind`/label mapping, plus that
   a missing/`null` `name`/`bio`/`type` does not break mapping. Adapter render tests
   (`GithubAutocomplete.test.tsx`) assert a user row shows the display name, an org row shows `org`,
   and the secondary text highlights the matched substring when the login did not match. Existing
   merge/sort, selection (new-tab), and repo-row tests continue to pass unchanged (sorting still keys
   off the bare `name`/login — the added secondary text must **not** change the sort key).

## Tasks / Subtasks

- [ ] Task 1 — Extend the domain shape (AC: 1, 3, 6)
  - [ ] In `src/features/github-search/types.ts`, add optional fields to `GithubResult`:
        `secondaryText?: string` (the user display name or bio; the adapter's "why it matched" line)
        and widen the kind/label story for organizations. Prefer a minimal, generic shape: either add
        an `isOrganization?: boolean` flag or extend `kind` — choose the option that keeps the sort
        key and existing `getItemKey` (`${kind}:${id}`) stable and documented. Do **not** change
        `name` (the sort key) or `displayPath` semantics. Document each new field.
- [ ] Task 2 — Map the new fields from the search response (AC: 1, 2, 3, 5)
  - [ ] In `src/features/github-search/githubClient.ts` `mapUserItem`, read `name`, `bio`, and `type`
        from the (already-fetched) item. Set `secondaryText` to `optionalString(name)` and, when that
        is `undefined`, fall back to `optionalString(bio)`. Map `type === 'Organization'` to the
        org label/flag chosen in Task 1. Keep the required-field guard (`id`, `login`, `html_url`)
        unchanged — a missing `name`/`bio`/`type` must never drop the item. **No** new request.
  - [ ] Confirm `mapRepoItem` is untouched (repos already carry `description`/`displayPath`); the sort
        key (`name`) and merge/cap behavior in `mergeResults.ts` are unchanged.
- [ ] Task 3 — Render the secondary text + org label (AC: 1, 3, 4, 5)
  - [ ] In `src/features/github-search/GithubAutocomplete.tsx` `renderGithubItem`, render
        `item.secondaryText` for user rows in the same secondary slot the design uses for a repo's
        description/`ac-meta` (visual parity with repo rows; see design state 04). Echo the matched
        substring in it via the existing `highlightMatch(item.secondaryText, query)`.
  - [ ] Render the KIND column as `org` when the item is an organization, else `user`/`repo` as today.
  - [ ] Add/adjust the CSS in `GithubAutocomplete.module.css` so long secondary text truncates with
        ellipsis and the row height/layout is unchanged; users without secondary text look exactly as
        before. Kinds must still be distinguishable without color (icon + label), per design.
- [ ] Task 4 — Tests (AC: 7)
  - [ ] Extend `src/features/github-search/githubClient.test.ts`: `name` present → `secondaryText`;
        `name` empty/null + `bio` present → `bio`; both absent → `secondaryText` undefined; `type:
        "Organization"` → org mapping; malformed/missing fields still map on required fields.
  - [ ] Extend `src/features/github-search/GithubAutocomplete.test.tsx`: a user row renders the
        display name; an org row shows the `org` KIND label; when the login does not contain the query
        but the name does, the highlighted match appears in the secondary text; repo rows and the
        A→Z sort/merge are unchanged.
- [ ] Task 5 — Docs
  - [ ] Ship the story's own doc folder per CLAUDE.md:
        `docs/features/epic-2-github-adapter/1-6-user-match-context/` with `README.md` (what changed,
        why — the `jun`→Beomi case — and the "no extra request, read fields already in the search
        response" decision) and `MANUAL_TESTING.md` (type `jun` → user rows now show the display
        name/bio so the match is visible; organizations read `org`).
  - [ ] If a Story 2.x GitHub-adapter feature README documents the user-row anatomy, add a note there
        pointing to this enhancement.
- [ ] Task 6 — Verify (AC: all)
  - [ ] `pnpm lint && pnpm typecheck && pnpm test` all green (+ `pnpm test:e2e` if present). Manually
        verify in `pnpm dev` on the 3.1 demo: type `jun` → user rows show a display name/bio revealing
        the match; confirm the Network panel shows **no** extra per-user requests; organizations read
        `org`; repos look unchanged.

## Dev Notes

**Why this is a feature-layer story (boundary).** The reusable `lib/autocomplete/` is deliberately
data-source-agnostic — it renders whatever `renderItem` returns and sorts by the injected key. All
GitHub specifics (which fields exist, how a user row looks, what "org" means) belong in
`src/features/github-search/`. This story therefore touches **only** the feature layer; `lib/` stays
untouched and the `no-restricted-imports` boundary rule stays green.
[Source: CLAUDE.md#Architecture boundary; docs/planning-artifacts/architecture.md#AR-4/#AR-8]

**The data is already in the response (AC 2, critical).** `/search/users` items include `name`,
`bio`, and `type` directly — they are simply discarded by `mapUserItem` today (which destructures
only `id, login, html_url, avatar_url`). Reading them adds **zero** requests. Do **not** add a
`GET /users/{login}` enrichment pass: 50 results would mean ~51 requests per search and blow the
unauthenticated 60/hour limit — the opposite of Story 1.5's intent.
[Source: src/features/github-search/githubClient.ts (`mapUserItem`); GitHub REST "Search users" —
each item carries `name`/`bio`/`type` (nullable); docs/implementation-artifacts/1-5-reopen-on-focus.md]

**Exact seam (read before coding).**
- `GithubResult` (`types.ts`) is the slim shape; add optional field(s) here. Keep `name` = the sort
  key (login for users / bare repo name) — do **not** repurpose it for the display name; the display
  name goes in a **new** field so sorting is unchanged. [Source: src/features/github-search/types.ts]
- `mapUserItem` (`githubClient.ts`) already uses `isRecord`, `isId`, `optionalString` guards — reuse
  them for the new fields. Required-field guard stays (`id`, `login`, `html_url`). Normalize empty
  strings to `undefined` like the repo `description`. [Source: src/features/github-search/githubClient.ts]
- `renderGithubItem` (`GithubAutocomplete.tsx`) already renders a secondary line for repos
  (`displayPath` in the mono style) and has `highlightMatch`/`cssUrl` helpers. Render the user's
  `secondaryText` in the analogous slot and reuse `highlightMatch`. Values are rendered as React text
  (auto-escaped); keep `cssUrl` on any URL used in `background-image`. [Source: src/features/github-search/GithubAutocomplete.tsx]
- The design's state 04 shows repos with an `ac-meta` description line and users without one — that
  was only because the sample query (`react`) matched the login. Adding a user secondary line for the
  by-name/bio case is a deliberate, minimal extension of that anatomy, not a redesign. Keep kinds
  distinguishable without color (icon + KIND label). [Source: docs/design/component-states.html#04]

**Scope guard — do only this.** Show name/bio secondary text and label organizations. Do **not** add
stars/followers, extra API calls, profile enrichment, re-sorting by name, or any `lib/` change. The
sort key stays the bare `name`/login. [Source: CLAUDE.md#Architecture boundary; docs/task.md]

**Security (AC 5).** `name`/`bio` are attacker-influenceable strings (any GitHub user controls their
own profile). Render them as **text** only — never `dangerouslySetInnerHTML`, never into an `href`
without the existing new-tab `noopener,noreferrer` handling, and keep `cssUrl` escaping on avatar
URLs. `highlightMatch` slices strings and wraps in `<mark>` (safe). [Source: src/features/github-search/GithubAutocomplete.tsx (`renderGithubItem`, `cssUrl`, `onSelect` new-tab)]

**No new runtime dependency (AR-1).** Mapping + rendering only. [Source: CLAUDE.md#Stack]

**Branch & PR.** `story/1-6-user-match-context` → `master`, squash. Commit e.g.
`feat(1.6): show GitHub user display name/bio and org kind so matches are legible`. **No AI
attribution / no `Co-Authored-By`.** Run the mandatory pre-PR review gate (security review +
codex-rescue second-pass + verified triage), re-run `pnpm lint && pnpm typecheck && pnpm test` after
any fix, then PR. [Source: CLAUDE.md#Working rules / #Story pipeline]

### Project Structure Notes

- Files this story touches (all in the feature layer):
  - `src/features/github-search/types.ts` — UPDATE (add `secondaryText?` and org kind/flag to `GithubResult`).
  - `src/features/github-search/githubClient.ts` — UPDATE (`mapUserItem`: map `name`/`bio`/`type`).
  - `src/features/github-search/GithubAutocomplete.tsx` — UPDATE (`renderGithubItem`: secondary text + org label).
  - `src/features/github-search/GithubAutocomplete.module.css` — UPDATE (secondary-text style + ellipsis truncation).
  - `src/features/github-search/githubClient.test.ts` — UPDATE — mapping unit tests.
  - `src/features/github-search/GithubAutocomplete.test.tsx` — UPDATE — render tests.
  - Docs: add `docs/features/epic-2-github-adapter/1-6-user-match-context/{README.md,MANUAL_TESTING.md}`.
- `mergeResults.ts` and the `lib/` layer are **not** touched. Tests are co-located `*.test.ts(x)`
  (Vitest + RTL; MSW is used at the client layer per Epic 2).
  [Source: docs/planning-artifacts/architecture.md#AR-8; docs/implementation-artifacts/2-3-github-autocomplete.md]

### References

- [Source: docs/task.md — brief: results ordered by "repository and profile name"; user+repo autocomplete]
- [Source: src/features/github-search/githubClient.ts — `mapUserItem` (discards name/bio/type), `optionalString`, `isRecord`, `isId`]
- [Source: src/features/github-search/types.ts — `GithubResult` slim domain shape]
- [Source: src/features/github-search/GithubAutocomplete.tsx — `renderGithubItem`, `highlightMatch`, `cssUrl`, new-tab `onSelect`]
- [Source: src/features/github-search/mergeResults.ts — merge/sort/cap (sort key = bare name/login; unchanged)]
- [Source: docs/design/component-states.html#04 — merged user+repo row anatomy; kinds distinguished without color]
- [Source: docs/implementation-artifacts/2-1-github-api-client.md / 2-2-merge-sort-results.md / 2-3-github-autocomplete.md — Epic 2 adapter]
- [Source: docs/implementation-artifacts/1-5-reopen-on-focus.md — no-extra-request principle (rate limits)]
- [Source: CLAUDE.md#Architecture boundary / #Working rules / #Story pipeline / #Documentation deliverables]
- [Source: GitHub REST API — "Search users": each item carries nullable `name`, `bio`, `type` without a follow-up request]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-10 | 0.1 | Story drafted as a follow-up: GitHub user rows now reveal the matched profile name/bio (read from the existing search response, no extra request) and label organizations, so results like `jun`→Beomi are legible. Found during Story 3.1 demo manual testing. | Łukasz (via BMAD create-story) |

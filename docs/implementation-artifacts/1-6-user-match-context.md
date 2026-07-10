---
baseline_commit: de9787d2a922469c5e5fdf43afd044ce287d7427
---

# Story 1.6: Make GitHub user matches legible — "matches profile" hint + Organization kind

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user searching GitHub in the demo,
I want a user row to tell me when it matched my query on a hidden profile field (not the visible
login), and to distinguish organizations from people,
so that a result like `beomi` appearing for `jun` reads as intentional (it matched the profile name
"Junbum Lee / Beomi") rather than as noise (task brief: reusable, self-contained component; FR-4
merged user+repo rendering; AR-8 slim domain shape).

## Background (defect origin + API reality)

Surfaced during manual testing of the Story 3.1 demo (and confirmed by the user): typing `jun`
returns users such as `beomi` whose **login has no `jun` in it**. GitHub matches on hidden profile
fields (display `name`, `bio`), but the adapter renders only the `login`, so the match looks
arbitrary next to repositories in the merged A→Z list.

**Critical API finding (verified live, do not re-litigate).** The public REST
`GET /search/users` response **does not include** `name` or `bio` at all — the field is *absent*
(`'name' in item === false`), not merely `null`, even for well-known accounts. Those fields exist
only on the full `GET /users/{login}` profile, and the equivalent one-shot alternative (GraphQL
`search(type: USER)`) **requires a token even to read**. This project is unauthenticated by default
(CLAUDE.md), so fetching the actual name/bio for every result is off the table: `N × /users/{login}`
would blow the 60/hour unauthenticated limit (the opposite of Story 1.5's intent), and GraphQL would
force a token and a second, divergent client — breaking the thin-adapter/reusable-component design
the brief prizes. `type` (`"User" | "Organization"`), however, **is** present in the search response.
[Source: verified via direct `curl https://api.github.com/search/users?q=…` — items expose
`login,id,avatar_url,html_url,type,score,…` but no `name`/`bio`; GraphQL user search returns 401/rate-limit
without a token; docs/task.md (reusable component); CLAUDE.md#Stack (unauthenticated by default)]

**So this story does what is achievable with the data we actually have, at zero extra request cost:**

1. **"Matches profile" hint.** We cannot show *what* matched, but we know *whether* the visible login
   contains the query. When it does **not**, the match must be in a hidden profile field, so the row
   shows a short, muted "matches profile" line — turning an apparently-random hit into an
   explained one. When the login *does* contain the query (the existing `<mark>` highlight already
   shows it), no hint is shown.
2. **Organization kind.** `type` is discarded today, so **organizations render as `user`**. Map it so
   organizations read `org` in the KIND column.

Both are pure feature-layer changes reading fields already in the response — no extra request, no
token, no `lib/` change. (A future story could add real name/bio behind an opt-in token + GraphQL
path; explicitly out of scope here.)
[Source: src/features/github-search/githubClient.ts (`mapUserItem` discards `type`); src/features/github-search/types.ts (`GithubResult`); src/features/github-search/GithubAutocomplete.tsx (`renderGithubItem`, `highlightMatch`); docs/design/component-states.html (state 04 row anatomy); observed in the 3.1 demo]

## Acceptance Criteria

1. **"Matches profile" hint when the login did not match the query.** For a **user/org** row, when the
   current query is non-empty and the visible `login` does **not** contain it (case-insensitive), the
   row renders a short, muted secondary line reading **"matches profile"** (or equivalent copy),
   signalling the match is on a hidden profile field. When the login **does** contain the query (the
   existing `<mark>` highlight is visible), **no** hint is shown. Repo rows are unaffected.
2. **Zero new network request (data already in the response).** The hint is derived purely from the
   already-fetched `login` + the current query; the org flag from the item's `type`. **No** additional
   request of any kind is made (no `GET /users/{login}`, no GraphQL) — consistent with Story 1.5's
   no-extra-request principle and the unauthenticated-by-default stance.
3. **Organizations are labeled as such.** When a search item's `type` is `"Organization"`, the KIND
   column reads `org` (not `user`); `type: "User"`, a missing type, or any other value still reads
   `user`. The avatar/icon treatment is unchanged (organizations keep the avatar-circle, like users).
4. **The query echo on the login is unchanged.** The existing `<mark>` accent highlight on the login
   (when the query is a substring of it) stays exactly as today. The "matches profile" hint is
   mutually exclusive with a visible login highlight (hint only appears precisely when the login does
   *not* contain the query).
5. **Robust, safe mapping/render (no injection, no crashes on odd payloads).** `type` is read
   defensively (unknown-shaped payloads already flow through `isRecord`); a missing/odd `type`
   defaults to non-organization, and an item still maps on the existing required fields (`id`,
   `login`, `html_url`). The hint is static, adapter-owned copy rendered as **text** (React
   auto-escaping); no `dangerouslySetInnerHTML`, and any value used in a CSS/URL context stays behind
   the existing `cssUrl` escaping. The hint line must not break the row layout (single line, muted).
6. **Boundary respected — feature layer only, lib untouched.** All changes live in
   `src/features/github-search/`. The reusable `src/lib/autocomplete/` gets **no** GitHub knowledge:
   the org flag is carried on the adapter's own `GithubResult` shape and the hint is computed and
   rendered by the adapter's `renderItem`. The `no-restricted-imports` boundary (Story 0.1) stays
   green; no new runtime dependency; the sort key (bare `name`/login) is unchanged.
7. **Tests prove all of the above (FR-18).** Unit tests for `mapUserItem` assert
   `type: "Organization"` → org flag, and `"User"`/missing/other → not-org, without dropping the item
   on missing fields. Adapter render tests (`GithubAutocomplete.test.tsx`) assert: a user whose login
   does not contain the query shows the "matches profile" hint; a user whose login *does* contain the
   query shows **no** hint (only the `<mark>`); an org row reads `org`. Existing merge/sort, selection
   (new-tab), repo-row, and rate-limit tests continue to pass unchanged (the hint/flag must not change
   the sort key).

## Tasks / Subtasks

- [x] Task 1 — Extend the domain shape (AC: 3, 6)
  - [x] In `src/features/github-search/types.ts`, add an optional `isOrganization?: boolean` to
        `GithubResult` (chosen over extending `kind` so `getItemKey` = `${kind}:${id}` and the sort
        key stay stable). Do **not** add a name/bio field — the search response does not carry it (see
        Background). Do **not** change `name`/`displayPath` semantics. Document the field.
- [x] Task 2 — Map `type` from the search response (AC: 2, 3, 5)
  - [x] In `src/features/github-search/githubClient.ts` `mapUserItem`, read `type` from the
        already-fetched item and set `isOrganization: type === 'Organization'`. Keep the required-field
        guard (`id`, `login`, `html_url`) unchanged — a missing/odd `type` defaults to `false` and
        never drops the item. **No** new request. Set `isOrganization: false` on repo items for shape
        consistency; leave `mapRepoItem` otherwise untouched.
  - [x] Confirm the sort key (`name`) and merge/cap behavior in `mergeResults.ts` are unchanged.
- [x] Task 3 — Render the "matches profile" hint + org label (AC: 1, 3, 4, 5)
  - [x] In `src/features/github-search/GithubAutocomplete.tsx` `renderGithubItem`, for **user/org**
        rows compute `loginMatches = item.name.toLowerCase().includes(query.trim().toLowerCase())`
        (guard empty query → no hint). When the query is non-empty and `loginMatches` is false, render
        a short, muted secondary line "matches profile" in the same secondary slot the design uses for
        a repo's path/description (visual parity). When `loginMatches` is true, render no hint (the
        `<mark>` on the login already shows it). Keep the copy as a single adapter-owned constant.
  - [x] Render the KIND column as `org` when `item.isOrganization`, else `user`/`repo` as today.
  - [x] Add CSS in `GithubAutocomplete.module.css` for the hint line (muted, single line, ellipsis if
        needed) so the row height/layout is unchanged and rows without a hint look exactly as before.
        Kinds must still be distinguishable without color (icon + label), per design.
- [x] Task 4 — Tests (AC: 7)
  - [x] Extend `src/features/github-search/githubClient.test.ts`: `type: "Organization"` → org flag;
        `"User"`/missing/other → not org; malformed/missing fields still map on required fields.
  - [x] Extend `src/features/github-search/GithubAutocomplete.test.tsx`: a user whose login does NOT
        contain the query shows the "matches profile" hint; a user whose login DOES contain it shows
        no hint (only the `<mark>`); an org row shows the `org` KIND label; repo rows and the A→Z
        sort/merge are unchanged.
- [x] Task 5 — Docs
  - [x] Ship the story's own doc folder per CLAUDE.md:
        `docs/features/epic-2-github-adapter/1-6-user-match-context/` with `README.md` (what changed,
        why — the `jun`→Beomi case — and the "no extra request, read fields already in the search
        response" decision) and `MANUAL_TESTING.md` (type `jun` → user rows now show the display
        name/bio so the match is visible; organizations read `org`).
  - [x] If a Story 2.x GitHub-adapter feature README documents the user-row anatomy, add a note there
        pointing to this enhancement.
- [x] Task 6 — Verify (AC: all)
  - [x] `pnpm lint && pnpm typecheck && pnpm test` all green (+ `pnpm test:e2e` if present). Manually
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
- [Source: GitHub REST "Search users" — verified live: items carry `type` but NOT `name`/`bio`; those need `/users/{login}` or token-gated GraphQL]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context)

### Debug Log References

- Full suite green: `pnpm lint && pnpm typecheck && pnpm test` → 15 files / 205 tests passed; `pnpm test:e2e` → 1 passed. `github-search` feature suite: 4 files / 60 tests.
- **Key mid-implementation finding.** The original spec assumed `/search/users` returns `name`/`bio`.
  Direct `curl` against the live API disproved this: those fields are *absent* from search items
  (`'name' in item === false`), even for well-known accounts — they exist only on `/users/{login}`,
  and the one-shot GraphQL alternative needs a token. The spec (and this story) were re-scoped to what
  the response actually carries: `type` (org label) plus a login-vs-query "matches profile" hint. Zero
  extra requests, no token, no `lib/` change.
- Browser-verified against the live API: `jun` → 8 user rows show "matches profile" (incl. `Beomi`),
  1 user matched via login (`<mark>`, no hint), and exactly 2 `/search/*` requests fire (no per-user
  requests). `react` → 11 rows correctly labeled `org`, 2 `user`, 37 `repo`.

### Completion Notes List

- Delivered the achievable, zero-request half: a muted "matches profile" hint when the query is not a
  substring of the visible login, and an `org` KIND label from the item's `type`. Real name/bio was
  found impossible without a token (documented as out of scope; a future story could add it behind an
  opt-in token + GraphQL path).
- `isOrganization?: boolean` added to `GithubResult` (chosen over extending `kind` to keep
  `getItemKey`/sort key stable). Hint is computed in the adapter's `renderItem` from `login` vs the
  current query — no profile data needed. All changes are feature-layer; `lib/` untouched;
  `no-restricted-imports` boundary green.
- Safety: hint is a static adapter-owned constant rendered as text; `type` read defensively (missing/
  odd → not org); required-field guard on user items unchanged.

### File List

- `src/features/github-search/types.ts` — UPDATE — `isOrganization?: boolean` on `GithubResult`.
- `src/features/github-search/githubClient.ts` — UPDATE — `mapUserItem` maps `type` → `isOrganization`; `mapRepoItem` sets it `false`.
- `src/features/github-search/GithubAutocomplete.tsx` — UPDATE — "matches profile" hint + `org` label in `renderGithubItem`.
- `src/features/github-search/GithubAutocomplete.module.css` — UPDATE — `.secondary` hint style.
- `src/features/github-search/githubClient.test.ts` — UPDATE — org-flag mapping tests.
- `src/features/github-search/GithubAutocomplete.test.tsx` — UPDATE — hint / no-hint / org-label render tests.
- `docs/features/epic-2-github-adapter/1-6-user-match-context/README.md` — NEW — story docs.
- `docs/features/epic-2-github-adapter/1-6-user-match-context/MANUAL_TESTING.md` — NEW — story manual testing.
- `docs/implementation-artifacts/1-6-user-match-context.md` — UPDATE — baseline_commit, re-scope, task checkboxes, Dev Agent Record, status.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-10 | 0.1 | Story drafted as a follow-up: reveal the matched profile name/bio + label organizations, so results like `jun`→Beomi are legible. | Łukasz (via BMAD create-story) |
| 2026-07-10 | 0.2 | Re-scoped after a live-API finding: `/search/users` does not return `name`/`bio` (absent, not null); real name/bio needs a token. Story now delivers the zero-request achievable set — a "matches profile" hint (login-vs-query) + org label from `type`. | Amelia (Dev) |
| 2026-07-10 | 1.0 | Implemented org label + "matches profile" hint; tests + docs; all checks green; browser-verified on the live API. | Amelia (Dev) |

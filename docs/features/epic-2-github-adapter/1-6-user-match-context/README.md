# 1.6 — Make GitHub user matches legible: "matches profile" hint + Organization kind

## What was built

Follow-up found during 3.1 demo testing: typing `jun` returns users like `Beomi` whose **login has
no `jun` in it**, so the hit looks random next to repositories. Two feature-layer improvements, both
at **zero extra request cost**:

1. **"matches profile" hint** — when the query is not a substring of the visible `login`, the user
   row shows a short muted line **"matches profile"**, signalling the match is on a hidden profile
   field. When the login *does* contain the query, the existing `<mark>` highlight already shows it,
   so no hint appears.
2. **Organization kind** — GitHub items carry a `type` (`"User" | "Organization"`) that the adapter
   used to discard; organizations now read `org` in the KIND column instead of `user`.

## The API reality that shaped this (important)

The original idea was to show the profile **display name / bio** (e.g. `Beomi` → "Junbum Lee"). That
turned out to be impossible in this project's constraints, verified live:

- The public `GET /search/users` response **does not include `name` or `bio`** — the field is
  *absent* (`'name' in item === false`), not `null`, even for well-known accounts. Those fields exist
  only on the full `GET /users/{login}` profile.
- Fetching them per result (`N × /users/{login}`) would blow the unauthenticated 60/hour rate limit —
  the opposite of Story 1.5's no-extra-request principle.
- The one-shot alternative, GraphQL `search(type: USER)`, **requires a token even to read** and would
  force a second, divergent client — breaking the thin-adapter / reusable-component design the brief
  prizes.

Since the project is **unauthenticated by default**, real name/bio is out of scope here. What we
*can* do with the data already in the response: tell the user *that* the match is on the profile
(hint), and label organizations (`type`). A future story could add real name/bio behind an opt-in
token + GraphQL path.

## Files touched

- `src/features/github-search/types.ts` — UPDATE — added `isOrganization?: boolean` to `GithubResult`.
- `src/features/github-search/githubClient.ts` — UPDATE — `mapUserItem` maps `type` →
  `isOrganization`; `mapRepoItem` sets `isOrganization: false`. No name/bio (not in the response).
- `src/features/github-search/GithubAutocomplete.tsx` — UPDATE — `renderGithubItem` computes the
  login-vs-query match and renders the "matches profile" hint; KIND label reads `org` for orgs.
- `src/features/github-search/GithubAutocomplete.module.css` — UPDATE — `.secondary` style for the
  muted, single-line, ellipsis hint.
- `src/features/github-search/githubClient.test.ts` / `GithubAutocomplete.test.tsx` — UPDATE — tests.

## Key decisions

- **Hint derived from login-vs-query, not from profile data.** We can't show *what* matched, but we
  know *whether* the visible login contains the query. If it doesn't, the match is elsewhere → hint.
  Zero requests, no token.
- **`isOrganization?: boolean` over extending `kind`.** Keeps `getItemKey` (`${kind}:${id}`) and the
  A→Z sort key (bare `name`/login) stable; orgs are still avatar-circle user-shaped items, just
  labeled differently.
- **Feature layer only.** `src/lib/autocomplete/` gets no GitHub knowledge; the flag rides the
  adapter's `GithubResult` and the hint is computed in the adapter's `renderItem`.
- **Hint is mutually exclusive with a login highlight.** It appears precisely when the login does not
  contain the query, so it never competes with the `<mark>`.

## Tests

- Unit (`githubClient.test.ts`): `type: "Organization"` → `isOrganization: true`; `"User"`/missing/
  other → `false`; items still map on required fields when `type` is absent.
- Render (`GithubAutocomplete.test.tsx`): login without the query → "matches profile" hint shown;
  login containing the query → no hint (only the `<mark>`); org row reads `org`. Repo rows,
  merge/sort, selection, and rate-limit tests unchanged.
- Manual: see [MANUAL_TESTING.md](./MANUAL_TESTING.md). Browser-verified against the live API: `jun`
  → 8 user rows show "matches profile" (incl. `Beomi`), 1 matched via login (`<mark>`, no hint), with
  **no extra requests**; `react` → 11 rows correctly labeled `org`.

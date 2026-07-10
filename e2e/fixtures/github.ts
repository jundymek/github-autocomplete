/**
 * Deterministic GitHub Search API fixtures for the e2e layer (AR-12).
 *
 * These are the ONLY response bodies the browser ever sees for
 * `api.github.com` — `e2e/helpers/mockGithub.ts` fulfils `page.route` with them,
 * so the real API is never called and CI stays rate-limit-proof and stable.
 *
 * The shapes mirror the real endpoints' relevant fields only (the client maps
 * defensively and ignores the rest). User items intentionally carry `type`,
 * `name`, and `bio` (Story 1.6 fixture requirement): `type` drives the `org`
 * KIND label, and at least one user matches the query on a profile field (its
 * `name`) but NOT on its `login`, so the adapter's "matches profile" hint is
 * exercised. Note the shipped client maps a user's rendered `name` from its
 * `login` (the search API does not return the profile name/bio), so the `name`/
 * `bio` here document the match reason; the hint fires from the login/query
 * mismatch, which these logins are chosen to produce.
 */

const QUERY = 'react'

/** The ≥3-char query every spec types to trigger a search against these fixtures. */
export const SMALL_QUERY = QUERY

// --- Small result set -----------------------------------------------------
//
// Chosen so the merged A→Z order (case-insensitive, by `name` = login for
// users / bare repo name for repos; repo before user on a tie) is fully
// predictable. Logins/names below sort to EXPECTED_SORTED_NAMES.

type UserFixture = {
  id: number
  login: string
  html_url: string
  avatar_url: string
  type: 'User' | 'Organization'
  /** Profile display name (documents the 1.6 match reason; see module note). */
  name: string
  /** Profile bio (documents the 1.6 match reason; see module note). */
  bio: string
}

type RepoFixture = {
  id: number
  name: string
  full_name: string
  html_url: string
  description: string
  owner: { avatar_url: string }
}

const USERS: UserFixture[] = [
  // Login does NOT contain "react" → matches on profile `name` → "matches
  // profile" hint must render, and this row sorts by its login "gaearon".
  {
    id: 1,
    login: 'gaearon',
    html_url: 'https://github.com/gaearon',
    avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
    type: 'User',
    name: 'React Maintainer',
    bio: 'Works on React.',
  },
  // Organization → KIND column reads "org" (not "user"). Login contains the
  // query, so it also highlights via <mark>.
  {
    id: 2,
    login: 'reactjs',
    html_url: 'https://github.com/reactjs',
    avatar_url: 'https://avatars.githubusercontent.com/u/2?v=4',
    type: 'Organization',
    name: 'React',
    bio: 'The React organization.',
  },
]

const REPOS: RepoFixture[] = [
  {
    id: 101,
    name: 'react',
    full_name: 'facebook/react',
    html_url: 'https://github.com/facebook/react',
    description: 'The library for web and native user interfaces.',
    owner: { avatar_url: 'https://avatars.githubusercontent.com/u/69631?v=4' },
  },
  {
    id: 102,
    name: 'react-router',
    full_name: 'remix-run/react-router',
    html_url: 'https://github.com/remix-run/react-router',
    description: 'Declarative routing for React.',
    owner: { avatar_url: 'https://avatars.githubusercontent.com/u/64235328?v=4' },
  },
]

export const smallUsersResponse = { total_count: USERS.length, incomplete_results: false, items: USERS }
export const smallReposResponse = { total_count: REPOS.length, incomplete_results: false, items: REPOS }

/**
 * The rendered option order the adapter must produce for {@link SMALL_QUERY},
 * by `name` (login / bare repo name), case-insensitive, repo-before-user on a
 * tie. Order: gaearon (user), react (repo), react-router (repo), reactjs (org).
 */
export const EXPECTED_SORTED_NAMES = ['gaearon', 'react', 'react-router', 'reactjs'] as const

/** The org row's login → its KIND column must read `org`. */
export const ORG_LOGIN = 'reactjs'

/** The user matching only via profile → its row shows the "matches profile" hint. */
export const PROFILE_MATCH_LOGIN = 'gaearon'
export const MATCHES_PROFILE_HINT = 'matches profile'

/** `html_url` of the item highlighted by ArrowDown×2 then Enter (2nd option). */
export const SECOND_OPTION_URL = 'https://github.com/facebook/react'
/** `html_url` of the first option (used for the mouse-click case). */
export const FIRST_OPTION_URL = 'https://github.com/gaearon'

// --- Large result set (cap + scroll, AC 6) --------------------------------
//
// 50 users + 50 repos. The adapter caps the merged list at MAX_RESULTS (50),
// so the dropdown is height-bounded and internally scrollable.

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

const BIG_USERS: UserFixture[] = Array.from({ length: 50 }, (_, i) => {
  const login = `react-user-${pad(i)}`
  return {
    id: 1000 + i,
    login,
    html_url: `https://github.com/${login}`,
    avatar_url: `https://avatars.githubusercontent.com/u/${1000 + i}?v=4`,
    type: 'User' as const,
    name: `React User ${pad(i)}`,
    bio: 'Bulk fixture user.',
  }
})

const BIG_REPOS: RepoFixture[] = Array.from({ length: 50 }, (_, i) => {
  const name = `react-repo-${pad(i)}`
  return {
    id: 2000 + i,
    name,
    full_name: `bulk-org/${name}`,
    html_url: `https://github.com/bulk-org/${name}`,
    description: 'Bulk fixture repository.',
    owner: { avatar_url: `https://avatars.githubusercontent.com/u/${2000 + i}?v=4` },
  }
})

// total_count reports the true (uncapped) API totals so the footer can render
// "X of Y" with Y > X.
export const bigUsersResponse = { total_count: 400, incomplete_results: false, items: BIG_USERS }
export const bigReposResponse = { total_count: 400, incomplete_results: false, items: BIG_REPOS }

// --- Rate-limit (403) response (AC 4) -------------------------------------
//
// A 403 carrying rate-limit headers so the client maps it to
// `{ kind: 'rate-limit', retryAfterSeconds }`, rendered as the dedicated amber
// message (distinct from the generic http/network error text).

export const rateLimitStatus = 403
export const rateLimitHeaders: Record<string, string> = {
  'content-type': 'application/json; charset=utf-8',
  // The client reads these cross-origin response headers via `Headers.get()`.
  // A browser only exposes non-safelisted headers to JS when the response
  // advertises them via `Access-Control-Expose-Headers` — which the real GitHub
  // API does. The mock must mirror that, or the rate-limit headers stay hidden
  // and the 403 mis-maps to a generic `http` error instead of `rate-limit`.
  'access-control-allow-origin': '*',
  'access-control-expose-headers': 'x-ratelimit-remaining, x-ratelimit-reset, retry-after',
  'x-ratelimit-remaining': '0',
  'retry-after': '30',
}
export const rateLimitBody = {
  message: "API rate limit exceeded for 0.0.0.0. (But here's the good news: Authenticated requests get a higher rate limit.)",
  documentation_url: 'https://docs.github.com/rest/search',
}

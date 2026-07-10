import type { Page, Route } from '@playwright/test'

import {
  bigReposResponse,
  bigUsersResponse,
  rateLimitBody,
  rateLimitHeaders,
  rateLimitStatus,
  smallReposResponse,
  smallUsersResponse,
} from '../fixtures/github'

/**
 * Registers `page.route` interceptors for BOTH GitHub search endpoints so the
 * real `api.github.com` is never contacted (AR-12) — every spec calls this in
 * `beforeEach`. Returns a live matched-request counter used by the
 * reopen-no-refetch assertion (AC 10): every intercepted search increments it,
 * so a close→refocus cycle that fires no new request leaves `count` unchanged.
 *
 * The users/repos endpoints are fulfilled from the chosen fixture pair. A
 * `rate-limit` scenario answers both with the 403 rate-limit fixture instead.
 */
export type GithubMock = {
  /** Number of GitHub search requests intercepted so far (users + repos). */
  count: () => number
}

type Scenario = 'small' | 'big' | 'rate-limit'

const USERS_PATTERN = 'https://api.github.com/search/users*'
const REPOS_PATTERN = 'https://api.github.com/search/repositories*'

/** 1×1 transparent GIF, base64 — served for any avatar request so no real
 *  image bytes are fetched from the network. */
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
)

export async function mockGithub(page: Page, scenario: Scenario = 'small'): Promise<GithubMock> {
  let count = 0

  const fulfilJson = (route: Route, body: unknown) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(body),
    })

  const fulfilRateLimit = (route: Route) =>
    route.fulfill({
      status: rateLimitStatus,
      headers: rateLimitHeaders,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(rateLimitBody),
    })

  const handle = (route: Route, kind: 'users' | 'repos') => {
    count += 1
    if (scenario === 'rate-limit') return fulfilRateLimit(route)
    if (scenario === 'big') {
      return fulfilJson(route, kind === 'users' ? bigUsersResponse : bigReposResponse)
    }
    return fulfilJson(route, kind === 'users' ? smallUsersResponse : smallReposResponse)
  }

  await page.route(USERS_PATTERN, (route) => handle(route, 'users'))
  await page.route(REPOS_PATTERN, (route) => handle(route, 'repos'))

  // User rows render `avatar_url` as a CSS background-image, which would issue a
  // real request to avatars.githubusercontent.com when results open. Stub the
  // avatar host too so the suite is FULLY network-isolated (AR-12) and can't
  // flake in offline / network-restricted CI — the fixtures keep realistic
  // avatar URLs, but the bytes come from a 1×1 transparent GIF here.
  await page.route('https://avatars.githubusercontent.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/gif',
      body: TRANSPARENT_GIF,
    }),
  )

  return { count: () => count }
}

import { http, HttpResponse, delay } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '../../test/msw/server'
import { searchGithub } from './githubClient'
import type { GithubResult } from './types'

const USERS_URL = 'https://api.github.com/search/users'
const REPOS_URL = 'https://api.github.com/search/repositories'

const emptyBody = { total_count: 0, incomplete_results: false, items: [] }

const userItem = {
  id: 101,
  login: 'octocat',
  avatar_url: 'https://avatars.example/octocat.png',
  html_url: 'https://github.com/octocat',
}

const repoItem = {
  id: 202,
  name: 'hello-world',
  full_name: 'octocat/hello-world',
  description: 'My first repository',
  owner: { avatar_url: 'https://avatars.example/octocat.png' },
  html_url: 'https://github.com/octocat/hello-world',
}

function okHandlers(
  usersBody: Record<string, unknown> = { ...emptyBody, items: [userItem] },
  reposBody: Record<string, unknown> = { ...emptyBody, items: [repoItem] },
) {
  return [
    http.get(USERS_URL, () => HttpResponse.json(usersBody)),
    http.get(REPOS_URL, () => HttpResponse.json(reposBody)),
  ]
}

function signal() {
  return new AbortController().signal
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('searchGithub — request construction (AC 1, 2)', () => {
  it('fires exactly two parallel requests with q, per_page=50 and pinned headers', async () => {
    const requests: Request[] = []
    let releaseResponses: () => void = () => {}
    const bothArrived = new Promise<void>((resolve) => {
      const gate = new Promise<void>((r) => {
        releaseResponses = r
      })
      let arrived = 0
      const onArrival = async (request: Request) => {
        requests.push(request)
        arrived += 1
        if (arrived === 2) resolve()
        await gate
      }
      server.use(
        http.get(USERS_URL, async ({ request }) => {
          await onArrival(request)
          return HttpResponse.json({ ...emptyBody, items: [userItem] })
        }),
        http.get(REPOS_URL, async ({ request }) => {
          await onArrival(request)
          return HttpResponse.json({ ...emptyBody, items: [repoItem] })
        }),
      )
    })

    const resultPromise = searchGithub('react hooks', signal())
    // Both requests must be in flight before either response resolves — parallel, not serial.
    await bothArrived
    releaseResponses()
    await resultPromise

    expect(requests).toHaveLength(2)
    const urls = requests.map((r) => new URL(r.url))
    expect(urls.map((u) => u.origin + u.pathname).sort()).toEqual([
      'https://api.github.com/search/repositories',
      'https://api.github.com/search/users',
    ])
    for (const url of urls) {
      expect(url.searchParams.get('q')).toBe('react hooks')
      expect(url.searchParams.get('per_page')).toBe('50')
    }
    for (const request of requests) {
      expect(request.headers.get('accept')).toBe('application/vnd.github+json')
      expect(request.headers.get('x-github-api-version')).toBe('2022-11-28')
    }
  })
})

describe('searchGithub — happy path mapping (AC 4, 5)', () => {
  it('maps users and repos responses to the GithubResult domain shape', async () => {
    server.use(...okHandlers())

    const { users, repos } = await searchGithub('octo', signal())

    expect(users).toEqual<GithubResult[]>([
      {
        kind: 'user',
        id: 101,
        name: 'octocat',
        displayPath: 'octocat',
        description: undefined,
        avatarUrl: 'https://avatars.example/octocat.png',
        htmlUrl: 'https://github.com/octocat',
      },
    ])
    expect(repos).toEqual<GithubResult[]>([
      {
        kind: 'repo',
        id: 202,
        name: 'hello-world',
        displayPath: 'octocat/hello-world',
        description: 'My first repository',
        avatarUrl: 'https://avatars.example/octocat.png',
        htmlUrl: 'https://github.com/octocat/hello-world',
      },
    ])
  })

  it('normalizes null description/avatar to undefined and drops malformed items', async () => {
    server.use(
      ...okHandlers(
        {
          ...emptyBody,
          items: [
            { ...userItem, avatar_url: null },
            { login: 'no-identity' }, // missing id + html_url → dropped
            'not-an-object',
          ],
        },
        {
          ...emptyBody,
          items: [
            { ...repoItem, description: null, owner: null },
            { id: 1, name: 'no-html-url', full_name: 'a/no-html-url' }, // dropped
          ],
        },
      ),
    )

    const { users, repos } = await searchGithub('octo', signal())

    expect(users).toHaveLength(1)
    expect(users[0]).toMatchObject({ kind: 'user', avatarUrl: undefined })
    expect(repos).toHaveLength(1)
    expect(repos[0]).toMatchObject({ kind: 'repo', description: undefined, avatarUrl: undefined })
  })

  it('normalizes "N/A"-style placeholder values to undefined', async () => {
    server.use(
      ...okHandlers(
        { ...emptyBody, items: [{ ...userItem, avatar_url: 'N/A' }] },
        { ...emptyBody, items: [{ ...repoItem, description: 'N/A', owner: { avatar_url: '  ' } }] },
      ),
    )

    const { users, repos } = await searchGithub('octo', signal())

    expect(users[0]).toMatchObject({ avatarUrl: undefined })
    expect(repos[0]).toMatchObject({ description: undefined, avatarUrl: undefined })
  })

  it('returns empty arrays when items is missing or not an array', async () => {
    server.use(...okHandlers({ total_count: 0 }, { items: 'nope' }))

    const { users, repos } = await searchGithub('octo', signal())

    expect(users).toEqual([])
    expect(repos).toEqual([])
  })
})

describe('searchGithub — error mapping (AC 6, 7, 9)', () => {
  it('rejects with the typed error when one request fails (full error, no partial results)', async () => {
    server.use(
      http.get(USERS_URL, () => HttpResponse.json({ ...emptyBody, items: [userItem] })),
      http.get(REPOS_URL, () => new HttpResponse(null, { status: 500 })),
    )

    await expect(searchGithub('octo', signal())).rejects.toEqual({ kind: 'http', status: 500 })
  })

  it('maps 403 with retry-after header to rate-limit with retryAfterSeconds', async () => {
    server.use(
      http.get(USERS_URL, () => new HttpResponse(null, { status: 403, headers: { 'retry-after': '42' } })),
      ...okHandlers().slice(1),
    )

    await expect(searchGithub('octo', signal())).rejects.toEqual({
      kind: 'rate-limit',
      retryAfterSeconds: 42,
    })
  })

  it('maps 403 with x-ratelimit-remaining: 0 to rate-limit, deriving retryAfterSeconds from x-ratelimit-reset', async () => {
    const reset = Math.floor(Date.now() / 1000) + 30
    server.use(
      http.get(
        USERS_URL,
        () =>
          new HttpResponse(null, {
            status: 403,
            headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) },
          }),
      ),
      ...okHandlers().slice(1),
    )

    const rejection = await searchGithub('octo', signal()).then(
      () => {
        throw new Error('expected rejection')
      },
      (error: unknown) => error,
    )

    expect(rejection).toMatchObject({ kind: 'rate-limit' })
    const { retryAfterSeconds } = rejection as { retryAfterSeconds?: number }
    expect(retryAfterSeconds).toBeGreaterThanOrEqual(28)
    expect(retryAfterSeconds).toBeLessThanOrEqual(30)
  })

  it('maps 403 without rate-limit headers to a plain http error', async () => {
    server.use(
      http.get(USERS_URL, () => new HttpResponse(null, { status: 403 })),
      ...okHandlers().slice(1),
    )

    await expect(searchGithub('octo', signal())).rejects.toEqual({ kind: 'http', status: 403 })
  })

  it('maps a non-403 non-2xx response to { kind: "http", status }', async () => {
    server.use(
      http.get(USERS_URL, () => new HttpResponse(null, { status: 500 })),
      ...okHandlers().slice(1),
    )

    await expect(searchGithub('octo', signal())).rejects.toEqual({ kind: 'http', status: 500 })
  })

  it('maps a thrown fetch (network failure) to { kind: "network" }', async () => {
    server.use(http.get(USERS_URL, () => HttpResponse.error()), ...okHandlers().slice(1))

    await expect(searchGithub('octo', signal())).rejects.toEqual({ kind: 'network' })
  })
})

describe('searchGithub — abort propagation (AC 8)', () => {
  it('rejects with the abort itself, never a mapped GithubSearchError', async () => {
    server.use(
      http.get(USERS_URL, async () => {
        await delay(100)
        return HttpResponse.json(emptyBody)
      }),
      http.get(REPOS_URL, async () => {
        await delay(100)
        return HttpResponse.json(emptyBody)
      }),
    )

    const controller = new AbortController()
    const promise = searchGithub('octo', controller.signal)
    controller.abort()

    const rejection = await promise.then(
      () => {
        throw new Error('expected rejection')
      },
      (error: unknown) => error,
    )

    expect(rejection).toBeInstanceOf(Error)
    expect((rejection as Error).name).toBe('AbortError')
    expect(rejection).not.toHaveProperty('kind')
  })
})

describe('searchGithub — optional token (AC 3)', () => {
  async function capturedAuthHeaders(token?: string) {
    const auth: (string | null)[] = []
    server.use(
      http.get(USERS_URL, ({ request }) => {
        auth.push(request.headers.get('authorization'))
        return HttpResponse.json(emptyBody)
      }),
      http.get(REPOS_URL, ({ request }) => {
        auth.push(request.headers.get('authorization'))
        return HttpResponse.json(emptyBody)
      }),
    )
    await searchGithub('octo', signal(), token)
    return auth
  }

  it('sends no Authorization header when no token is configured', async () => {
    expect(await capturedAuthHeaders()).toEqual([null, null])
  })

  it('sends Authorization: Bearer <token> on both requests when a token argument is provided', async () => {
    expect(await capturedAuthHeaders('arg-token')).toEqual(['Bearer arg-token', 'Bearer arg-token'])
  })

  it('falls back to VITE_GITHUB_TOKEN from the environment', async () => {
    vi.stubEnv('VITE_GITHUB_TOKEN', 'env-token')
    expect(await capturedAuthHeaders()).toEqual(['Bearer env-token', 'Bearer env-token'])
  })

  it('prefers the argument token over the env token', async () => {
    vi.stubEnv('VITE_GITHUB_TOKEN', 'env-token')
    expect(await capturedAuthHeaders('arg-token')).toEqual(['Bearer arg-token', 'Bearer arg-token'])
  })
})

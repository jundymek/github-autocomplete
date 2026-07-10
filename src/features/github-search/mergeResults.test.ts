import { http, HttpResponse, delay } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../../test/msw/server'
import {
  MAX_RESULTS,
  createFetchSuggestions,
  createFetchSuggestionsWithTotal,
  fetchSuggestions,
  mergeResults,
} from './mergeResults'
import type { GithubResult } from './types'

const USERS_URL = 'https://api.github.com/search/users'
const REPOS_URL = 'https://api.github.com/search/repositories'

const emptyBody = { total_count: 0, incomplete_results: false, items: [] }

function make(kind: GithubResult['kind'], name: string, id: number | string = 1): GithubResult {
  return {
    kind,
    id,
    name,
    displayPath: kind === 'repo' ? `owner/${name}` : name,
    description: undefined,
    avatarUrl: undefined,
    htmlUrl: `https://github.com/${name}`,
  }
}

function names(results: GithubResult[]): string[] {
  return results.map((r) => r.name)
}

describe('mergeResults — merge and alphabetical order (AC 1, 2, 9a)', () => {
  it('merges users and repos into a single list sorted by name', () => {
    const users = [make('user', 'zeta', 1), make('user', 'alpha', 2)]
    const repos = [make('repo', 'mango', 3), make('repo', 'banana', 4)]

    expect(names(mergeResults(users, repos))).toEqual(['alpha', 'banana', 'mango', 'zeta'])
  })

  it('sorts on the bare name / login, never the displayPath (owner/name)', () => {
    // displayPath would put "aaa-owner/zzz-repo" first; the bare name must win.
    const repo = { ...make('repo', 'zzz-repo', 1), displayPath: 'aaa-owner/zzz-repo' }
    const user = make('user', 'middle', 2)

    expect(names(mergeResults([user], [repo]))).toEqual(['middle', 'zzz-repo'])
  })
})

describe('mergeResults — case-insensitivity (AC 2, 9b)', () => {
  it('interleaves Rea/rea/REA by base letter, not ASCII case', () => {
    const users = [make('user', 'REA', 1), make('user', 'rand', 2)]
    const repos = [make('repo', 'rea', 3), make('repo', 'red', 4), make('repo', 'Rea', 5)]

    const sorted = names(mergeResults(users, repos))

    expect(sorted[0]).toBe('rand')
    expect(sorted[4]).toBe('red')
    // The three case variants of "rea" form one contiguous group in the middle.
    expect(sorted.slice(1, 4).map((n) => n.toLowerCase())).toEqual(['rea', 'rea', 'rea'])
  })
})

describe('mergeResults — diacritics (AC 3, 9c)', () => {
  it('sorts accented names next to their base-letter neighbors', () => {
    const users = [make('user', 'feliz', 1)]
    const repos = [make('repo', 'félix', 2), make('repo', 'felipe', 3)]

    // é compares equal to e at sensitivity 'base': felipe < félix < feliz.
    expect(names(mergeResults(users, repos))).toEqual(['felipe', 'félix', 'feliz'])
  })
})

describe('mergeResults — deterministic tie-break (AC 4, 9d)', () => {
  it('breaks equal base names by kind (repo before user), then by id', () => {
    const users = [make('user', 'Rea', 'u2'), make('user', 'rea', 'u1')]
    const repos = [make('repo', 'REA', 'r2'), make('repo', 'rea', 'r1')]

    const sorted = mergeResults(users, repos)

    expect(sorted.map((r) => `${r.kind}:${r.id}`)).toEqual(['repo:r1', 'repo:r2', 'user:u1', 'user:u2'])
  })

  it('orders mixed-type ids (1 vs "1") deterministically — number before string', () => {
    const numericId = make('user', 'rea', 1)
    const stringId = make('user', 'rea', '1')

    expect(mergeResults([numericId, stringId], [])).toEqual([numericId, stringId])
    expect(mergeResults([stringId, numericId], [])).toEqual([numericId, stringId])
  })

  it('produces the same order regardless of input order', () => {
    const users = [make('user', 'rea', 'u1'), make('user', 'Rea', 'u2')]
    const repos = [make('repo', 'rea', 'r1'), make('repo', 'REA', 'r2')]

    const forward = mergeResults(users, repos)
    const backward = mergeResults([...users].reverse(), [...repos].reverse())

    expect(backward).toEqual(forward)
  })
})

describe('mergeResults — cap at 50 after sorting (AC 5, 9e)', () => {
  // Names aa, ab, ... generated so lexicographic order is unambiguous.
  function name(i: number): string {
    return String.fromCharCode(97 + Math.floor(i / 26)) + String.fromCharCode(97 + (i % 26))
  }

  it('trims 100 merged items to the alphabetically first 50', () => {
    // users get the odd names, repos the even ones — the cap must apply to the
    // combined sorted list, not per side.
    const users = Array.from({ length: 50 }, (_, i) => make('user', name(i * 2 + 1), `u${i}`))
    const repos = Array.from({ length: 50 }, (_, i) => make('repo', name(i * 2), `r${i}`))

    const sorted = mergeResults(users, repos)

    expect(sorted).toHaveLength(50)
    expect(names(sorted)).toEqual(Array.from({ length: 50 }, (_, i) => name(i)))
  })

  it('returns exactly 50 items unchanged when the merged total is 50', () => {
    const users = Array.from({ length: 25 }, (_, i) => make('user', name(i * 2 + 1), `u${i}`))
    const repos = Array.from({ length: 25 }, (_, i) => make('repo', name(i * 2), `r${i}`))

    const sorted = mergeResults(users, repos)

    expect(sorted).toHaveLength(50)
    expect(names(sorted)).toEqual(Array.from({ length: 50 }, (_, i) => name(i)))
  })

  it('exports MAX_RESULTS = 50', () => {
    expect(MAX_RESULTS).toBe(50)
  })
})

describe('mergeResults — empty inputs (AC 9f)', () => {
  it('returns [] for empty users + empty repos', () => {
    expect(mergeResults([], [])).toEqual([])
  })

  it('returns the other side sorted when one side is empty', () => {
    const repos = [make('repo', 'zeta', 1), make('repo', 'alpha', 2)]

    expect(names(mergeResults([], repos))).toEqual(['alpha', 'zeta'])
    expect(names(mergeResults(repos, []))).toEqual(['alpha', 'zeta'])
  })
})

describe('fetchSuggestions — composed contract (AC 6, 7, 8, 9g)', () => {
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

  function signal() {
    return new AbortController().signal
  }

  it('resolves the merged, sorted GithubResult[] when both searches succeed (AC 7)', async () => {
    server.use(
      http.get(USERS_URL, () => HttpResponse.json({ ...emptyBody, items: [userItem] })),
      http.get(REPOS_URL, () => HttpResponse.json({ ...emptyBody, items: [repoItem] })),
    )

    const results = await fetchSuggestions('octo', signal())

    expect(names(results)).toEqual(['hello-world', 'octocat'])
    expect(results.map((r) => r.kind)).toEqual(['repo', 'user'])
  })

  it('rejects with the typed GithubSearchError when one search fails — never partial results (AC 6, 9g)', async () => {
    server.use(
      http.get(USERS_URL, () => HttpResponse.json({ ...emptyBody, items: [userItem] })),
      http.get(REPOS_URL, () => new HttpResponse(null, { status: 500 })),
    )

    await expect(fetchSuggestions('octo', signal())).rejects.toEqual({ kind: 'http', status: 500 })
  })

  it('rejects with rate-limit when one search is rate limited', async () => {
    server.use(
      http.get(USERS_URL, () => new HttpResponse(null, { status: 403, headers: { 'retry-after': '42' } })),
      http.get(REPOS_URL, () => HttpResponse.json({ ...emptyBody, items: [repoItem] })),
    )

    await expect(fetchSuggestions('octo', signal())).rejects.toEqual({
      kind: 'rate-limit',
      retryAfterSeconds: 42,
    })
  })

  it('propagates AbortError unchanged — not a GithubSearchError, not an empty resolve (AC 8)', async () => {
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
    const promise = fetchSuggestions('octo', controller.signal)
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

  it('createFetchSuggestionsWithTotal reports the combined total_count via the callback', async () => {
    server.use(
      http.get(USERS_URL, () => HttpResponse.json({ ...emptyBody, total_count: 1200, items: [userItem] })),
      http.get(REPOS_URL, () => HttpResponse.json({ ...emptyBody, total_count: 4, items: [repoItem] })),
    )

    const totals: number[] = []
    const fetch = createFetchSuggestionsWithTotal((total) => totals.push(total))
    const results = await fetch('octo', signal())

    expect(names(results)).toEqual(['hello-world', 'octocat'])
    expect(totals).toEqual([1204])
  })

  it('createFetchSuggestionsWithTotal passes the request signal so a stale report can be dropped', async () => {
    server.use(
      http.get(USERS_URL, () => HttpResponse.json({ ...emptyBody, total_count: 1200, items: [userItem] })),
      http.get(REPOS_URL, () => HttpResponse.json({ ...emptyBody, total_count: 4, items: [repoItem] })),
    )

    const reports: Array<{ total: number; query: string; aborted: boolean }> = []
    const fetch = createFetchSuggestionsWithTotal((total, query, signal) =>
      reports.push({ total, query, aborted: signal.aborted }),
    )

    const controller = new AbortController()
    // Abort *after* the request settles but the callback observes the signal:
    // simulate the newer-query-wins race by aborting once results are back.
    const results = await fetch('octo', controller.signal)
    controller.abort()

    expect(names(results)).toEqual(['hello-world', 'octocat'])
    // The callback fired before the abort here, but it received the very signal
    // a newer query would abort — the consumer guards on `signal.aborted`.
    expect(reports).toHaveLength(1)
    expect(reports[0]).toMatchObject({ total: 1204, query: 'octo' })
    expect(controller.signal.aborted).toBe(true)
  })

  it('createFetchSuggestionsWithTotal does not report a total when the search fails', async () => {
    server.use(
      http.get(USERS_URL, () => HttpResponse.json({ ...emptyBody, items: [userItem] })),
      http.get(REPOS_URL, () => new HttpResponse(null, { status: 500 })),
    )

    const totals: number[] = []
    const fetch = createFetchSuggestionsWithTotal((total) => totals.push(total))

    await expect(fetch('octo', signal())).rejects.toEqual({ kind: 'http', status: 500 })
    expect(totals).toEqual([])
  })

  it('binds the token at construction time and sends it on both requests (FR-16)', async () => {
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

    await createFetchSuggestions('my-token')('octo', signal())

    expect(auth).toEqual(['Bearer my-token', 'Bearer my-token'])
  })

  it('sends no Authorization header from the default unauthenticated instance', async () => {
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

    await fetchSuggestions('octo', signal())

    expect(auth).toEqual([null, null])
  })

  it('caps the combined list to 50 end-to-end', async () => {
    const userItems = Array.from({ length: 50 }, (_, i) => ({
      ...userItem,
      id: 1000 + i,
      login: `user-${String(i).padStart(2, '0')}`,
      html_url: `https://github.com/user-${i}`,
    }))
    const repoItems = Array.from({ length: 50 }, (_, i) => ({
      ...repoItem,
      id: 2000 + i,
      name: `repo-${String(i).padStart(2, '0')}`,
      full_name: `owner/repo-${String(i).padStart(2, '0')}`,
    }))
    server.use(
      http.get(USERS_URL, () => HttpResponse.json({ ...emptyBody, items: userItems })),
      http.get(REPOS_URL, () => HttpResponse.json({ ...emptyBody, items: repoItems })),
    )

    const results = await fetchSuggestions('octo', signal())

    expect(results).toHaveLength(50)
    // "repo-*" < "user-*" alphabetically, so the cap keeps all 50 repos.
    expect(results.every((r) => r.kind === 'repo')).toBe(true)
  })
})

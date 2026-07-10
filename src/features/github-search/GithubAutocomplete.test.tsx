import { http, HttpResponse } from 'msw'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../test/msw/server'
import { GithubAutocomplete } from './GithubAutocomplete'

const USERS_URL = 'https://api.github.com/search/users'
const REPOS_URL = 'https://api.github.com/search/repositories'

// Real timers throughout: MSW resolves over the real microtask/macrotask
// queue, so fake timers + waitFor would deadlock. We simply wait out the real
// 300ms debounce and poll with Testing Library's waitFor.

const emptyBody = { total_count: 0, incomplete_results: false, items: [] }

const reactUser = {
  id: 1,
  login: 'reactjs',
  avatar_url: 'https://avatars.example/reactjs.png',
  html_url: 'https://github.com/reactjs',
}

const reactRepo = {
  id: 2,
  name: 'react',
  full_name: 'facebook/react',
  description: 'A declarative UI library',
  owner: { avatar_url: 'https://avatars.example/facebook.png' },
  html_url: 'https://github.com/facebook/react',
}

/** Handlers returning one user + one repo, with a large combined total. */
function mixedHandlers() {
  return [
    http.get(USERS_URL, () => HttpResponse.json({ ...emptyBody, total_count: 1200, items: [reactUser] })),
    http.get(REPOS_URL, () => HttpResponse.json({ ...emptyBody, total_count: 4, items: [reactRepo] })),
  ]
}

function input(): HTMLInputElement {
  return screen.getByRole('combobox')
}

/** Focuses the input and types a qualifying query (fires the debounced fetch). */
function typeQuery(query = 'react') {
  const el = input()
  el.focus()
  fireEvent.change(el, { target: { value: query } })
}

function options(): HTMLElement[] {
  return screen.queryAllByRole('option')
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GithubAutocomplete — merged rendering (AC 10a)', () => {
  it('renders the merged, sorted list with users and repos visually distinguished', async () => {
    server.use(...mixedHandlers())
    render(<GithubAutocomplete />)

    typeQuery('react')

    const opts = await waitFor(() => {
      const found = options()
      expect(found).toHaveLength(2)
      return found
    })

    // Sorted A→Z on the bare name: "react" (repo) before "reactjs" (user).
    const repoOption = opts[0]
    const userOption = opts[1]

    // Repo: bare name + mono owner/repo path + KIND "repo" + { } tile.
    expect(within(repoOption).getByText('facebook/react')).toBeInTheDocument()
    expect(within(repoOption).getByText('repo')).toBeInTheDocument()
    expect(repoOption.textContent).toContain('{ }')

    // User: login + KIND "user", and NO owner/repo path.
    expect(within(userOption).getByText('user')).toBeInTheDocument()
    expect(userOption.textContent).not.toContain('/')

    // Query echo: the "react" substring is wrapped in <mark> in both names.
    const marks = document.body.querySelectorAll('mark')
    expect(marks.length).toBeGreaterThanOrEqual(2)
    expect(Array.from(marks).every((m) => m.textContent?.toLowerCase() === 'react')).toBe(true)
  })

  it('renders the "X of Y · sorted A→Z" footer from the combined total_count', async () => {
    server.use(...mixedHandlers())
    render(<GithubAutocomplete />)

    typeQuery('react')

    await waitFor(() => {
      // displayed 2 of total 1,204 (1200 + 4).
      expect(document.body.textContent).toContain('2 of 1,204 · sorted A→Z')
    })
  })
})

describe('GithubAutocomplete — user match context (Story 1.6)', () => {
  const HINT = 'matches profile'

  function userHandlers(items: unknown[]) {
    return [
      http.get(USERS_URL, () => HttpResponse.json({ ...emptyBody, total_count: items.length, items })),
      http.get(REPOS_URL, () => HttpResponse.json(emptyBody)),
    ]
  }

  it('shows the "matches profile" hint when the login does not contain the query', async () => {
    // Login "beomi" has no "jun" — the match is on a hidden profile field.
    server.use(
      ...userHandlers([{ id: 10, login: 'beomi', html_url: 'https://github.com/beomi', type: 'User' }]),
    )
    render(<GithubAutocomplete />)

    typeQuery('jun')

    const opt = await waitFor(() => {
      const found = options()
      expect(found).toHaveLength(1)
      return found[0]
    })

    expect(within(opt).getByText('user')).toBeInTheDocument()
    expect(within(opt).getByText(HINT)).toBeInTheDocument()
    // Login is shown, and since "jun" isn't in it there is no <mark> highlight.
    expect(opt.textContent).toContain('beomi')
    expect(opt.querySelector('mark')).toBeNull()
  })

  it('shows NO hint when the login itself contains the query (the <mark> already explains it)', async () => {
    server.use(
      ...userHandlers([{ id: 11, login: 'junnplus', html_url: 'https://github.com/junnplus', type: 'User' }]),
    )
    render(<GithubAutocomplete />)

    typeQuery('jun') // "jun" IS in "junnplus"

    const opt = await waitFor(() => {
      const found = options()
      expect(found).toHaveLength(1)
      return found[0]
    })

    expect(within(opt).queryByText(HINT)).not.toBeInTheDocument()
    // The login highlight is present instead.
    expect(within(opt).getByText('jun', { selector: 'mark' })).toBeInTheDocument()
  })

  it('labels organizations as "org", not "user"', async () => {
    server.use(
      ...userHandlers([{ id: 12, login: 'junos-org', html_url: 'https://github.com/junos-org', type: 'Organization' }]),
    )
    render(<GithubAutocomplete />)

    typeQuery('jun') // in the login → org label is the thing under test, not the hint

    const opt = await waitFor(() => {
      const found = options()
      expect(found).toHaveLength(1)
      return found[0]
    })

    expect(within(opt).getByText('org')).toBeInTheDocument()
    expect(within(opt).queryByText('user')).not.toBeInTheDocument()
  })
})

describe('GithubAutocomplete — selection opens a new tab (AC 10b, 10c)', () => {
  const NEW_TAB_ARGS = ['_blank', 'noopener,noreferrer']

  it('Enter on the highlighted item opens htmlUrl with noopener,noreferrer', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    server.use(...mixedHandlers())
    render(<GithubAutocomplete />)

    typeQuery('react')
    await waitFor(() => expect(options()).toHaveLength(2))

    // ArrowDown highlights the first option (the repo), Enter selects it.
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    fireEvent.keyDown(input(), { key: 'Enter' })

    expect(openSpy).toHaveBeenCalledTimes(1)
    expect(openSpy).toHaveBeenCalledWith('https://github.com/facebook/react', ...NEW_TAB_ARGS)
  })

  it('click selection opens the same htmlUrl with the identical args', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    server.use(...mixedHandlers())
    render(<GithubAutocomplete />)

    typeQuery('react')
    await waitFor(() => expect(options()).toHaveLength(2))

    fireEvent.click(options()[0])

    expect(openSpy).toHaveBeenCalledTimes(1)
    expect(openSpy).toHaveBeenCalledWith('https://github.com/facebook/react', ...NEW_TAB_ARGS)
  })
})

describe('GithubAutocomplete — rate-limit state (AC 10d)', () => {
  it('renders the dedicated amber rate-limit state with a countdown and token hint', async () => {
    server.use(
      http.get(USERS_URL, () => new HttpResponse(null, { status: 403, headers: { 'retry-after': '42' } })),
      http.get(REPOS_URL, () => HttpResponse.json({ ...emptyBody, items: [reactRepo] })),
    )
    render(<GithubAutocomplete />)

    typeQuery('react')

    await waitFor(() => {
      expect(screen.getByText('GitHub rate limit reached')).toBeInTheDocument()
    })
    const pop = document.body.textContent ?? ''
    expect(pop).toContain('Try again in 42s')
    expect(pop).toMatch(/token/i)
    // Distinct from the generic error: no "Search failed", no retry button.
    expect(screen.queryByText('Search failed')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
  })
})

describe('GithubAutocomplete — generic error + retry (AC 10e, 10f)', () => {
  it('renders the generic "Search failed" error with a retry for an HTTP failure', async () => {
    server.use(
      http.get(USERS_URL, () => HttpResponse.json({ ...emptyBody, items: [reactUser] })),
      http.get(REPOS_URL, () => new HttpResponse(null, { status: 500 })),
    )
    render(<GithubAutocomplete />)

    typeQuery('react')

    await waitFor(() => {
      expect(screen.getByText('Search failed')).toBeInTheDocument()
    })
    expect(document.body.textContent).toContain('HTTP 500')
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('renders the generic "Search failed" error for a network rejection (fetch throws)', async () => {
    server.use(
      http.get(USERS_URL, () => HttpResponse.error()),
      http.get(REPOS_URL, () => HttpResponse.json({ ...emptyBody, items: [reactRepo] })),
    )
    render(<GithubAutocomplete />)

    typeQuery('react')

    await waitFor(() => {
      expect(screen.getByText('Search failed')).toBeInTheDocument()
    })
    // Network branch: connection wording, no HTTP status, retry offered.
    expect(document.body.textContent).toMatch(/connection/i)
    expect(document.body.textContent).not.toContain('HTTP')
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('retry re-fires the SAME query and can render results after an initial failure', async () => {
    // First round: repos endpoint 500s → generic error.
    server.use(
      http.get(USERS_URL, () => HttpResponse.json({ ...emptyBody, items: [reactUser] })),
      http.get(REPOS_URL, () => new HttpResponse(null, { status: 500 })),
    )
    render(<GithubAutocomplete />)

    typeQuery('react')
    const retry = await screen.findByRole('button', { name: /try again/i })

    // Second round: both endpoints succeed and record the query they receive.
    const retriedQueries: string[] = []
    const record = (url: string) => new URL(url).searchParams.get('q') ?? ''
    server.use(
      http.get(USERS_URL, ({ request }) => {
        retriedQueries.push(record(request.url))
        return HttpResponse.json({ ...emptyBody, total_count: 1200, items: [reactUser] })
      }),
      http.get(REPOS_URL, ({ request }) => {
        retriedQueries.push(record(request.url))
        return HttpResponse.json({ ...emptyBody, total_count: 4, items: [reactRepo] })
      }),
    )
    fireEvent.click(retry)

    await waitFor(() => expect(options()).toHaveLength(2))
    expect(within(options()[0]).getByText('facebook/react')).toBeInTheDocument()
    // The retry fired the exact last query ("react") on both endpoints.
    expect(retriedQueries).toEqual(['react', 'react'])
  })
})

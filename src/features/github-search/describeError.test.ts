import { describe, expect, it } from 'vitest'
import { describeError } from './describeError'
import type { GithubSearchError } from './types'

describe('describeError — GithubSearchError → user-facing content (AC 5, 6, 7)', () => {
  it('maps rate-limit to an amber, non-retryable message that names the cause and points to a token', () => {
    const content = describeError({ kind: 'rate-limit', retryAfterSeconds: 42 })

    expect(content.tone).toBe('warning')
    expect(content.title).toBe('GitHub rate limit reached')
    expect(content.description).toContain('42s')
    expect(content.description).toMatch(/token/i)
    // The amber rate-limit state has no in-popup retry button (design state 08).
    expect(content.retryable).toBe(false)
  })

  it('rounds up a fractional retry-after and still renders a countdown', () => {
    const content = describeError({ kind: 'rate-limit', retryAfterSeconds: 41.2 })
    expect(content.description).toContain('42s')
  })

  it('omits the countdown clause when retryAfterSeconds is absent', () => {
    const content = describeError({ kind: 'rate-limit' })

    expect(content.tone).toBe('warning')
    expect(content.description).not.toMatch(/try again in/i)
    expect(content.description).toMatch(/token/i)
  })

  it('treats a zero/negative retry-after as no countdown', () => {
    expect(describeError({ kind: 'rate-limit', retryAfterSeconds: 0 }).description).not.toMatch(
      /try again in/i,
    )
    expect(describeError({ kind: 'rate-limit', retryAfterSeconds: -5 }).description).not.toMatch(
      /try again in/i,
    )
  })

  it('maps network to a generic, retryable "Search failed" error', () => {
    const content = describeError({ kind: 'network' })

    expect(content.tone ?? 'error').toBe('error')
    expect(content.title).toBe('Search failed')
    expect(content.description).toMatch(/connection/i)
    expect(content.retryable ?? true).toBe(true)
  })

  it('maps http to a generic, retryable "Search failed" error carrying the status', () => {
    const content = describeError({ kind: 'http', status: 503 })

    expect(content.tone ?? 'error').toBe('error')
    expect(content.title).toBe('Search failed')
    expect(content.description).toContain('503')
    expect(content.retryable ?? true).toBe(true)
  })

  it('is exhaustive — every GithubSearchError kind yields content', () => {
    const errors: GithubSearchError[] = [
      { kind: 'network' },
      { kind: 'http', status: 500 },
      { kind: 'rate-limit' },
    ]
    for (const error of errors) {
      expect(describeError(error).title).toBeTruthy()
    }
  })
})

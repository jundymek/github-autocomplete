import type { AutocompleteError, AutocompleteErrorContent } from '../../lib/autocomplete/types'
import type { GithubSearchError } from './types'

/**
 * User-facing message content for a single {@link GithubSearchError}.
 *
 * This is the adapter's job (AR-9, §3.3): the client (2.1) only *produces* the
 * typed error union; the wording, tone, and retryability live here so the
 * generic lib stays GitHub-ignorant — it receives only the resulting
 * `{ status: 'error'; message }`-level {@link AutocompleteErrorContent}
 * (NFR-5). The `switch` is exhaustive with a `never` default, so adding a new
 * `GithubSearchError` member is a compile error until it is handled here.
 */
export function describeError(error: GithubSearchError): AutocompleteErrorContent {
  switch (error.kind) {
    case 'rate-limit':
      return {
        title: 'GitHub rate limit reached',
        description: rateLimitDescription(error.retryAfterSeconds),
        tone: 'warning',
        // The amber rate-limit state points to a token / countdown instead of
        // an immediate retry button (design state 08).
        retryable: false,
      }
    case 'network':
      return {
        title: 'Search failed',
        description: 'GitHub didn’t respond. Check your connection and try again.',
        tone: 'error',
        retryable: true,
      }
    case 'http':
      return {
        title: 'Search failed',
        description: `GitHub returned an unexpected response (HTTP ${error.status}). Try again.`,
        tone: 'error',
        retryable: true,
      }
    default: {
      // Exhaustiveness guard: a new GithubSearchError kind fails to compile here.
      const _exhaustive: never = error
      return _exhaustive
    }
  }
}

/**
 * Builds the rate-limit body: always names the unauthenticated limit and the
 * token option; prepends a live "Try again in Ns" countdown when the API gave
 * a positive `retry-after` (rounded up to whole seconds).
 */
function rateLimitDescription(retryAfterSeconds: number | undefined): string {
  const tokenHint = 'Unauthenticated search allows 10 requests per minute. Add a token to raise the limit.'
  if (retryAfterSeconds !== undefined && retryAfterSeconds > 0) {
    const seconds = Math.ceil(retryAfterSeconds)
    return `Try again in ${seconds}s. ${tokenHint}`
  }
  return tokenHint
}

/**
 * Bridges the lib's {@link AutocompleteError} (which preserves the original
 * thrown value in `cause`) to {@link describeError}. When `cause` is a
 * recognized {@link GithubSearchError} we render the GitHub-specific content;
 * otherwise we fall back to the hook's generic message so unexpected throws
 * still surface a sane, retryable error.
 */
export function describeAutocompleteError(error: AutocompleteError): AutocompleteErrorContent {
  const cause = error.cause
  if (isGithubSearchError(cause)) return describeError(cause)
  return { title: 'Search failed', description: error.message, tone: 'error', retryable: true }
}

function isGithubSearchError(value: unknown): value is GithubSearchError {
  if (typeof value !== 'object' || value === null) return false
  const kind = (value as { kind?: unknown }).kind
  return kind === 'network' || kind === 'http' || kind === 'rate-limit'
}

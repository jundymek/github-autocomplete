import type { GithubResult, GithubSearchError } from './types'

const API_BASE = 'https://api.github.com'
const API_VERSION = '2022-11-28'
const PER_PAGE = 50

/** The two mapped result lists, one per search endpoint (merge/sort/cap is Story 2.2). */
export type GithubSearchResults = {
  users: GithubResult[]
  repos: GithubResult[]
}

/**
 * Queries GitHub users and repositories in parallel and maps both responses
 * to `GithubResult` lists (AR-8 steps 1–2).
 *
 * - Both requests share the caller's `signal`; aborting rejects with the
 *   abort itself, never a `GithubSearchError` (AR-3).
 * - Any other failure rejects with a `GithubSearchError` — full error, never
 *   partial results (`Promise.all` semantics, owner decision U2).
 * - `token` (or `VITE_GITHUB_TOKEN` as fallback) adds `Authorization: Bearer`;
 *   unauthenticated otherwise (FR-16).
 */
export async function searchGithub(
  query: string,
  signal: AbortSignal,
  token?: string,
): Promise<GithubSearchResults> {
  const headers = buildHeaders(token)
  const [users, repos] = await Promise.all([
    requestJson(searchUrl('/search/users', query), headers, signal),
    requestJson(searchUrl('/search/repositories', query), headers, signal),
  ])
  return { users: mapItems(users, mapUserItem), repos: mapItems(repos, mapRepoItem) }
}

function searchUrl(endpoint: string, query: string): string {
  const url = new URL(endpoint, API_BASE)
  url.searchParams.set('q', query)
  url.searchParams.set('per_page', String(PER_PAGE))
  return url.toString()
}

function buildHeaders(argToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': API_VERSION,
  }
  const token = argToken ?? (import.meta.env.VITE_GITHUB_TOKEN as string | undefined)
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function requestJson(
  url: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, { headers, signal })
  } catch (error) {
    if (isAbort(error)) throw error
    throw { kind: 'network' } satisfies GithubSearchError
  }
  if (!response.ok) throw mapHttpError(response)
  try {
    return await response.json()
  } catch (error) {
    if (isAbort(error)) throw error
    // An unparseable 2xx body is shape drift, not a failure — map to no items.
    return undefined
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function mapHttpError(response: Response): GithubSearchError {
  const isRateLimit =
    response.status === 403 &&
    (response.headers.get('x-ratelimit-remaining') === '0' ||
      response.headers.has('retry-after'))
  if (isRateLimit) {
    return { kind: 'rate-limit', retryAfterSeconds: deriveRetryAfterSeconds(response.headers) }
  }
  return { kind: 'http', status: response.status }
}

function deriveRetryAfterSeconds(headers: Headers): number | undefined {
  const retryAfter = parseIntHeader(headers.get('retry-after'))
  if (retryAfter !== undefined) return retryAfter
  const reset = parseIntHeader(headers.get('x-ratelimit-reset'))
  if (reset !== undefined) return Math.max(0, reset - Math.floor(Date.now() / 1000))
  return undefined
}

function parseIntHeader(value: string | null): number | undefined {
  if (value === null) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

// --- Defensive by-hand response validation (NFR-3/NFR-4; Zod is not in this
// stack). Only the mapped fields are read; malformed items are skipped, and
// absent values normalize to `undefined` — shape drift never throws.

function mapItems(body: unknown, mapItem: (item: unknown) => GithubResult | undefined): GithubResult[] {
  if (!isRecord(body) || !Array.isArray(body.items)) return []
  return body.items
    .map(mapItem)
    .filter((result): result is GithubResult => result !== undefined)
}

function mapUserItem(item: unknown): GithubResult | undefined {
  if (!isRecord(item)) return undefined
  const { id, login, html_url: htmlUrl, avatar_url: avatarUrl } = item
  if (!isId(id) || typeof login !== 'string' || typeof htmlUrl !== 'string') return undefined
  return {
    kind: 'user',
    id,
    name: login,
    displayPath: login,
    description: undefined,
    avatarUrl: optionalString(avatarUrl),
    htmlUrl,
  }
}

function mapRepoItem(item: unknown): GithubResult | undefined {
  if (!isRecord(item)) return undefined
  const { id, name, full_name: fullName, description, owner, html_url: htmlUrl } = item
  if (
    !isId(id) ||
    typeof name !== 'string' ||
    typeof fullName !== 'string' ||
    typeof htmlUrl !== 'string'
  ) {
    return undefined
  }
  return {
    kind: 'repo',
    id,
    name,
    displayPath: fullName,
    description: optionalString(description),
    avatarUrl: optionalString(isRecord(owner) ? owner.avatar_url : undefined),
    htmlUrl,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isId(value: unknown): value is number | string {
  return typeof value === 'number' || typeof value === 'string'
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  // Normalize "N/A"-style placeholder values (and blank strings) to absent.
  return trimmed === '' || trimmed === 'N/A' ? undefined : value
}

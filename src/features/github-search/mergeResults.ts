import { searchGithub } from './githubClient'
import type { GithubResult } from './types'

/** Maximum number of combined suggestions (FR-6, PRD §4.2). */
export const MAX_RESULTS = 50

/**
 * Merges users and repositories into a single alphabetical list capped at
 * {@link MAX_RESULTS} items (AR-8 steps 2–3).
 *
 * Ordering is case-insensitive, diacritic-insensitive and locale-aware:
 * `localeCompare` with `sensitivity: 'base'` on `result.name` — the user
 * login or the bare repository name, never `owner/name` (owner decision U3).
 *
 * Tie-break for equal base names, so the order is total and reproducible
 * regardless of input order: kind (`repo` before `user`), then id
 * (string-compared), then id type (`number` before `string`, so `1` and `'1'`
 * — equal once stringified — still order deterministically).
 */
export function mergeResults(users: GithubResult[], repos: GithubResult[]): GithubResult[] {
  return [...users, ...repos].sort(compareResults).slice(0, MAX_RESULTS)
}

function compareResults(a: GithubResult, b: GithubResult): number {
  return (
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) ||
    a.kind.localeCompare(b.kind) ||
    String(a.id).localeCompare(String(b.id)) ||
    (typeof a.id).localeCompare(typeof b.id)
  )
}

/**
 * Creates the AR-4-shaped suggestion fetcher consumed by the generic
 * `Autocomplete<T>` component: `(query, signal) => Promise<GithubResult[]>`.
 *
 * The optional GitHub `token` (FR-16) is bound here, at construction time, so
 * the returned function keeps the GitHub-agnostic AR-4 signature.
 *
 * Fetches users and repositories in parallel and resolves the merged, sorted,
 * capped list. All-or-nothing (owner decision U2): if either underlying search
 * fails, it rejects with the single typed `GithubSearchError` from the client
 * — never a partial list. Aborts propagate unchanged (AR-3, AR-9).
 */
export function createFetchSuggestions(
  token?: string,
): (query: string, signal: AbortSignal) => Promise<GithubResult[]> {
  return async (query, signal) => {
    const { users, repos } = await searchGithub(query, signal, token)
    return mergeResults(users, repos)
  }
}

/** Unauthenticated default {@link createFetchSuggestions} instance (AR-4). */
export const fetchSuggestions = createFetchSuggestions()

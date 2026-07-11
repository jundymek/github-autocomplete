import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { Autocomplete } from '../../lib/autocomplete'
import type { AutocompleteFooterContext } from '../../lib/autocomplete'
import styles from './GithubAutocomplete.module.css'
import { describeAutocompleteError } from './describeError'
import { createFetchSuggestionsWithTotal } from './mergeResults'
import type { GithubResult } from './types'

/**
 * Props for {@link GithubAutocomplete}. The wrapper's entire public surface —
 * everything else (rendering, selection, error wording) is fixed by the GitHub
 * adapter and not configurable.
 */
export type GithubAutocompleteProps = {
  /**
   * Optional GitHub personal access token (FR-16). Forwarded to the client to
   * raise the unauthenticated rate limit. **Never** commit a token; pass it
   * from the host (e.g. an env var). Absent → unauthenticated requests.
   */
  token?: string
  /** Input placeholder. @default 'Search GitHub users and repositories…' */
  placeholder?: string
  /** Accessible name of the combobox input. @default 'Search GitHub' */
  label?: string
}

const DEFAULT_PLACEHOLDER = 'Search GitHub users and repositories…'
const DEFAULT_LABEL = 'Search GitHub'

/** Stable, kind-scoped React/`aria-activedescendant` key (AC 3). */
export function getItemKey(item: GithubResult): string {
  return `${item.kind}:${item.id}`
}

/**
 * `GithubAutocomplete` — the wired instance where the two layers meet (AR-2):
 * a thin wrapper that renders the generic `Autocomplete<GithubResult>` and
 * injects the GitHub adapter's `fetchSuggestions`, item rendering, selection,
 * and error-message overrides. Imports flow one way — from `lib/`, never the
 * reverse.
 *
 * Selection opens the item in a new tab with `noopener,noreferrer` (AR-10);
 * Enter and click are identical because both route through the lib's single
 * selection path. The host page keeps its state.
 */
export function GithubAutocomplete({
  token,
  placeholder = DEFAULT_PLACEHOLDER,
  label = DEFAULT_LABEL,
}: GithubAutocompleteProps) {
  // Last combined total_count and the query it belongs to, reported by a
  // successful search. total_count is the footer's "Y"; the query drives the
  // `<mark>` echo in renderItem (the lib doesn't pass the query to renderItem).
  // Threaded out-of-band because the lib's fetcher must resolve a bare
  // GithubResult[] (AR-4). Held in state so the footer/highlight re-render once
  // results land; the update is idempotent-per-query so it can't loop.
  const [searchInfo, setSearchInfo] = useState<{ total: number; query: string }>({
    total: 0,
    query: '',
  })

  const fetchSuggestions = useMemo(
    () =>
      createFetchSuggestionsWithTotal((total, query, signal) => {
        // Drop a stale report: if a newer query already aborted this request,
        // its total/query must not overwrite the fresher state (mirrors the
        // hook's current-request guard).
        if (signal.aborted) return
        setSearchInfo({ total, query })
      }, token),
    [token],
  )

  const onSelect = useCallback((item: GithubResult) => {
    window.open(item.htmlUrl, '_blank', 'noopener,noreferrer')
  }, [])

  const renderItem = useCallback(
    (item: GithubResult): ReactNode => renderGithubItem(item, searchInfo.query),
    [searchInfo.query],
  )

  return (
    <Autocomplete<GithubResult>
      fetchSuggestions={fetchSuggestions}
      renderItem={renderItem}
      getItemKey={getItemKey}
      onSelect={onSelect}
      placeholder={placeholder}
      label={label}
      messages={{ error: describeAutocompleteError }}
      renderFooter={(context) => renderFooter(context, searchInfo.total)}
    />
  )
}

/**
 * Footer "X of Y · sorted A→Z" (AC 8). X = displayed (capped) count; Y = the
 * true API total when known, else falls back to X. Non-success states defer to
 * the lib's default footer (returning `undefined` keeps it).
 */
function renderFooter(context: AutocompleteFooterContext, totalCount: number): ReactNode {
  if (context.status !== 'success') return undefined
  const displayed = context.resultCount
  // The API total can lag the capped display in odd shape-drift cases; never
  // show "50 of 40". Clamp Y up to at least the displayed count.
  const total = Math.max(totalCount, displayed)
  return (
    <>
      <span>
        {displayed.toLocaleString('en-US')} of {total.toLocaleString('en-US')} · sorted A→Z
      </span>
      <span>↑↓ browse · ↵ open</span>
    </>
  )
}

// --- renderItem (design state 04) ---------------------------------------

/**
 * Renders one merged GitHub row per design state 04. Kinds are distinguished
 * three ways, never color alone: icon shape (avatar circle vs `{ }` tile), the
 * mono `owner/repo` path (repos only), and the right-aligned KIND label. The
 * query substring is echoed in the accent color via a `<mark>`.
 */
export function renderGithubItem(item: GithubResult, query: string): ReactNode {
  const icon =
    item.kind === 'user' ? (
      <span
        className={styles.avatar}
        style={item.avatarUrl ? { backgroundImage: `url("${cssUrl(item.avatarUrl)}")` } : undefined}
        aria-hidden="true"
      />
    ) : (
      <span className={styles.repoicon} aria-hidden="true">
        {'{ }'}
      </span>
    )

  // KIND label: organizations read "org"; users and repos keep their kind.
  const kindLabel = item.isOrganization ? 'org' : item.kind

  // "matches profile" hint: for user/org rows, when the query is not a
  // substring of the visible login, the match must be on a hidden profile
  // field (name/bio) the search API does not return — so we say so, turning an
  // apparently-random hit into an explained one. When the login does contain
  // the query, the <mark> highlight already shows it, so no hint is needed.
  const trimmedQuery = query.trim()
  const matchesProfile =
    item.kind === 'user' &&
    trimmedQuery !== '' &&
    !item.name.toLowerCase().includes(trimmedQuery.toLowerCase())

  return (
    <>
      {icon}
      <span className={styles.name}>
        <span>{highlightMatch(item.name, query)}</span>
        {item.kind === 'repo' && <span className={styles.path}>{item.displayPath}</span>}
        {matchesProfile && <span className={styles.secondary}>{MATCHES_PROFILE_HINT}</span>}
      </span>
      <span className={styles.kind}>{kindLabel}</span>
    </>
  )
}

/** Copy shown when a user matched on a hidden profile field, not the login. */
const MATCHES_PROFILE_HINT = 'matches profile'

/**
 * Splits `text` around the first case-insensitive occurrence of `query`,
 * wrapping the match in a `<mark>` (accent color). No match (or empty query) →
 * the plain text. Purely presentational; the underlying value is unchanged.
 */
function highlightMatch(text: string, query: string): ReactNode {
  const trimmed = query.trim()
  if (trimmed === '') return text
  const index = text.toLowerCase().indexOf(trimmed.toLowerCase())
  if (index === -1) return text
  const before = text.slice(0, index)
  const match = text.slice(index, index + trimmed.length)
  const after = text.slice(index + trimmed.length)
  return (
    <>
      {before}
      <mark className={styles.mark}>{match}</mark>
      {after}
    </>
  )
}

/** Escapes quotes/parens so an avatar URL can't break out of the CSS `url("…")`. */
function cssUrl(url: string): string {
  return url.replace(/["\\]/g, '\\$&').replace(/[()]/g, encodeURIComponent)
}

/**
 * A single GitHub search hit (user or repository) mapped to the slim domain
 * shape the autocomplete adapter renders and sorts. Raw API responses never
 * leave the client — only this shape does (AR-8 step 2, §3.3).
 */
export type GithubResult = {
  /** Discriminates users from repositories. */
  kind: 'user' | 'repo'
  /** GitHub item id, unique per kind. */
  id: number | string
  /**
   * Sort key (U3): the user `login` or the **bare** repository `name`
   * (never `owner/name`).
   */
  name: string
  /**
   * Display label: the user `login`, or `owner/name` (`full_name`) for a
   * repository.
   */
  displayPath: string
  /** Optional descriptive text; absent values are normalized to `undefined`. */
  description?: string
  /**
   * `true` when a user item is a GitHub organization (`type: "Organization"`),
   * so the row can label it `org` instead of `user`. Always `false` for
   * repositories and for regular users. (The search response carries `type`;
   * it does NOT carry the profile `name`/`bio`, so those cannot be shown here.)
   */
  isOrganization?: boolean
  /** Avatar image URL (the owner's avatar for repositories), when available. */
  avatarUrl?: string
  /** Web URL opened on selection (in a new tab, AR-10). */
  htmlUrl: string
}

/**
 * Every failure of the GitHub client, as a discriminated union (§3.3, AR-9).
 * Mapping happens in exactly one place (`githubClient.ts`); consumers switch
 * exhaustively on `kind`. Aborts are never mapped — cancellation is not an
 * error (AR-3).
 */
export type GithubSearchError =
  | { kind: 'network' } // fetch threw (offline, DNS, CORS)
  | { kind: 'http'; status: number } // non-2xx, not a rate limit
  | { kind: 'rate-limit'; retryAfterSeconds?: number } // 403 + rate-limit headers

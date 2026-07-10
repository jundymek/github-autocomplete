import { GithubAutocomplete } from '../../features/github-search/GithubAutocomplete'
import { Panel } from './Panel'

/**
 * Instance 01 (AC 3): the working GitHub instance. Renders the real, shipped
 * `GithubAutocomplete` (Story 2.3) against the live GitHub Search API,
 * unauthenticated — the demo passes no token. Keeps the default merge-purple
 * accent (the page `:root` `--ac-*` values).
 */
export function GithubPanel() {
  return (
    <Panel
      headingId="gh-h"
      badge="instance 01"
      title="GitHub users & repositories"
      sub={
        <>
          Live GitHub Search API, unauthenticated. Two parallel requests (
          <code>/search/users</code> + <code>/search/repositories</code>), merged and sorted
          client-side.
        </>
      }
    >
      <GithubAutocomplete />
    </Panel>
  )
}

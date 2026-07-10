import { GithubAutocomplete } from './features/github-search/GithubAutocomplete'

/**
 * Sandbox stage (NOT part of the reusable component). A minimal harness that
 * mounts the wired GithubAutocomplete so the component can be exercised in a
 * browser. The full demo page (layout, second data source, token input) is
 * Story 3.1; this is only enough to drive/verify Story 2.3.
 */
function App() {
  return (
    <main style={{ maxWidth: 560, margin: '64px auto', padding: '0 16px' }}>
      <h1>github-autocomplete</h1>
      <GithubAutocomplete />
    </main>
  )
}

export default App

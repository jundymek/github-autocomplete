import './demo/demo.css'

import { CountryPanel } from './demo/components/CountryPanel'
import { DemoFooter } from './demo/components/DemoFooter'
import { DemoHeader } from './demo/components/DemoHeader'
import { GithubPanel } from './demo/components/GithubPanel'

/**
 * The demo page (Story 3.1) — the sandbox stage, NOT part of the reusable
 * component. It composes the header/contract strip, a two-instance stage, and a
 * footer from `docs/design/demo-page.html`, and imports from both layers
 * (`lib/` and `features/`) to prove reusability by running code:
 *
 * - Instance 01 renders the real `GithubAutocomplete` (features layer).
 * - Instance 02 renders the SAME generic `Autocomplete<Country>` (lib layer)
 *   wired to a static country adapter and re-themed teal purely via `--ac-*`.
 *
 * Import direction holds: nothing in `lib/` or `features/` imports this file.
 */
function App() {
  return (
    <>
      <div className="wrap">
        <DemoHeader />
        <main className="stage">
          <GithubPanel />
          <CountryPanel />
        </main>
      </div>
      <DemoFooter />
    </>
  )
}

export default App

import { CONTRACT_FACTS, EYEBROW } from '../constants'

/**
 * The page header — "the thesis" from `docs/design/demo-page.html`: an eyebrow,
 * a two-line headline with the accent `github/*` path, a lede describing the
 * headless hook + generic view + adapters, and the four-fact contract strip.
 * Static, presentational.
 */
export function DemoHeader() {
  return (
    <header>
      <div className="eyebrow">{EYEBROW}</div>
      <h1>
        One autocomplete, any data.
        <br />
        Here: <span className="path">github/*</span>
      </h1>
      <p className="lede">
        A reusable, self-contained combobox built from scratch — a headless{' '}
        <code>useAutocomplete&lt;T&gt;</code> hook, a generic{' '}
        <code>&lt;Autocomplete&lt;T&gt;&gt;</code> view, and adapters. The left instance searches
        GitHub users and repositories; the right one proves the same core works with any data
        source and theme.
      </p>
      <div className="contract">
        {CONTRACT_FACTS.map((fact) => (
          <span key={fact}>{fact}</span>
        ))}
      </div>
    </header>
  )
}

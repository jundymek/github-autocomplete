import { GithubAutocomplete } from '../../features/github-search/GithubAutocomplete'

/**
 * A test-only host that wraps a real `GithubAutocomplete` in an
 * `overflow: hidden` ancestor (FR-7). It exists to prove — in a real browser —
 * that the dropdown, which renders through a React portal to `document.body`
 * (AR-7), escapes an overflow-clipping container and stays fully visible and
 * internally scrollable.
 *
 * It is gated behind `?clip=1` (see {@link isClippingHostRequested}) so it never
 * clutters the primary demo layout; the e2e clipping spec navigates to
 * `/?clip=1` and asserts against `[data-testid="clip-host"]`. The `overflow`
 * and small height are what make the clip real: were the popup rendered in-flow
 * it would be cut off here.
 */
export function ClippingHost() {
  return (
    <main className="stage" data-testid="clip-stage">
      <section className="panel" aria-labelledby="clip-h">
        <span className="badge">clip test</span>
        <h2 id="clip-h">Overflow-clipping host</h2>
        <p className="sub">
          A real GitHub instance inside an <code>overflow: hidden</code> box. The dropdown portals to{' '}
          <code>document.body</code>, so it escapes the clip and stays fully visible.
        </p>
        <div
          data-testid="clip-host"
          style={{ overflow: 'hidden', height: 120, border: '1px dashed var(--ac-color-border)' }}
        >
          <GithubAutocomplete />
        </div>
      </section>
    </main>
  )
}

/** True when the demo should render the clipping test host instead of the stage. */
export function isClippingHostRequested(search: string): boolean {
  return new URLSearchParams(search).get('clip') === '1'
}

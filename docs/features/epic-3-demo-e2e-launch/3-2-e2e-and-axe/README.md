# 3.2 — Playwright e2e smoke and axe accessibility scan

## What was built

A thin end-to-end layer over the Story 3.1 demo that proves the **browser-only**
realities the unit/RTL layers cannot: real new-tab opening, focus management,
outside-pointer dismissal, reopen-on-focus with a request-count proof, the
rendered rate-limit state, dropdown rendering inside an `overflow: hidden` host,
and a WAI-ARIA/axe accessibility scan. Every GitHub HTTP call is intercepted
with `page.route` returning deterministic fixtures — the real `api.github.com`
is never contacted (AR-12), so the suite is stable and rate-limit-proof.

The suite runs via `pnpm test:e2e` locally and in the existing Node-22 + pnpm CI
job (Playwright browsers cached); `playwright.config.ts`'s `webServer` builds and
previews the app (`pnpm build && pnpm preview`), reused locally
(`reuseExistingServer: !CI`).

## Files touched

- `e2e/fixtures/github.ts` — NEW — deterministic response bodies: a small
  users+repos set (known `html_url`s and a predictable A→Z order), a 50+50
  payload (cap + scroll), and a 403 rate-limit response. User items carry
  `type`/`name`/`bio` (Story 1.6): one `type: "Organization"` and one user whose
  login does **not** contain the query (so the "matches profile" hint fires).
- `e2e/helpers/mockGithub.ts` — NEW — registers `page.route` for both search
  endpoints from a chosen scenario (`small` | `big` | `rate-limit`) and exposes a
  live matched-request **counter** used by the reopen-no-refetch proof (AC 10).
- `e2e/helpers/autocomplete.ts` — NEW — shared locators/actions (the GitHub
  combobox, the portalled listbox/options, `searchAndAwaitResults`).
- `e2e/newtab.spec.ts` — NEW — AC 2 (merged A→Z order), AC 3 (ArrowDown×2 +
  Enter and mouse click both open the item `html_url` in a new tab; host keeps
  state), AC 11 (user match-context: display name/hint, `org` label, `<mark>`).
- `e2e/focus.spec.ts` — NEW — AC 7 (input keeps focus through ArrowUp/Down and
  after Escape; `aria-activedescendant`, not roving focus; query retained).
- `e2e/dismiss.spec.ts` — NEW — AC 9 (outside pointer press closes the dropdown,
  query retained).
- `e2e/reopen.spec.ts` — NEW — AC 10 (refocus reopens the same options with the
  matched-request count unchanged; a fresh input opens nothing).
- `e2e/ratelimit.spec.ts` — NEW — AC 4 (403 → dedicated rate-limit message,
  distinct from the generic "Search failed").
- `e2e/clipping.spec.ts` — NEW — AC 6 (dropdown escapes an `overflow: hidden`
  host via the portal and is fully visible; 50+50 → height-bounded + internally
  scrollable, no pagination).
- `e2e/a11y.spec.ts` — NEW — AC 5 (axe scan of closed / open-with-results /
  error states; zero `critical`/`serious` violations).
- `e2e/smoke.spec.ts` — REMOVED — the placeholder from 0.2; its "demo loads /
  both instances visible" assertion is subsumed by every spec's `goto` + combobox
  query, so keeping it would be duplication.
- `src/demo/components/ClippingHost.tsx` — NEW — a `?clip=1`-gated demo view that
  wraps a real `GithubAutocomplete` in an `overflow: hidden` box (see decision
  below).
- `src/App.tsx` — UPDATE — renders the compact `ClippingHost` when `?clip=1` is
  present, else the normal two-instance stage.
- `tsconfig.e2e.json` — NEW — dedicated TS project for `e2e/` using bundler
  resolution + `esModuleInterop` (Playwright transpiles specs itself, so the
  `nodenext` `.js`-extension rule and the `AxeBuilder` default-import friction
  don't apply). Referenced from `tsconfig.json`.
- `tsconfig.node.json` — UPDATE — dropped `e2e` from its `include` (now owned by
  `tsconfig.e2e.json`; it keeps the config files under `nodenext`).
- `tsconfig.json` — UPDATE — added the `tsconfig.e2e.json` project reference.

## Key decisions

- **`page.route` mocking, real API never called (AR-12).** Distinct from the
  Vitest/RTL layer (MSW node server). The helper fulfils both `/search/users*`
  and `/search/repositories*`; a per-run counter makes the no-refetch guarantee
  (AC 10) provable rather than inferred.
- **Full network isolation includes avatars.** User rows render `avatar_url` as a
  CSS `background-image`, which would otherwise fetch real bytes from
  `avatars.githubusercontent.com`. The helper also routes that host to a 1×1
  transparent GIF, and the new-tab spec stubs `https://github.com/*` (the item
  pages `window.open` targets). So no spec touches the network at all — the
  fixtures keep realistic URLs, but every byte is served locally.
- **Rate-limit fixture must expose CORS headers.** The client reads
  `x-ratelimit-remaining` / `retry-after` off the 403 to map it to
  `{ kind: 'rate-limit' }`. Those are **not** CORS-safelisted response headers,
  so a cross-origin request only exposes them to JS when the response carries
  `Access-Control-Expose-Headers` — which the real GitHub API does. The mock
  mirrors that (plus `Access-Control-Allow-Origin: *`); without it the 403
  mis-maps to a generic `http` error and the dedicated message never renders.
- **New-tab assertion without hitting the network.** `newtab.spec.ts` stubs
  `https://github.com/*` (the item pages) so the popup opened by
  `window.open(html_url, …)` resolves to a local stub — `popup.url()` reads the
  exact requested URL, with no external navigation or GitHub redirect. Enter and
  click route through the same selection path and open the identical URL.
- **Clipping host = a gated demo view (Option A).** Per the spec decision, the
  demo itself hosts the `overflow: hidden` wrapper rather than the test mounting
  its own page: it exercises the real shipped component in a realistic embed and
  doubles as a living FR-7 demonstration. It is gated behind `?clip=1` so it
  never clutters the primary layout, and in clip mode the page renders only the
  compact host (no tall header/footer) so the portalled dropdown sits within the
  viewport. Because the dropdown portals to `document.body` (AR-7) it escapes the
  clip — exactly what the spec proves.
- **Axe threshold (NFR-1).** Enforced bar is **zero `critical`/`serious`**
  violations across closed / open-with-results / error states (impact levels
  below serious are reported by axe but do not fail the build). This is the
  defensible, non-flaky interpretation of "no violations" for a WCAG 2.1 AA
  target; the current run is clean. An operator can tighten to zero-at-any-level
  by removing the impact filter in `a11y.spec.ts`. The axe scans run with
  `reducedMotion: 'reduce'` so the popup's 120ms fade-in can't blend the amber
  warning background mid-scan (the settled amber title contrast is ~4.52:1, just
  over AA; scanning mid-animation dropped it under). The component honors
  `prefers-reduced-motion: reduce`, so this reflects a real supported state, not a
  mask.

## What deliberately stays OUT of e2e (kept thin, SM-C1 / §3.6)

No debounce, min-char threshold, stale-request cancellation, or hook
state-machine transitions are re-tested here — those are fully covered by the
Vitest + RTL integration layer (Epics 1/2), and Stories 1.4/1.5 already have RTL
coverage of their close/reopen semantics. The e2e additions are single thin
assertions of the *browser-real* facet only (portal dismissal, no-network-on-
reopen, real new-tab, clipping, axe).

## Tests

- **e2e (Playwright, `pnpm test:e2e`):** 14 tests across 7 specs, all green
  locally; each maps to an AC as listed above. Chromium project; `webServer`
  builds + previews the app.
- **Mocking:** `page.route` only; no spec references `api.github.com` except
  through the mock. No unit/RTL tests were added or changed by this story.

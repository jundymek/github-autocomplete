# Story 3.2: Playwright e2e smoke and axe accessibility scan

Status: Done

baseline_commit: c482540e6cbd56bdbd43ebd42beb620cafaa9d40

## Story

As an evaluator,
I want a thin end-to-end layer verifying the browser-only realities,
so that new-tab opening, focus behavior, rate-limit messaging, clipping-container rendering, and
accessibility are proven in a real browser with deterministic mocks (FR-7, FR-9, FR-11, FR-18 e2e
layer; AR-12; NFR-1).

## Acceptance Criteria

1. **Deterministic mocking via `page.route` — the real GitHub API is never called (AR-12).** Every
   e2e spec intercepts `https://api.github.com/**` (both `/search/users` and `/search/repositories`)
   with `page.route`, fulfilling deterministic fixtures. No test hits the network. A shared fixtures
   module provides at least: a normal small result set, a 50+50 payload (for cap/scroll), and a 403
   rate-limit response (headers `x-ratelimit-remaining: 0` and/or `retry-after`).
2. **Typed query → mocked results appear sorted (FR-5 display, FR-18).** Spec `search.spec.ts` (or in
   `newtab.spec.ts` setup): type a ≥3-char query into the GitHub instance, and the dropdown opens
   showing the mocked users+repositories merged in case-insensitive A→Z order. Asserts the rendered
   option order matches the expected sorted sequence.
3. **ArrowDown×2 + Enter opens a new tab with the expected URL (FR-11, AR-10).** In `newtab.spec.ts`:
   after results render, press `ArrowDown` twice then `Enter`; assert a new page opens via
   `const [popup] = await Promise.all([context.waitForEvent('page'), page.keyboard.press('Enter')])`
   and `popup.url()` equals the highlighted item's `html_url` from the fixture. Assert the demo page
   retains its state (input value/URL unchanged). A parallel assertion covers **mouse click** opening
   the same URL identically.
4. **Rate-limit 403 route → dedicated message visible (FR-9, NFR-3).** In `ratelimit.spec.ts`: route
   the search endpoints to the 403 rate-limit fixture, type a qualifying query, and assert the
   dropdown shows the **dedicated rate-limit message** (text distinct from the generic error, e.g.
   mentioning throttling / when to retry), not a generic "something went wrong".
5. **Axe scan on the open-dropdown state reports zero critical/serious violations (NFR-1).** In
   `a11y.spec.ts`: using `@axe-core/playwright` (`new AxeBuilder({ page }).analyze()`), scan the demo
   page in the **open-dropdown-with-results** state (and, additionally, closed and error states) and
   assert **no violations of impact `critical` or `serious`**. (Minor/moderate may be reported but do
   not fail; the AC bar is zero critical/serious.)
6. **Dropdown renders correctly inside an `overflow: hidden` container (FR-7).** In `clipping.spec.ts`:
   the demo page includes a dedicated test host wrapper with `overflow: hidden` (see decision below);
   open the dropdown inside it and assert the open listbox is **fully visible** (its bounding box is
   not clipped by the wrapper — e.g. the last option is visible / within the viewport, proving the
   portal escapes the clip). With the 50+50 fixture, assert the dropdown is **height-bounded and
   internally scrollable** (bounded height, `scrollHeight > clientHeight`, no pagination controls).
7. **Focus stays on the input throughout keyboard navigation and after Escape (FR-12, AR-6).** In
   `focus.spec.ts` (or folded into `newtab`): assert the input remains the `document.activeElement`
   (or `:focus`) during ArrowDown/ArrowUp navigation and after pressing Escape (which also closes the
   dropdown while keeping the query text). Uses `aria-activedescendant`, not roving focus.
8. **`webServer` reuses `pnpm dev`/`preview`; suite runs green in CI and stays thin (AR-12, AR-13,
   FR-18, SM-C1).** `playwright.config.ts` boots the app via a `webServer` block that reuses the
   project's `pnpm dev` (or `pnpm preview` against a build) — no bespoke server. `pnpm test:e2e` runs
   the suite locally and in the Node-22 + pnpm CI job (browsers cached). Only browser-real behaviors
   live in `/e2e`; pure logic and component behavior stay in the Vitest/RTL layers per architecture
   §3.6.
9. **Outside-pointer press closes the open dropdown (Story 1.4, browser-real).** After results
   render, a `pointerdown`/click on the page **outside** both the component and the portalled popup
   closes the dropdown (`aria-expanded="false"`), keeping the query text in the input — while a click
   **inside** the popup (an option) still selects (already covered by AC 3). This is a genuinely
   browser-real dismissal path (portal + document-level listener) that RTL only approximates; assert
   it thinly (one open→outside-click→closed case). Do **not** re-test the hook's close semantics here.
   [Source: docs/implementation-artifacts/1-4-outside-click-dismiss.md]
10. **Reopen-on-focus shows existing results with NO new request (Story 1.5, browser-real).** After
    results render and the dropdown is closed (Escape or outside-click) with the query retained,
    re-focusing the input reopens the dropdown with the same options — and, crucially, **fires no new
    GitHub request**. This is asserted with the existing `page.route` interception by counting matched
    requests: the count is unchanged across the close→refocus cycle. Also assert that focusing a
    fresh/never-searched input opens nothing. (No-refetch is a browser-real guarantee that request
    counting proves far more convincingly than RTL.) [Source: docs/implementation-artifacts/1-5-reopen-on-focus.md]
11. **User rows reveal the match context; organizations are labeled (Story 1.6).** With a fixture whose
    user items carry `name`/`bio` and a `type`, the rendered user row shows the display name (or bio)
    secondary text, and an item with `type: "Organization"` reads `org` in the KIND column (not
    `user`). At least one fixture user matches the query **only** via `name` (not the login) so the
    highlighted match is visible in the secondary text. The A→Z sort assertion in AC 2 still holds
    (secondary text does not change the sort key). [Source: docs/implementation-artifacts/1-6-user-match-context.md]

## Tasks / Subtasks

- [x] Task 1 — Playwright config + webServer (AC: 1, 8)
  - [x] Ensure `playwright.config.ts` (from Story 0.2 harness) has a `webServer` reusing `pnpm dev` (or `pnpm preview` after `pnpm build`) with `reuseExistingServer: !process.env.CI`, the correct `baseURL`/port, and a reasonable timeout. Confirm `test:e2e` script exists.
  - [x] Confirm `@axe-core/playwright` is installed (from 0.2); if not, add it as a devDependency.
- [x] Task 2 — Deterministic fixtures + route helper (AC: 1, 11)
  - [x] `e2e/fixtures/github.ts`: export deterministic response bodies — a small users+repos set (with known `html_url`s and names to assert sort order), a 50-users + 50-repos payload, and a 403 rate-limit response (status 403, headers `x-ratelimit-remaining: 0`, `retry-after`, and a rate-limit body). **User items must include `name`, `bio`, and `type` fields (Story 1.6):** include at least one `type: "Organization"` item and at least one user whose `login` does **not** contain the query but whose `name` does, so the by-name match/highlight can be asserted.
  - [x] `e2e/helpers/mockGithub.ts`: a helper that registers `page.route('https://api.github.com/search/users*', …)` and `…/search/repositories*` returning a chosen fixture. Reused by every spec so the real API is never called. Expose a way to **count** matched requests (e.g. increment a counter in the route handler) so the reopen-no-refetch assertion (AC 10) can verify the count is unchanged across a close→refocus cycle.
- [x] Task 3 — search + new-tab + focus specs (AC: 2, 3, 7, 11)
  - [x] `e2e/newtab.spec.ts`: mock small fixture; type query; assert results render sorted (AC 2); ArrowDown×2 + Enter → `context.waitForEvent('page')`, assert `popup.url()` === expected `html_url`, and demo page state retained; a second case asserts mouse click opens the same URL. **Also assert (AC 11)** a user row shows its display name/bio secondary text, an `org`-kind row is labeled `org`, and a name-only match highlights in the secondary text.
  - [x] `e2e/focus.spec.ts`: assert the input keeps focus during ArrowUp/Down and after Escape (dropdown closes, query text remains).
- [x] Task 3b — dismissal + reopen specs (AC: 9, 10) — Stories 1.4 / 1.5
  - [x] `e2e/dismiss.spec.ts`: mock small fixture; open results; `pointerdown`/click on the page background (outside the component and popup); assert `aria-expanded="false"` and the query text is retained. Keep it to the outside-close path only (option-click selection is covered by AC 3); do not re-test the hook's close internals.
  - [x] `e2e/reopen.spec.ts` (or fold into `focus.spec.ts`): open results; close (Escape or outside-click); re-focus the input; assert the same options reappear with `aria-expanded="true"` **and the matched-request count from the route helper is unchanged** (no new GitHub request). Add a case: focusing a fresh (never-searched) input opens nothing.
- [x] Task 4 — rate-limit spec (AC: 4)
  - [x] `e2e/ratelimit.spec.ts`: route to the 403 rate-limit fixture; type a qualifying query; assert the dedicated rate-limit message is visible and distinct from the generic error text.
- [x] Task 5 — clipping spec (AC: 6)
  - [x] Decide & implement the `overflow: hidden` host (see Dev Notes decision). `e2e/clipping.spec.ts`: open the dropdown inside the clipping wrapper and assert full visibility (portal escapes the clip); with the 50+50 fixture assert bounded height + internal scroll + no pagination.
- [x] Task 6 — axe spec (AC: 5)
  - [x] `e2e/a11y.spec.ts`: scan closed, open-with-results, and error states with `AxeBuilder`; fail on any `critical`/`serious` violation. Filter/report minor+moderate without failing.
- [x] Task 7 — Documentation deliverables (see below)
- [x] Task 8 — Verify (AC: all)
  - [x] `pnpm test:e2e` green locally; confirm the CI `playwright test` stage passes on Node 22 + pnpm with browsers cached. Confirm no spec references `api.github.com` except through the `page.route` mocks.

## Documentation deliverables

Part of Definition of Done (see CLAUDE.md). Create the task documentation folder:
`docs/features/epic-3-demo-e2e-launch/3-2-e2e-and-axe/`

- **README.md** — required. Document the e2e suite: each spec and the FR it proves (search/sort,
  new-tab via `waitForEvent('page')`, rate-limit message, axe scan, clipping/scroll, focus), the
  `page.route` mocking strategy (real API never called), the fixtures, the `webServer` reuse of
  `pnpm dev`/`preview`, and the clipping-host decision (AC 6). Note what deliberately stays out of e2e
  (kept thin per §3.6).
- **MANUAL_TESTING.md** — not required (per epics.md): this story is fully automated verification;
  there is no separate human browser check beyond running `pnpm test:e2e`.
- **PERFORMANCE.md** — not required (test infrastructure, no runtime performance surface).

## Dev Notes

**Prerequisite & dependencies.** Runs against the demo page from Story 3.1 (both instances rendered)
and reuses the Playwright + `@axe-core/playwright` harness stood up in Story 0.2. Depends on 3.1 and
the 0.2 harness. **Also depends on the follow-up behaviors merged after 3.1:** Story 1.4
(outside-click dismissal), Story 1.5 (reopen-on-focus, no refetch), and Story 1.6 (user match-context
name/bio + org label) — AC 9/10/11 and the fixture shape (name/bio/type) cover these. Implement 3.2
only once 1.4/1.5/1.6 are merged, so the e2e reflects the shipped behavior.
[Source: docs/planning-artifacts/epics.md#Story 3.2 / #Story 3.1 / #Story 0.2;
docs/implementation-artifacts/1-4-outside-click-dismiss.md / 1-5-reopen-on-focus.md / 1-6-user-match-context.md]

**Branch & PR.** `story/3-2-e2e-and-axe` → `master`, squash. Commit e.g.
`test(3.2): add thin playwright e2e and axe scan`. **No AI attribution / no `Co-Authored-By`.** Codex
pre-PR review + security check; CI green before PR. [Source: CLAUDE.md#Working rules / #Story pipeline]

**Package manager is pnpm (NOT npm), Node 22.** Use `pnpm test:e2e`. E2E lives **top-level in `/e2e/`**,
outside `src/`, spec files `e2e/<flow>.spec.ts`. [Source: CLAUDE.md#Stack, architecture.md#3.1 / #3.2]

**Mock the API at the browser boundary with `page.route`, never the real API (AR-12).** All GitHub HTTP
in e2e is intercepted via `page.route('https://api.github.com/**', …)` returning deterministic fixtures —
this keeps CI rate-limit-proof and deterministic. Note this is distinct from the Vitest/RTL layer, which
uses **MSW node server mode** (also never fetch stubs); the two mocking mechanisms are level-appropriate.
[Source: architecture.md#AR-12 / #3.6, epics.md#Story 3.2]

**New-tab assertion pattern (AR-10, FR-11).** The adapter's `onSelect` calls
`window.open(html_url, '_blank', 'noopener,noreferrer')`; assert it in a real browser with
`context.waitForEvent('page')`. Enter (after ArrowDown×2) and mouse click must open the **same** URL
identically. Confirm the demo page keeps its state (the host page is not navigated).
[Source: architecture.md#AR-10, prd.md#FR-11 (Consequences), epics.md#Story 3.2]

**Rate-limit fixture shape (AR-9, FR-9).** The 403 must carry rate-limit headers so the adapter maps it
to `{ kind: 'rate-limit', retryAfterSeconds? }` (mapped in `githubClient.ts`, rendered as the dedicated
message by `GithubAutocomplete`, Story 2.3). Include `x-ratelimit-remaining: 0` (and/or `retry-after`) so
the retry hint can appear. Assert the visible text is distinct from the generic `http`/`network` error
messages. [Source: architecture.md#AR-9 / #3.3, epics.md#Story 2.3 / #Story 3.2, prd.md#FR-9]

**Axe threshold decision (NFR-1).** The epics AC says axe reports "no violations"; the task here fixes
the enforced bar at **zero `critical`/`serious`** violations across closed / open-with-results / error
states, which is the defensible, non-flaky interpretation for a WCAG 2.1 AA target (impact levels below
serious are reported for visibility but do not fail the build). If the run is clean at all levels, keep it
clean. Scan the **open-dropdown** state explicitly — that is where the combobox/listbox ARIA wiring
(AR-6) is live. `[ASSUMPTION: headless run — "no violations" enforced as zero critical/serious; documented
in README so the operator can tighten to zero-at-any-level if desired.]`
[Source: epics.md#Story 3.2 (axe AC), architecture.md#AR-6 / #3.5, prd.md#NFR-1]

**Clipping-host decision (FR-7) — DECIDE and STATE.** The clipping spec needs an `overflow: hidden`
ancestor around an autocomplete. **Decision: the demo page includes a dedicated, clearly-labelled test
host wrapper** (e.g. a small `<div style="overflow:hidden">` region wrapping one autocomplete instance,
or a query-param/`data-testid`-gated clipping demo section) rather than the e2e test mounting its own
page. Rationale: (a) it exercises the *real shipped demo* in a realistic embed, (b) it doubles as a
living demonstration of FR-7 for a human reviewer, and (c) Playwright cannot mount arbitrary React
without a harness page, so reusing the demo is simpler and truer. If a visible always-on clipping box is
undesirable in the main layout, gate it behind `?clip=1` (or a `data-testid` on a collapsed section) and
have the spec navigate there. State the final choice in the README. Because the dropdown renders through a
**React portal to `document.body`** (AR-7), it escapes the clip — that is exactly what this spec proves.
`[ASSUMPTION: headless run — demo hosts the clipping wrapper (option A), gated so it doesn't clutter the
primary layout.]` [Source: architecture.md#AR-7 (portal) / FR-7, epics.md#Story 3.2, prd.md#FR-7]

**`webServer` reuse (AR-13).** Configure Playwright's `webServer` to run the existing `pnpm dev`
(fast local) or `pnpm preview` after `pnpm build` (closer to production, good for CI). Prefer `preview`
in CI for a production-like base path once Story 3.3's Vite `base` env exists, but do not couple this
story to Pages config — a plain `pnpm dev`/`preview` at base `/` is correct here. Use
`reuseExistingServer: !process.env.CI`. [Source: architecture.md#AR-13, epics.md#Story 0.2 (harness)]

**Keep it thin (SM-C1, §3.6).** Only browser-real behaviors belong here: new-tab, focus, clipping/scroll,
axe, the rate-limit *rendered* state, and the three follow-up behaviors that are genuinely
browser-real — outside-pointer dismissal (1.4, portal + document listener), reopen-on-focus with
request-count proof (1.5), and user match-context rendering (1.6). Do NOT re-test
debounce/threshold/stale-cancellation/state transitions in e2e — those are covered by the Vitest+RTL
integration layer (Epic 1/2), and 1.4/1.5 already have full RTL coverage; the e2e additions here are
single thin assertions of the *browser-real* facet (portal dismissal; no-network-on-reopen), not a
re-run of the hook logic. Adding logic-level tests would violate the counter-metric.
[Source: architecture.md#3.6, prd.md#SM-C1, epics.md#Story 3.2]

### Project Structure Notes

- Specs in `e2e/`: `newtab.spec.ts`, `focus.spec.ts`, `dismiss.spec.ts`, `reopen.spec.ts`
  (the last two may fold into `focus.spec.ts` if kept thin), `ratelimit.spec.ts`, `clipping.spec.ts`,
  `a11y.spec.ts`; fixtures under `e2e/fixtures/`, helpers under `e2e/helpers/`.
  [Source: architecture.md#3.2 (e2e top-level) / #3.6 (e2e flows)]
- `playwright.config.ts` at repo root (from 0.2). CI stage `playwright test` from `ci.yml`.
  [Source: architecture.md#3.2 / #AR-13]

### References

- [Source: docs/planning-artifacts/epics.md#Story 3.2: Playwright e2e smoke and axe accessibility scan]
- [Source: docs/planning-artifacts/epics.md#Story 0.2 (harness) / #Story 2.3 (rate-limit render) / #Story 3.1 (demo target)]
- [Source: docs/planning-artifacts/architecture.md#AR-12 (testing, page.route) / #AR-13 (CI) / #AR-10 (new tab) / #AR-9 (error union) / #AR-7 (portal) / #AR-6 (ARIA) / #3.6 (level assignment)]
- [Source: docs/planning-artifacts/prds/prd-github-autocomplete-2026-07-09/prd.md#FR-7 / #FR-9 / #FR-11 / #FR-12 / #FR-18 / #NFR-1 / #SM-C1]
- [Source: CLAUDE.md#Working rules (thin e2e) / #Story pipeline]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context)

### Debug Log References

- Two follow-up debugging findings surfaced during the first e2e run (both fixed,
  no product-code change):
  1. **New-tab URL mismatch.** `popup.waitForLoadState` navigated the popup to the
     real GitHub page, so `popup.url()` reflected a redirect, not the requested
     `html_url`. Fixed by stubbing `https://github.com/*` in the newtab spec's
     context so the popup resolves to a local stub — the assertion reads the exact
     requested URL and the suite never touches the network (AR-12).
  2. **Rate-limit 403 mis-mapped to a generic error.** The client reads
     `x-ratelimit-remaining` / `retry-after`, which are not CORS-safelisted
     response headers; a cross-origin fetch only exposes them when the response
     sends `Access-Control-Expose-Headers`. Confirmed via an in-browser `fetch`
     probe (headers came back `null` until the header was added). Fixed by making
     the rate-limit fixture mirror the real API's CORS exposure headers.

### Completion Notes List

- Prerequisites verified on `master` before starting: `fix(1.4)`, `feat(1.5)`,
  and `feat(1.6)` (c482540) all present — AC 9/10/11 dependencies satisfied.
- Added 7 e2e specs (14 tests) covering AC 2–11's browser-real facets; removed the
  0.2 placeholder `smoke.spec.ts` (subsumed). Kept the suite thin per SM-C1 / §3.6
  — no hook logic (debounce/threshold/cancellation) is re-tested in e2e.
- All GitHub HTTP is mocked via `page.route` deterministic fixtures; a matched-
  request counter in the helper makes the reopen-no-refetch proof (AC 10) concrete.
- Clipping host implemented as a `?clip=1`-gated demo view (spec Option A); the
  portalled dropdown escapes the `overflow: hidden` clip (AR-7).
- Axe bar enforced at zero `critical`/`serious` across closed/open/error states
  (NFR-1); current run is clean.
- `e2e/` moved to its own `tsconfig.e2e.json` (bundler resolution + esModuleInterop)
  so the specs typecheck without `nodenext`'s `.js`-extension requirement.
- Full local verification green: `pnpm lint`, `pnpm typecheck`, `pnpm test`
  (205 passed), `pnpm test:e2e` (14 passed). CI already runs all four stages on
  Node 22 + pnpm with browsers cached (no CI changes needed).

### File List

- `e2e/fixtures/github.ts` (new)
- `e2e/helpers/mockGithub.ts` (new)
- `e2e/helpers/autocomplete.ts` (new)
- `e2e/newtab.spec.ts` (new)
- `e2e/focus.spec.ts` (new)
- `e2e/dismiss.spec.ts` (new)
- `e2e/reopen.spec.ts` (new)
- `e2e/ratelimit.spec.ts` (new)
- `e2e/clipping.spec.ts` (new)
- `e2e/a11y.spec.ts` (new)
- `e2e/smoke.spec.ts` (removed)
- `src/demo/components/ClippingHost.tsx` (new)
- `src/App.tsx` (updated — `?clip=1` clipping-host branch)
- `tsconfig.e2e.json` (new)
- `tsconfig.node.json` (updated — dropped `e2e` from include)
- `tsconfig.json` (updated — added e2e project reference)
- `docs/features/epic-3-demo-e2e-launch/3-2-e2e-and-axe/README.md` (new)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-10 | 1.1 | Added AC 9/10/11 and Task 3b + fixture updates to cover the follow-up behaviors merged after 3.1: outside-click dismissal (1.4), reopen-on-focus with no-refetch request-count proof (1.5), and user match-context name/bio + org label (1.6). Marked 1.4/1.5/1.6 as implementation prerequisites. | Łukasz (follow-up sync) |

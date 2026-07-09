# Story 0.2: Test harnesses and CI pipeline

Status: Approved

## Story

As a developer,
I want working unit/integration and e2e test harnesses wired into CI,
so that every subsequent story can ship tests as part of its Definition of Done and CI proves the
suite green on every push.

[Source: epics.md#Story 0.2: Test harnesses and CI pipeline]

## Acceptance Criteria

1. Vitest + React Testing Library + jsdom are configured with **MSW in node server mode** — a setup
   file starts/stops the MSW server around the suite; **fetch stubs are forbidden** (mock at the
   network boundary only). [AR-12, FR-18] [Source: architecture.md#AR-12, #3.6, prd.md#FR-18]
2. `pnpm test` (non-watch, CI-safe: `vitest run`) runs a trivial RTL render test **and** an
   MSW-intercepted fetch test, both passing; `pnpm test:watch` (`vitest`) is available for local use.
   [AR-12, FR-18] [Source: architecture.md#AR-12]
3. Fake-timer usage is proven by one example debounce-style test (the pattern later FR-2 tests
   reuse). [FR-2, FR-18] [Source: architecture.md#AR-3, #3.6, prd.md#FR-2]
4. Playwright is configured in `/e2e` with a trivial spec that boots the Vite dev/preview server (via
   Playwright `webServer` with `reuseExistingServer`) and passes via `pnpm test:e2e`;
   `@axe-core/playwright` is installed. [AR-12, FR-18] [Source: architecture.md#AR-12, #3.6]
5. A GitHub Actions workflow at `.github/workflows/ci.yml` runs on every push/PR to `master` and
   executes, **in order**, `lint` → `typecheck` (`tsc --noEmit`) → `vitest run` → `playwright test`
   on **Node 22 + pnpm**, with pnpm store cached and Playwright browsers cached; the job **fails if
   any stage fails**. [AR-13, FR-19] [Source: architecture.md#AR-13, prd.md#FR-19]

## Tasks / Subtasks

- [ ] Task 1 — Install + configure Vitest + RTL + jsdom (AC: 1, 2)
  - [ ] Add dev deps: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`,
        `@testing-library/user-event`, `jsdom`, `@vitejs/plugin-react`.
  - [ ] Create `vitest.config.ts` with `environment: 'jsdom'`, `globals: true`, the React plugin, and
        a `setupFiles` entry. Ensure test files are co-located (`**/*.test.ts(x)`) per §3.1.
        [Source: architecture.md#3.1, #3.6]
  - [ ] Create `vitest.setup.ts` importing `@testing-library/jest-dom` and wiring the MSW server
        lifecycle (see Task 2).
- [ ] Task 2 — MSW in node server mode (AC: 1) — **fetch stubs forbidden**
  - [ ] Add dev dep `msw` (**v2**). Create `src/test/msw/handlers.ts` exporting a handlers array using
        the **v2 API**: `import { http, HttpResponse } from 'msw'` and `http.get(url, () => ...)`.
        [Source: architecture.md#AR-12, #3.6]
  - [ ] Create `src/test/msw/server.ts`: `import { setupServer } from 'msw/node'` →
        `export const server = setupServer(...handlers)`.
  - [ ] In `vitest.setup.ts`: `server.listen({ onUnhandledRequest: 'error' })` in `beforeAll`,
        `server.resetHandlers()` in `afterEach`, `server.close()` in `afterAll`. The
        `onUnhandledRequest: 'error'` setting enforces the "no fetch stubs / all HTTP mocked at the
        boundary" rule. [Source: architecture.md#3.6]
- [ ] Task 3 — Example tests (AC: 2, 3) — placeholders, kept minimal
  - [ ] Add a trivial co-located RTL render test that mounts a sync component and asserts on the DOM
        (proves jsdom + RTL). [Source: epics.md#Story 0.2 Technical notes]
  - [ ] Add an MSW-intercepted `fetch` test: call `fetch(<mocked url>)` where `http.get` returns a
        JSON body, assert the parsed result (proves MSW node server intercepts real fetch — not a
        stub). [Source: architecture.md#3.6, prd.md#FR-18]
  - [ ] Add one **fake-timers** debounce-style example: `vi.useFakeTimers()`, schedule a debounced
        callback, `vi.advanceTimersByTime(300)`, assert it fired exactly once — the pattern FR-2 tests
        in Story 1.1 will reuse. [Source: architecture.md#AR-3, #3.6, prd.md#FR-2]
- [ ] Task 4 — Playwright + axe harness (AC: 4)
  - [ ] Add dev deps: `@playwright/test`, `@axe-core/playwright`; run `pnpm exec playwright install`
        (browsers). [Source: architecture.md#AR-12]
  - [ ] Create `playwright.config.ts` with `testDir: 'e2e'`, a `webServer` block that runs
        `pnpm preview` (or `pnpm dev`) with `reuseExistingServer: !process.env.CI` and the matching
        `baseURL`/port, so CI boots the server and local runs reuse a running one. [Source: architecture.md#AR-12, #3.6]
  - [ ] Add a trivial `e2e/smoke.spec.ts` that navigates to `baseURL` and asserts the placeholder page
        loads (real feature specs land in Story 3.2). [Source: epics.md#Story 0.2 Technical notes]
- [ ] Task 5 — Wire the scripts (AC: 2, 4)
  - [ ] Confirm/finalize `package.json`: `test` = `vitest run`, `test:watch` = `vitest`,
        `test:e2e` = `playwright test` (script names fixed in 0.1; now they actually work).
        [Source: architecture.md#AR-13, epics.md#Story 0.1]
- [ ] Task 6 — GitHub Actions CI (AC: 5)
  - [ ] Create `.github/workflows/ci.yml` triggered on `push` and `pull_request` to `master`.
  - [ ] Steps: checkout → `pnpm/action-setup` (pnpm 9) → `actions/setup-node@v4` with `node-version: 22`
        and `cache: 'pnpm'` → `pnpm install --frozen-lockfile` → cache Playwright browsers
        (`~/.cache/ms-playwright`, keyed on the Playwright version) → `pnpm exec playwright install
        --with-deps` (on cache miss) → run stages **in order**: `pnpm lint` → `pnpm typecheck` →
        `pnpm test` (`vitest run`) → `pnpm test:e2e` (`playwright test`). Any stage failure fails the
        job. [Source: architecture.md#AR-13, #3.6, prd.md#FR-19]
- [ ] Task 7 — Documentation deliverable (Definition of Done)
  - [ ] Create `docs/features/epic-0-foundation/0-2-test-harness-and-ci/README.md` (harness configs,
        the MSW node-server pattern + the no-fetch-stubs rule, the fake-timers pattern, the Playwright
        `webServer` setup, the CI stage order and caching). **No MANUAL_TESTING.md** (tooling only).
        PERFORMANCE.md is **not applicable**. [Source: CLAUDE.md, epics.md#Story 0.2]
- [ ] Task 8 — Verify
  - [ ] Run `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` locally; all green. Paste
        summaries into the Dev Agent Record. Confirm the CI workflow runs the same stages in order.

## Documentation deliverables

Part of Definition of Done (see CLAUDE.md). Create the task documentation folder:
`docs/features/epic-0-foundation/0-2-test-harness-and-ci/`

- **README.md** — required. Vitest/RTL/jsdom config, the MSW **v2** node-server pattern and the
  network-boundary rule (`onUnhandledRequest: 'error'`), the fake-timers example, the Playwright
  `webServer` config, and the CI job (stage order lint→typecheck→unit→e2e, pnpm + Playwright caches).
- **MANUAL_TESTING.md** — **not required** (pure test tooling; verification is the suites + CI green).
- **PERFORMANCE.md** — **not applicable** for 0.x. [Source: CLAUDE.md]

## Dev Notes

**Prerequisite:** Story 0.1 merged (Vite + React 19 + TS strict + pnpm + `eslint.config.js` + the
scripts contract + `e2e/` skeleton all exist). [Source: epics.md#Story 0.2 Dependencies]

**Branch & PR:** `story/0-2-test-harness-and-ci` → `master`, squash. Commit e.g.
`chore(0.2): add vitest/rtl/msw + playwright harnesses and CI`. No AI attribution. English only.
[Source: CLAUDE.md#Working rules, architecture.md#3.7]

**Testing architecture (AR-12 — do not substitute):** [Source: architecture.md#AR-12, #3.6]

- **Unit + integration:** Vitest + React Testing Library + **jsdom**, with **MSW in node server
  mode** intercepting HTTP at the **network boundary** — **never fetch stubs**. MSW is **v2**: the
  handler API is `http.get(...)` / `HttpResponse` (not the v1 `rest.get` / `res(ctx...)` API);
  `setupServer` imported from `msw/node`. Co-located `*.test.ts(x)`. **Fake timers** for debounce
  tests.
- **E2E:** Playwright in `/e2e` (top-level, outside `src/`), **thin** by design. The GitHub API is
  mocked via `page.route` in real e2e specs (Story 3.2) — **e2e never calls the real GitHub API**.
  Here only a trivial smoke spec is needed. `@axe-core/playwright` installed now for the Story 3.2
  a11y scan.

**Why `vitest run` for `test`:** CI calls `pnpm test` and must exit, not hang in watch mode; `test`
= `vitest run`, `test:watch` = `vitest`. [Source: architecture.md#AR-13]

**Playwright `webServer` (reuse):** configure `webServer` to launch `pnpm preview` (built app) with
`reuseExistingServer: !process.env.CI`. In CI the server is booted fresh; locally a running dev/preview
server is reused. Set `baseURL` to the same origin. [Source: architecture.md#AR-12]

**CI stage order (AR-13, FR-19) — fixed:** [Source: architecture.md#AR-13, prd.md#FR-19]

```
lint  →  typecheck (tsc --noEmit)  →  unit/integration (vitest run)  →  e2e (playwright test)
```

on **Node 22 + pnpm**, via `pnpm/action-setup` (pnpm 9) + `actions/setup-node@v4`
(`cache: 'pnpm'`), Playwright browsers cached (key on Playwright version), `--frozen-lockfile`
install. Splitting typecheck from lint catches strict-mode errors lint doesn't reach. Any stage
failure fails the job. The Pages **deploy** workflow (`pages.yml`) is a **separate** file and is
**Story 3.3 — not this story**. [Source: architecture.md#AR-14, epics.md#Story 3.3]

**Files this story creates:** `vitest.config.ts`, `vitest.setup.ts`, `src/test/msw/handlers.ts`,
`src/test/msw/server.ts`, an example RTL test, an example MSW-fetch test, an example fake-timers
test, `playwright.config.ts`, `e2e/smoke.spec.ts`, `.github/workflows/ci.yml`; touches
`package.json` (deps) + `pnpm-lock.yaml`. [Source: architecture.md#3.2]

**Out of scope:** no real feature tests (placeholders only, replaced by real ones in later stories);
no `--ac-*` tokens (0.3); no Pages deploy workflow (3.3); no real e2e specs (3.2).
[Source: epics.md#Story 0.2 Technical notes]

### Project Structure Notes

- E2E stays top-level in `e2e/`, outside `src/`, per §3.1/§3.2. Unit/integration tests are
  co-located. MSW server/handlers live under `src/test/msw/` and are shared by all integration tests
  going forward.

### References

- [Source: epics.md#Story 0.2: Test harnesses and CI pipeline]
- [Source: architecture.md#AR-12: Testing architecture — Vitest/RTL/MSW pyramid base, thin Playwright + axe top]
- [Source: architecture.md#AR-13: Lint, format & CI — GitHub Actions running lint, typecheck, unit, e2e]
- [Source: architecture.md#3.6 Testing conventions — what lives at which pyramid level]
- [Source: prd.md#FR-18 Meaningful automated test suite, #FR-19 Continuous integration]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-07-09 | 0.1 | Initial draft — story approved, ready for dev | Scrum Master (bmad-create-story) |

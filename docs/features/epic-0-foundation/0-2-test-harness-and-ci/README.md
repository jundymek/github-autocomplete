# 0.2 — Test harnesses and CI pipeline

## What was built

Working unit/integration and e2e test harnesses plus a GitHub Actions CI pipeline, so every
subsequent story can ship tests as part of its Definition of Done:

- **Vitest + React Testing Library + jsdom** for unit/integration tests, with co-located
  `*.test.ts(x)` files under `src/`.
- **MSW v2 in node server mode** intercepting HTTP at the network boundary (fetch stubs forbidden).
- Three minimal example tests proving the harness: an RTL render test, an MSW-intercepted real
  `fetch` test, and a fake-timers debounce test (the pattern Story 1.1's FR-2 tests reuse).
- **Playwright** in `e2e/` with a `webServer` that builds and serves the app, plus a trivial smoke
  spec. `@axe-core/playwright` is installed for the Story 3.2 a11y scan.
- **CI** (`.github/workflows/ci.yml`): lint → typecheck → unit/integration → e2e on Node 22 + pnpm 9.

## Files touched

- `vitest.config.ts` — NEW — jsdom environment, globals, React plugin, setup file, `src/**/*.test.{ts,tsx}` include.
- `vitest.setup.ts` — NEW — jest-dom matchers + MSW server lifecycle around the suite.
- `src/test/msw/handlers.ts` — NEW — shared MSW v2 handlers (`http.get` + `HttpResponse`); placeholder until epic 2.
- `src/test/msw/server.ts` — NEW — `setupServer(...handlers)` from `msw/node`.
- `src/App.test.tsx` — NEW — trivial RTL render test (proves jsdom + RTL).
- `src/test/msw/msw.test.ts` — NEW — real `fetch` intercepted by MSW (proves network-boundary mocking).
- `src/test/fake-timers.test.ts` — NEW — debounce-style fake-timers example.
- `playwright.config.ts` — NEW — `testDir: 'e2e'`, chromium project, `webServer` block.
- `e2e/smoke.spec.ts` — NEW — placeholder page loads (replaces `e2e/.gitkeep`).
- `.github/workflows/ci.yml` — NEW — the CI pipeline.
- `package.json` / `pnpm-lock.yaml` — UPDATE — test dev deps; `typecheck` script fixed (see below).
- `tsconfig.app.json` — UPDATE — vitest/jest-dom types, includes `vitest.setup.ts`.
- `tsconfig.node.json` — UPDATE — includes `vitest.config.ts`, `playwright.config.ts`, `e2e/`.

## Key decisions

- **`typecheck` changed from `tsc --noEmit` to `tsc -b --noEmit`** (deviation from the 0.1 scripts
  contract, same intent). The root `tsconfig.json` is solution-style (`files: []` + project
  references), so plain `tsc --noEmit` type-checked **zero files** — a silent no-op CI stage.
  `tsc -b --noEmit` checks all referenced projects. Verified by introducing missing test globals:
  the old script passed, the new one fails as expected.
- **MSW `onUnhandledRequest: 'error'`** enforces the no-fetch-stubs rule mechanically: any HTTP
  request a test makes without a registered handler fails the suite.
- **Playwright `webServer` runs `pnpm build && pnpm preview --port 4173 --strictPort`** — e2e runs
  against the production build. `reuseExistingServer: !process.env.CI` lets local runs reuse an
  already-running preview server while CI always boots fresh.
- **Chromium only** for now — the thin e2e layer (AR-12) doesn't justify a cross-browser matrix;
  this also keeps the CI browser cache small.

## How it works

### MSW node-server pattern (the rule for all integration tests)

`vitest.setup.ts` starts one MSW server per test process:

```ts
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

Tests mock HTTP by registering MSW v2 handlers (`http.get(url, () => HttpResponse.json(...))`) —
never by stubbing `fetch`. Per-test overrides go through `server.use(...)`, reset automatically
after each test.

### Fake-timers pattern (for debounce logic)

`vi.useFakeTimers()` in `beforeEach`, `vi.useRealTimers()` in `afterEach`,
`vi.advanceTimersByTime(ms)` to step time deterministically. See `src/test/fake-timers.test.ts`.

### CI (`.github/workflows/ci.yml`)

Runs on every push/PR to `master`, single job on `ubuntu-latest`, `permissions: contents: read`:

1. `pnpm/action-setup` (pnpm 9) → `actions/setup-node@v4` (Node 22, pnpm store cached).
2. `pnpm install --frozen-lockfile`.
3. Playwright browsers cached at `~/.cache/ms-playwright`, keyed on OS + the installed
   `@playwright/test` version; `playwright install --with-deps chromium` on cache miss
   (`install-deps` only on a hit — system libs are not cached).
4. Stages in fixed order, any failure fails the job:
   `pnpm lint` → `pnpm typecheck` → `pnpm test` (vitest run) → `pnpm test:e2e` (playwright test).

The Pages deploy workflow is separate and lands in Story 3.3.

## Tests

- Unit/integration: `pnpm test` — 3 example tests (RTL render, MSW fetch interception, fake-timers
  debounce) proving each harness capability; real feature tests land with their stories.
- E2E: `pnpm test:e2e` — one smoke spec (placeholder page loads); real specs land in Story 3.2.
- Manual: not required (pure test tooling; verification is the suites + CI green).

# 3.3 — README and GitHub Pages deployment

## What was built

The evaluator-facing root `README.md` and the GitHub Pages deployment pipeline — the launch story.
The README covers: what the project is + live demo link, a verbatim-runnable quick start (pnpm,
Node 22), the full component API (`Autocomplete<T>` props, `useAutocomplete<T>` contract, the
`--ac-*` token table), the three-layer architecture with the ESLint-enforced import rule, the
D1–D5 decisions with rationale, the testing pyramid, the rate-limit + optional-token note, the
deployment description, and the release checklist.

## Files touched

- `README.md` — NEW — root README, the evaluator's entry point.
- `vite.config.ts` — UPDATE — `base: process.env.VITE_BASE ?? '/'` so only the Pages build uses
  the `/github-autocomplete/` sub-path; local dev/preview/e2e keep `/`.
- `.github/workflows/pages.yml` — NEW — build job (pnpm, Node 22, `VITE_BASE=/github-autocomplete/`,
  `actions/configure-pages` + `upload-pages-artifact`) and deploy job (`actions/deploy-pages`,
  `github-pages` environment, `pages: write` + `id-token: write` OIDC permissions), triggered on
  push to `master` and manually via `workflow_dispatch`. Separate from `ci.yml`; runs no tests —
  CI already gates the branch.

## Key decisions

- **Base path via env only.** The repo sub-path is never hardcoded in `vite.config.ts`; the
  workflow injects `VITE_BASE`. This keeps every local flow (dev, preview, Playwright webServer)
  on base `/` with zero conditional logic.
- **No tests in `pages.yml`.** CI (`ci.yml`) runs the full suite on every push to `master`; the
  Pages workflow only builds and publishes, keeping deploys fast and non-redundant.
- **Token table reproduced 1:1** from `src/lib/autocomplete/tokens.css` / `docs/design/design-tokens.md`
  (names, purposes, fallbacks) rather than paraphrased.
- **Vercel documented, not chosen** (AR-14): Pages keeps repo + CI + demo on one platform with no
  extra account for the evaluator.

## How it works

GitHub project pages serve at `https://<user>.github.io/<repo>/`, so built asset URLs must be
prefixed with the repo sub-path. Vite's `base` option does exactly that at build time; reading it
from `process.env.VITE_BASE` scopes the prefix to the Pages workflow. The deploy uses the official
OIDC flow: the build job uploads `dist/` as a Pages artifact and the deploy job publishes it to
the `github-pages` environment — no `gh-pages` branch, no deploy token.

## Release checklist (release-step actions, not CI)

Tracked in the root README; executed by the operator at release time:

1. Make the repository public.
2. Enable Pages (Settings → Pages → Source: **GitHub Actions**); confirm the first deploy is green.
3. Confirm the live URL serves both demo instances (it is already linked in the README).
4. Confirm CI is green on `master`.

## Tests

- No new automated tests: this story ships docs and CI/deploy config. Existing full suite
  (lint, typecheck, unit/integration, e2e) re-run green; `pnpm build` verified at base `/` and
  with `VITE_BASE=/github-autocomplete/` (asset URLs carry the sub-path).
- Manual: see MANUAL_TESTING.md — verifying the live artifact is a human release-time check.

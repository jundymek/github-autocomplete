# Story 3.3: README and GitHub Pages deployment

Status: Approved

## Story

As an evaluator,
I want a README that gets me from clone to running demo and green tests in minutes, plus a live
deployed demo,
so that I can verify every brief requirement without prior context or configuration (FR-19; AR-14;
NFR-6; SM-1, SM-2).

## Acceptance Criteria

1. **Root `README.md` — "what it is" + live demo link (FR-19, SM-2).** The root README opens with a
   one-paragraph statement of what the project is (a reusable, self-contained React + TypeScript
   autocomplete searching GitHub users & repositories; a recruitment quality deliverable) and a
   **live demo link** to the GitHub Pages URL (a placeholder until AC 8 fills it, e.g.
   `https://<user>.github.io/github-autocomplete/`).
2. **Quick start with the pnpm command matrix (FR-19, SM-2).** A quick-start section documents,
   verbatim-runnable on a clean clone: `pnpm install`, `pnpm dev` (starts the demo), and the test
   matrix — `pnpm lint`, `pnpm typecheck`, `pnpm test` (unit/integration), `pnpm test:e2e` (Playwright)
   — plus Node 22 / pnpm prerequisites.
3. **Component API table (AR-4 props + `useAutocomplete` options + `--ac-*` token table) (FR-19).** The
   README documents the public surface: a props table for `Autocomplete<T>` (`fetchSuggestions`,
   `renderItem`, `getItemKey`, `onSelect`, optional `placeholder`, `label`, state-message overrides,
   `minChars`, `debounceMs`), a `useAutocomplete<T>` options + returned `{ state, handlers }` summary,
   and the **`--ac-*` theming token table** (name, purpose, fallback) sourced from Story 0.3 / 1.3.
4. **Architecture sketch — three layers + the import rule (AR-2).** The README sketches the three-layer
   architecture (`src/lib/autocomplete/` generic ← `src/features/github-search/` adapter ← demo/app)
   and states the one-way import rule (`lib/` never imports from `features/` or app), noting it is
   ESLint-enforced.
5. **"Decisions" section summarizing D1–D5 (PRD §decisions + architecture.md) (FR-19, SM-1).** A
   Decisions section records, one paragraph of rationale each: **D1** (the interpretation of "limited
   to 50 per request" — `per_page=50` per API call + combined list trimmed to ≤50); **D2** (partial
   failure → full error state, never partial results / all-or-nothing); **D3** (ordering key = **bare**
   repository name and user login, not `owner/name`, though display may show `owner/name`); **D4**
   (dropdown via **React portal** to `document.body` so it survives `overflow: hidden` hosts, with the
   documented in-place fallback); **D5** (no pagination / infinite scroll — the cap is a bound, not
   paging; full alphabetical order needs the whole set up front). `[ASSUMPTION: D1–D5 map to the PRD's
   resolved questions/decisions (D2/D5 in §5 Non-Goals & §9) and architecture AR-7/AR-8; see Dev
   Notes.]`
6. **Testing-strategy pyramid description (FR-18, FR-19).** The README describes the three-layer test
   pyramid: Vitest unit (pure merge/sort/cap, error mapping), Vitest + RTL + jsdom + MSW integration
   (component behavior, all states, keyboard/ARIA), and thin Playwright + axe e2e (new-tab, focus,
   clipping, rate-limit render, a11y) — with the command for each.
7. **Rate-limit + optional token note (FR-16, NFR-6).** The README explains the GitHub unauthenticated
   rate limit (~10 requests/min unauthenticated for the Search API) and documents the **optional**
   `VITE_GITHUB_TOKEN` mechanism to raise it — via `.env.local` (gitignored) from `.env.example` — with
   an explicit **never-commit-a-token** note.
8. **GitHub Pages workflow deploys the static build with the correct base path (AR-14).** A
   `.github/workflows/pages.yml` (separate from `ci.yml`) builds the Vite app with
   **`VITE_BASE=/github-autocomplete/`** and deploys via `actions/deploy-pages` (with
   `actions/upload-pages-artifact`, `actions/configure-pages`, correct `permissions: pages: write` +
   `id-token: write` and the `github-pages` environment) on `master`. `vite.config.ts` reads
   `base` from the env (`base: process.env.VITE_BASE ?? '/'`) so **local dev keeps base `/`** and only
   the Pages build uses the repo sub-path.
9. **Release checklist: public repo + live demo URL (FR-19, SM-2).** The README (and/or the task doc)
   includes a **release checklist** stating that (a) the repository is **public** and (b) the deployed
   demo URL is **live and serves both instances**, linked from the README. These two items are executed
   by the **release step** (making the repo public, first successful Pages deploy, pasting the real
   URL) — **not necessarily by CI** — and are checked off at release time. CI green on the public
   default branch is also part of the checklist (FR-19).

## Tasks / Subtasks

- [ ] Task 1 — Root README content (AC: 1, 2, 3, 4, 6, 7)
  - [ ] Write/extend the root `README.md`: intro + live-demo link placeholder; quick start (pnpm install/dev + lint/typecheck/test/test:e2e matrix, Node 22); component API tables (`Autocomplete<T>` props, `useAutocomplete<T>` options + `{ state, handlers }`, `--ac-*` token table from 0.3/1.3); three-layer architecture sketch + import rule; testing-pyramid section; rate-limit + `VITE_GITHUB_TOKEN` note with never-commit warning.
  - [ ] Ensure every command and relative link resolves on a clean clone.
- [ ] Task 2 — Decisions section (AC: 5)
  - [ ] Add a "Decisions" section summarizing D1–D5 with a one-paragraph rationale each, sourced from PRD §5/§9 and architecture AR-7/AR-8. Optionally mention Vercel as the documented-not-chosen deploy alternative (AR-14).
- [ ] Task 3 — Vite base from env (AC: 8)
  - [ ] Update `vite.config.ts` to `base: process.env.VITE_BASE ?? '/'` (env only; do not hardcode the repo path). Confirm local `pnpm dev`/`pnpm build` still default to base `/`.
- [ ] Task 4 — GitHub Pages workflow (AC: 8)
  - [ ] Create `.github/workflows/pages.yml` triggered on push to `master` (+ `workflow_dispatch`): checkout → pnpm/action-setup + setup-node (Node 22, cache) → `pnpm install --frozen-lockfile` → `VITE_BASE=/github-autocomplete/ pnpm build` → `actions/configure-pages` → `actions/upload-pages-artifact` (`dist/`) → `actions/deploy-pages`. Set `permissions: { contents: read, pages: write, id-token: write }`, `concurrency`, and the `github-pages` environment. Keep it separate from `ci.yml`.
- [ ] Task 5 — Release checklist (AC: 9)
  - [ ] Add a release checklist (README or task README): repo made public; Pages enabled + first deploy green; real demo URL pasted into the README live-demo link; CI green on `master`. Mark these as release-step actions.
- [ ] Task 6 — Documentation deliverables (see below)
- [ ] Task 7 — Verify (AC: all)
  - [ ] `pnpm build` succeeds locally at base `/`; simulate the Pages build with `VITE_BASE=/github-autocomplete/ pnpm build` and confirm asset URLs carry the sub-path. Markdown renders; links resolve. (The live-URL check is a human release step — see MANUAL_TESTING.md.)

## Documentation deliverables

Part of Definition of Done (see CLAUDE.md). Create the task documentation folder:
`docs/features/epic-3-demo-e2e-launch/3-3-readme-and-deploy/`

- **README.md** — required (the per-task doc, distinct from the root `README.md` this story writes).
  Document what the root README now covers, the Vite `base`-from-env mechanism, the `pages.yml`
  workflow, and the release checklist / what is deferred to the release step.
- **MANUAL_TESTING.md** — **required** (per epics.md): verifying the **live** artifact is a human check.
  Cover: visit the deployed Pages URL, run a search in the GitHub instance, open a result (new tab),
  use the country instance, and confirm both instances load under the `/github-autocomplete/` base
  path (assets resolve, no 404s).
- **PERFORMANCE.md** — not required (docs + CI/deploy config; no runtime performance surface).

## Dev Notes

**Prerequisite & dependencies.** Depends on Story 3.1 (demo to deploy) and 3.2 (e2e green), and
documents/deploys the finished whole. Ideally the last story of the project. [Source:
docs/planning-artifacts/epics.md#Story 3.3 / #Story 3.1 / #Story 3.2]

**Branch & PR.** `story/3-3-readme-and-deploy` → `master`, squash. Commit e.g.
`docs(3.3): add readme and github pages deployment` (workflow addition may be `ci(3.3): …`). **No AI
attribution / no `Co-Authored-By`.** Codex pre-PR review + security check (secrets: confirm no token
committed); CI green before PR. [Source: CLAUDE.md#Working rules / #Story pipeline]

**Package manager is pnpm (NOT npm), Node 22.** All documented commands use pnpm. The Pages workflow
uses `pnpm/action-setup` + `actions/setup-node` with Node 22 and `--frozen-lockfile`. [Source:
CLAUDE.md#Stack, architecture.md#AR-1 / #AR-13]

**Vite `base` via env ONLY, in the Pages workflow (AR-14).** GitHub project pages serve under
`https://<user>.github.io/<repo>/`, so the built assets need `base` set to the repo sub-path. Set it
**only** through `VITE_BASE` in `pages.yml`; `vite.config.ts` defaults to `/` so local dev, `pnpm dev`,
and the e2e `webServer` (Story 3.2) are unaffected. Do not hardcode the repo path in `vite.config.ts`.
`[ASSUMPTION: repo name is `github-autocomplete`, served at `/github-autocomplete/`; if the actual repo
slug differs, update `VITE_BASE` and the README link accordingly.]` [Source: architecture.md#AR-14,
epics.md#Story 3.3]

**Pages workflow shape (AR-14, AR-13).** Use the official `actions/deploy-pages` flow: a build job
producing the `dist/` artifact (`actions/upload-pages-artifact`) and a deploy job with the
`github-pages` environment and `id-token: write` for OIDC. Keep `pages.yml` **separate** from `ci.yml`
(CI runs lint/typecheck/unit/e2e on every push/PR; Pages deploys on `master`). Do not run tests inside
`pages.yml` — CI already gates the branch. [Source: architecture.md#AR-14 / #AR-13 / #3.2]

**Decisions D1–D5 — sources to summarize (AC 5).** Map and cite:
- **D1** (50-per-request interpretation): PRD §4.2 documented-interpretation note + §9 Resolved Q1;
  architecture AR-8 step 3 (trim to 50).
- **D2** (partial failure = full error, all-or-nothing): PRD FR-4 Consequences + §9 Resolved Q2;
  architecture AR-8 step 4 (`Promise.all`).
- **D3** (bare repository name ordering key): PRD FR-5 + §9 Resolved Q3; architecture AR-8 step 2.
- **D4** (React portal for `overflow: hidden` correctness, with fallback): architecture AR-7; PRD FR-7.
- **D5** (no pagination / infinite scroll): PRD §5 Non-Goals ("No pagination or infinite scroll —
  deliberate", labelled D5) + §6.2.
One paragraph of rationale each; don't duplicate the full text, summarize + link. [Source:
prd.md#§4.2 / #§5 / #§9, architecture.md#AR-7 / #AR-8]

**Rate-limit + token wording (FR-16, NFR-6).** State the unauthenticated GitHub Search API limit
(~10 requests/minute unauthenticated) and that an **optional** `VITE_GITHUB_TOKEN` (personal access
token) raises it. Document supplying it via `.env.local` copied from `.env.example` (both gitignored /
value-less), sent as `Authorization: Bearer <token>` by the client (Story 2.1). **Explicitly** state no
token is ever committed (NFR-6). [Source: architecture.md#AR-9 (optional token) / #3.7 (secret hygiene),
prd.md#FR-16 / #NFR-6, epics.md#Story 2.1]

**Component API table sources (AC 3).** Props of `Autocomplete<T>` per AR-4; hook `{ state, handlers }`
contract per architecture §3.4; the `--ac-*` token names/purposes/fallbacks per `docs/design/
design-tokens.md` and the lib token map from Story 0.3 (documented again next to `Autocomplete.module.css`
in 1.3). Reproduce the token table faithfully. [Source: architecture.md#AR-4 / #3.4, design-tokens.md,
epics.md#Story 0.3 / #Story 1.3]

**Release checklist is a release-step action, not CI (AC 9).** Making the repo public, enabling Pages,
the first successful deploy, and pasting the live URL into the README are performed at release time by
the operator, then checked off — CI does not (and cannot) make the repo public. The checklist records
them so nothing is missed; CI's role is only the green-on-`master` item. [Source: epics.md#Story 3.3
(AC), prd.md#FR-19 / #SM-2]

### Project Structure Notes

- Root `README.md` (the evaluator's entry point). `.github/workflows/pages.yml` (new, separate from
  `ci.yml`). `vite.config.ts` (UPDATE — `base` from env). [Source: architecture.md#3.2 File layout]
- `.env.example` already documents `VITE_GITHUB_TOKEN=` (Story 0.1); reference it, do not add a value.
  [Source: epics.md#Story 0.1, architecture.md#3.2]

### References

- [Source: docs/planning-artifacts/epics.md#Story 3.3: README and GitHub Pages deployment]
- [Source: docs/planning-artifacts/epics.md#Story 0.1 (.env.example) / #Story 0.3 & #1.3 (token table) / #Story 2.1 (token) / #Story 3.1 & #3.2 (deployed whole)]
- [Source: docs/planning-artifacts/architecture.md#AR-14 (Pages + Vite base env) / #AR-13 (CI) / #AR-4 (props) / #AR-7 (portal, D4) / #AR-8 (merge/sort/cap, D1–D3) / #AR-9 (token) / #3.2 / #3.4 / #3.7]
- [Source: docs/planning-artifacts/prds/prd-github-autocomplete-2026-07-09/prd.md#FR-16 / #FR-18 / #FR-19 / #NFR-6 / #§4.2 / #§5 Non-Goals (D5) / #§9 Resolved Questions / #SM-1 / #SM-2]
- [Source: docs/design/design-tokens.md — `--ac-*` token table]
- [Source: CLAUDE.md#Stack / #Working rules / #Documentation deliverables]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|

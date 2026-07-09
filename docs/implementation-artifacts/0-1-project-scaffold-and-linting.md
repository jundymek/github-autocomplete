# Story 0.1: Project scaffold, linting, and boundary rule

Status: Ready for Review

## Story

As a developer,
I want a Vite + React 19 + TypeScript strict project with linting, formatting, and the
lib-boundary rule in place,
so that all feature work starts type-safe, consistently formatted, and mechanically prevented
from violating the reusable-component isolation.

[Source: epics.md#Story 0.1: Project scaffold, linting, and boundary rule]

## Acceptance Criteria

1. The project is scaffolded with the Vite `react-ts` template on **pnpm**; `tsconfig` has
   `strict: true`; `pnpm build` succeeds; Node 22 is pinned via `engines` and `.nvmrc`.
   [FR-13, NFR-4, AR-1] [Source: architecture.md#AR-1, epics.md#Story 0.1]
2. `pnpm-lock.yaml` is committed, and the dependency manifest contains **no**
   autocomplete/combobox/component-library package **and no** state-management library.
   [FR-13, AR-1] [Source: prd.md#FR-13, architecture.md#AR-1]
3. ESLint 9 flat config (`eslint.config.js`) with `typescript-eslint` and `react-hooks` passes via
   `pnpm lint`; Prettier is configured for formatting with **no style rules in ESLint** (they must
   not fight). [AR-13, NFR-4] [Source: architecture.md#AR-13]
4. A `no-restricted-imports` ESLint rule scoped to `src/lib/**` forbids imports from
   `src/features/**` and app/demo files, verified by a deliberately failing example being caught by
   `pnpm lint` (then removed/kept as a documented negative fixture). [AR-2, NFR-5]
   [Source: architecture.md#AR-2, prd.md#NFR-5]
5. The directory skeleton exists — `src/lib/autocomplete/`, `src/features/github-search/`,
   `src/demo/`, `e2e/` — per architecture §3.2. [AR-2] [Source: architecture.md#3.2]
6. `.env.example` documents `VITE_GITHUB_TOKEN=` with **no real value**; `.env.local`, `_bmad/`,
   and `.claude/` are gitignored. [FR-16, NFR-6] [Source: architecture.md#AR-9, prd.md#NFR-6, CLAUDE.md]
7. The `pnpm` scripts contract exists in `package.json`: `dev`, `build`, `preview`, `lint`,
   `typecheck`, `test`, `test:watch`, `test:e2e`, `format` (the harness-specific ones — `test`,
   `test:watch`, `test:e2e` — may be stubbed here and are fully wired in Story 0.2). [AR-13, FR-18, FR-19]
   [Source: architecture.md#AR-13, epics.md#Story 0.2]

## Tasks / Subtasks

- [x] Task 1 — Bootstrap the Vite React + TypeScript project on pnpm (AC: 1, 2)
  - [x] From a clean repo, scaffold with the Vite `react-ts` template:
        `pnpm create vite@latest . --template react-ts` (scaffold into a temp dir and merge if the
        repo is non-empty, keeping existing `docs/`, `_bmad/`, `.claude/`, `README.md`, `.gitignore`).
  - [x] Confirm Vite is **7.x** and React is **19.x** in `package.json`; align if the template
        installs a different major. [Source: architecture.md#AR-1]
  - [x] Run `pnpm install` and commit `pnpm-lock.yaml`.
  - [x] Verify the dependency manifest contains **no** autocomplete/combobox/component library and
        **no** state-management library (grep `package.json` deps — nothing like `downshift`,
        `react-select`, `@headlessui/*`, `@mui/*`, `redux`, `zustand`, `jotai`, `recoil`). [FR-13]
- [x] Task 2 — Strip the template down to a strict, minimal placeholder stage (AC: 1)
  - [x] Remove Vite demo cruft (default logos/SVGs, counter demo in `App.tsx`, demo CSS). Keep
        `App.tsx` as a minimal placeholder heading — **no component code yet** (per epics §Technical
        notes). [Source: epics.md#Story 0.1]
  - [x] Confirm `tsconfig.json` (and `tsconfig.app.json`) has `"strict": true`. Vite's template sets
        it; verify explicitly. [Source: architecture.md#AR-1]
- [x] Task 3 — Pin the runtime (AC: 1)
  - [x] Add `.nvmrc` with `22`.
  - [x] Add `"engines": { "node": ">=22", "pnpm": ">=9" }` to `package.json`. [Source: architecture.md#AR-1]
- [x] Task 4 — ESLint 9 flat config + Prettier (AC: 3)
  - [x] Create `eslint.config.js` (flat config) wiring `@eslint/js`, `typescript-eslint`, and
        `eslint-plugin-react-hooks`. No legacy `.eslintrc`. [Source: architecture.md#AR-13]
  - [x] Add Prettier (`prettier` + `.prettierrc`) and `eslint-config-prettier` so ESLint carries no
        stylistic rules. Add a `.prettierignore` (exclude `docs/`, lockfile, build output). [Source: architecture.md#AR-13]
  - [x] Confirm `pnpm lint` passes clean.
- [x] Task 5 — The lib-boundary rule (AC: 4)
  - [x] In `eslint.config.js`, add a `no-restricted-imports` override **scoped to `src/lib/**`**
        forbidding import patterns matching `**/features/**`, `**/features/*`, and app/demo files
        (`**/App`, `**/main`, `**/demo/**`). Message must explain the AR-2 one-way import rule.
        [Source: architecture.md#AR-2, CLAUDE.md#Architecture boundary]
  - [x] **Prove the rule fires:** temporarily add an import from `src/features/**` inside a file
        under `src/lib/autocomplete/`, run `pnpm lint`, confirm it errors, then revert. Record the
        error output in the Dev Agent Record / README. (A permanent negative fixture is optional.)
- [x] Task 6 — Directory skeleton (AC: 5)
  - [x] Create `src/lib/autocomplete/`, `src/features/github-search/`, `src/demo/`, `e2e/` (with a
        `.gitkeep` where empty). Layout must match architecture §3.2 exactly. [Source: architecture.md#3.2]
- [x] Task 7 — Environment + secret hygiene (AC: 6)
  - [x] Create `.env.example` containing `VITE_GITHUB_TOKEN=` and a comment: optional, never commit a
        real token. [Source: architecture.md#AR-9, prd.md#FR-16]
  - [x] Ensure `.gitignore` ignores `.env.local`, `_bmad/`, `.claude/` (add if missing; do not
        duplicate). [Source: CLAUDE.md, prd.md#NFR-6]
- [x] Task 8 — Scripts contract (AC: 7)
  - [x] Add `package.json` scripts: `dev` = `vite`, `build` = `vite build`, `preview` = `vite preview`,
        `lint` = `eslint .`, `typecheck` = `tsc --noEmit`, `format` = `prettier --write .`. Add
        placeholder `test` = `vitest run`, `test:watch` = `vitest`, `test:e2e` = `playwright test`
        (Story 0.2 installs the tools; these can no-op/fail-cleanly until then, but the script names
        are fixed now). [Source: architecture.md#AR-13, epics.md#Story 0.2]
- [x] Task 9 — Documentation deliverable (Definition of Done)
  - [x] Create `docs/features/epic-0-foundation/0-1-project-scaffold-and-linting/README.md` per the
        CLAUDE.md template (what was scaffolded, versions, how the boundary rule works + the proof
        output, how to verify). **No MANUAL_TESTING.md** (tooling only). PERFORMANCE.md is **not
        applicable** for this story. [Source: CLAUDE.md#Documentation deliverables, epics.md#Story 0.1]
- [x] Task 10 — Verify (AC: 1, 3)
  - [x] Run `pnpm lint`, `pnpm typecheck`, and `pnpm build`; confirm all pass and paste summaries into
        the Dev Agent Record.

## Documentation deliverables

Part of Definition of Done (see CLAUDE.md). Create the task documentation folder:
`docs/features/epic-0-foundation/0-1-project-scaffold-and-linting/`

- **README.md** — required. What was scaffolded (Vite 7 / React 19 / TS strict), versions, the
  ESLint flat config + Prettier setup, the `src/lib/**` boundary rule and its proof output, the
  scripts contract, `.env.example`, how to verify (`pnpm lint && pnpm typecheck && pnpm build`).
- **MANUAL_TESTING.md** — **not required** (tooling/config only; verification is lint + typecheck +
  build passing, covered under Tests in README).
- **PERFORMANCE.md** — **not applicable** for 0.x. [Source: CLAUDE.md]

## Dev Notes

This is the **first story of the project** — a greenfield scaffold. There is no `package.json` yet.
Every later story builds on this foundation and green CI.

**Branch & PR (project convention):** work on `story/0-1-project-scaffold-and-linting`, open a PR to
`master`, squash-merge. Conventional Commit, scope = story id: e.g.
`feat(0.1): scaffold vite + react 19 + ts strict with lib-boundary rule`. **No `Co-Authored-By`, no
AI attribution.** English only. [Source: CLAUDE.md#Working rules, architecture.md#3.7]

**Stack (from architecture — do not substitute):** [Source: architecture.md#AR-1, CLAUDE.md#Stack]

- **Vite 7** (react plugin) as build tool + dev server.
- **React 19**.
- **TypeScript strict** (`strict: true`), the whole codebase.
- Package manager **pnpm** (lockfile committed) — **not npm**.
- **Node 22**, pinned via `engines` + `.nvmrc`.
- Single package — **no monorepo, no Next.js, no state-management library, no
  component/autocomplete/combobox library** (FR-13). [Source: architecture.md#AR-1, prd.md#FR-13]

**ESLint / Prettier (AR-13):** [Source: architecture.md#AR-13]

- **ESLint 9 flat config** in `eslint.config.js` (no legacy `.eslintrc`), composing
  `typescript-eslint` and `eslint-plugin-react-hooks`.
- **Prettier** does all formatting; **ESLint carries no stylistic rules** — wire
  `eslint-config-prettier` last so the two don't conflict.

**The lib-boundary rule (AR-2, the core of the deliverable):**
[Source: architecture.md#AR-2, CLAUDE.md#Architecture boundary]

- `src/lib/autocomplete/` is the **reusable deliverable** — it must **never** import from
  `src/features/**` or app/demo code. The import direction is one-way:
  `lib/` ← `features/github-search/` ← `demo`/`App`.
- Enforce with a `no-restricted-imports` (or `import/no-restricted-paths`) override **scoped to
  `src/lib/**`** in the flat config. The rule must actually fire — prove it with a temporary
  offending import and record the error.

**Planned folder structure (target end-state across all epics — only build the skeleton now):**
[Source: architecture.md#3.2]

```
├── .github/workflows/        # ci.yml, pages.yml            ← Stories 0.2 / 3.3, NOT now
├── e2e/                      # Playwright specs             ← created empty now, specs in 0.2/3.2
├── docs/                     # already exists
├── src/
│   ├── lib/autocomplete/     # THE reusable deliverable     ← empty skeleton now (Epic 1)
│   ├── features/github-search/ # GitHub adapter             ← empty skeleton now (Epic 2)
│   ├── demo/                 # second data source, demo     ← empty skeleton now (Epic 3)
│   ├── App.tsx               # placeholder stage now
│   └── main.tsx
├── eslint.config.js, vite.config.ts
└── package.json, pnpm-lock.yaml, .nvmrc, .env.example
```

**`pnpm` scripts contract (fixed now, consumed by CI in 0.2):**
[Source: architecture.md#AR-13, epics.md#Story 0.2]

| Script | Command | Purpose |
|---|---|---|
| `dev` | `vite` | Dev server |
| `build` | `vite build` | Production build |
| `preview` | `vite preview` | Serve the build (e2e webServer target) |
| `lint` | `eslint .` | ESLint 9 flat |
| `typecheck` | `tsc --noEmit` | Strict typecheck (CI stage 2) |
| `test` | `vitest run` | Unit/integration, CI-safe (wired in 0.2) |
| `test:watch` | `vitest` | Local watch (wired in 0.2) |
| `test:e2e` | `playwright test` | E2E (wired in 0.2) |
| `format` | `prettier --write .` | Formatting |

**Secret hygiene (NFR-6):** the GitHub token is optional and supplied via
`VITE_GITHUB_TOKEN` (env) or an adapter prop later (Epic 2). This story only creates `.env.example`
(no real value) and ensures `.env.local` is gitignored. `_bmad/` and `.claude/` are local tooling —
gitignored, never committed. [Source: architecture.md#AR-9, prd.md#NFR-6, CLAUDE.md]

**Out of scope for this story (do NOT do here):**

- No Vitest/RTL/MSW or Playwright config, no CI workflow (Story 0.2).
- No `--ac-*` design tokens (Story 0.3).
- No hook/component/adapter code — `App.tsx` stays a placeholder. [Source: epics.md#Story 0.1]

### Project Structure Notes

- Aligns with architecture §3.2. Only the empty directory skeleton + `App.tsx` placeholder are
  created now; the reusable component (Epic 1), adapter (Epic 2), and demo (Epic 3) fill their
  directories in their own stories.

### References

- [Source: epics.md#Story 0.1: Project scaffold, linting, and boundary rule]
- [Source: architecture.md#AR-1: Build tooling & runtime — Vite 7 + React 19 + TypeScript strict, pnpm, Node 22]
- [Source: architecture.md#AR-2: Three-layer component architecture with a one-way import rule]
- [Source: architecture.md#AR-13: Lint, format & CI — ESLint 9 flat config + Prettier]
- [Source: architecture.md#3.2 File layout]
- [Source: prd.md#FR-13 Built from scratch]
- [Source: prd.md#NFR-4 Type safety, NFR-5 Isolation, NFR-6 Secret hygiene]
- [Source: CLAUDE.md#Stack, #Architecture boundary, #Documentation deliverables]

## Dev Agent Record

### Implementation Plan

1. Scaffold Vite `react-ts` template into a temp dir, merge into repo root (preserve `docs/`,
   `_bmad/`, `.claude/`, `CLAUDE.md`, `README.md`, `.gitignore`).
2. Confirm/align Vite 7.x, React 19.x. `pnpm install`, commit lockfile. Grep deps for forbidden
   packages (none expected — template is minimal).
3. Strip demo cruft: remove default SVGs/logos, counter demo, demo CSS; `App.tsx` becomes a
   minimal placeholder heading. Confirm `strict: true` in tsconfig files.
4. Add `.nvmrc` (22) and `engines` field in `package.json`.
5. Add ESLint 9 flat config (`@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`,
   `eslint-config-prettier` last). Add Prettier + `.prettierrc` + `.prettierignore`.
6. Add `no-restricted-imports` override scoped to `src/lib/**` forbidding `**/features/**` and
   app/demo imports. Prove it fires with a temporary offending import, capture the error output,
   then revert.
7. Create directory skeleton: `src/lib/autocomplete/`, `src/features/github-search/`,
   `src/demo/`, `e2e/` with `.gitkeep` placeholders.
8. Create `.env.example` with `VITE_GITHUB_TOKEN=` + comment. Verify `.gitignore` already covers
   `.env.local`, `_bmad/`, `.claude/` (confirmed present — no edit needed unless gaps found).
9. Wire scripts contract in `package.json` (dev/build/preview/lint/typecheck/format real;
   test/test:watch/test:e2e as fixed-name placeholders per spec).
10. Write documentation deliverable README under
    `docs/features/epic-0-foundation/0-1-project-scaffold-and-linting/`.
11. Verify `pnpm lint && pnpm typecheck && pnpm build`.
12. Codex review of branch diff vs master; address Critical/Important findings.
13. Security self-audit; update Dev Agent Record; commit (scope 0.1, no AI attribution); push;
    open PR.

Constraint from coordinator: other background agents are concurrently writing untracked story
spec files into `docs/implementation-artifacts/` (`1-*.md`, `2-*.md`, `3-*.md`) — not part of
this story. Never `git add -A`/`git add .`; stage explicitly only files touched by story 0.1.

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `pnpm lint` clean run (final): exit 0, no output.
- `pnpm typecheck` clean run (final): exit 0, no output.
- `pnpm build`: `tsc -b && vite build` → 29 modules transformed, `dist/` produced, exit 0.
- Boundary-rule proof (initial): `pnpm lint` against a temporary
  `src/lib/autocomplete/_boundary-proof.ts` importing `../../features/github-search/nothing`
  produced `no-restricted-imports` error; file then deleted.
- Codex review (`codex exec --sandbox read-only`) probed the boundary rule with
  `eslint --stdin` against `../../demo` (bare) and `../../App.tsx` (extension-qualified) — both
  initially passed lint (High finding), fixed by widening the `no-restricted-imports` `group`
  patterns; re-probed clean (both now error).

### Completion Notes List

- Scaffolded via `pnpm create vite@latest . --template react-ts` into a temp dir, then merged into
  the repo root, preserving `docs/`, `_bmad/`, `.claude/`, `CLAUDE.md`, `.gitignore`.
- The current Vite template installs Vite 8 / TypeScript ~6 / oxlint by default. Hand-pinned
  `package.json` to spec: Vite `^7.3.6`, React `19.2.7`, TypeScript `~5.9.3`; replaced oxlint with
  ESLint 9 (`^9.39.4`) + `typescript-eslint@^8.47.1` + `eslint-plugin-react-hooks@^7.0.1` +
  `eslint-config-prettier@^10.1.8` + `prettier@^3.6.2`; `pnpm install` resolved and generated
  `pnpm-lock.yaml` against those pins.
- Added `"strict": true` explicitly to both `tsconfig.app.json` and `tsconfig.node.json` (the
  current template does not state it explicitly, though most strict sub-flags are implied).
- Stripped Vite demo cruft (counter, logos, hero image, marketing sections, `App.css`,
  `public/icons.svg`); `App.tsx` is now a minimal placeholder heading only.
- `eslint-plugin-react-hooks@7`'s `configs['recommended-latest']` is legacy-shaped
  (`plugins: [...]` as an array) and rejected by pure flat config; used
  `configs.flat['recommended-latest']` instead, which is properly flat-shaped.
- Grep of `package.json`/`pnpm-lock.yaml` confirms no autocomplete/combobox/component-library or
  state-management package present (2 runtime deps: `react`, `react-dom`; 13 dev deps, all
  tooling).
- Directory skeleton created with `.gitkeep` placeholders: `src/lib/autocomplete/`,
  `src/features/github-search/`, `src/demo/`, `e2e/`.
- `.env.example` created with `VITE_GITHUB_TOKEN=` and a no-real-value comment. `.gitignore`
  already ignored `.env.local`, `_bmad/`, `.claude/` from prior repo setup — no edit needed.
- **Codex review** (`codex exec --sandbox read-only --cd <repo> "..."`) on `git diff
  master...HEAD` returned 4 findings:
  - High — boundary-rule glob patterns (`**/App`, `**/demo/**`, etc.) missed extension-qualified
    (`App.tsx`) and bare-directory (`../../demo`) import spellings, verified with
    `eslint --stdin`. **Fixed**: widened the `group` array in `eslint.config.js` to include
    `**/App.tsx`, `**/App.ts`, `**/main.tsx`, `**/main.ts`, and bare `**/demo`; re-probed both
    bypass cases, now correctly rejected.
  - Medium — `src/features/**` has no lint rule preventing it from importing `demo/App`.
    **Consciously skipped**: AC4 explicitly scopes the rule to `src/lib/**` only
    ("`no-restricted-imports` ESLint rule **scoped to `src/lib/**`**"); adding a second boundary
    edge is outside this story's acceptance criteria and can be a follow-up if the team wants the
    full layer graph mechanically enforced.
  - Low — `tsconfig.app.json` missing `DOM.Iterable` in `lib` versus current stock Vite template.
    **Fixed**: added.
  - Low — `tsconfig.app.json` missing `noUncheckedSideEffectImports`. **Fixed**: added.
  - All fixes re-verified with `pnpm lint && pnpm typecheck && pnpm build` — all green.
- **Security self-audit**: no secrets in tracked files (grepped for token/key/password patterns —
  none found); no unpinned `curl | bash`/`sh` patterns; `.env.local` confirmed gitignored via
  `git check-ignore -v`; dependency count sane (2 runtime, 13 dev, no forbidden packages).
- **Latest-stable version bump (post-review, per updated AR-1 — owner decision 2026-07-09, commit
  b9b65dc)**: merged master into the branch and bumped all dependencies to latest stable via
  `pnpm up --latest`: Vite `8.1.4`, `@vitejs/plugin-react@6.0.3`, ESLint `10.6.0`,
  `@eslint/js@10.0.1`, `globals@17.7.0`, `@types/node@26.1.1`; React/react-dom `19.2.7`,
  typescript-eslint `8.63.0`, eslint-plugin-react-hooks `7.1.1`, Prettier `3.9.4`,
  eslint-config-prettier `10.1.8` already latest.
  **Holdback (per AR-1): TypeScript `~6.0.3` instead of latest `7.0.2`** —
  `typescript-eslint@8.63.0` (its own latest stable) has peer `typescript >=4.8.4 <6.1.0` and
  hard-crashes at lint time under TS 7 (`TypeError: Cannot read properties of undefined (reading
  'Cjs')` in `@typescript-eslint/typescript-estree`); verified: on TS 7.0.2 `pnpm typecheck` and
  `pnpm build` pass but `pnpm lint` crashes. TS `6.0.3` is the newest release within the supported
  peer range — the smallest holdback keeping the toolchain green. Re-verified after the bump:
  `pnpm lint`, `pnpm typecheck`, `pnpm build` all green; boundary rule re-proven with an
  `eslint --stdin` probe (`../../App.tsx` import from `src/lib/autocomplete/` → error, exit 1).

### File List

- `package.json` — NEW
- `pnpm-lock.yaml` — NEW
- `tsconfig.json` — NEW
- `tsconfig.app.json` — NEW
- `tsconfig.node.json` — NEW
- `vite.config.ts` — NEW
- `.nvmrc` — NEW
- `eslint.config.js` — NEW
- `.prettierrc` — NEW
- `.prettierignore` — NEW
- `.env.example` — NEW
- `index.html` — NEW
- `src/main.tsx` — NEW
- `src/App.tsx` — NEW
- `src/index.css` — NEW
- `public/favicon.svg` — NEW
- `src/lib/autocomplete/.gitkeep` — NEW
- `src/features/github-search/.gitkeep` — NEW
- `src/demo/.gitkeep` — NEW
- `e2e/.gitkeep` — NEW
- `docs/features/epic-0-foundation/0-1-project-scaffold-and-linting/README.md` — NEW
- `docs/implementation-artifacts/0-1-project-scaffold-and-linting.md` — UPDATE (Dev Agent Record,
  task checkboxes, Change Log)

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-07-09 | 0.1 | Initial draft — story approved, ready for dev | Scrum Master (bmad-create-story) |
| 2026-07-09 | 0.1 | Implemented: Vite 7 + React 19 + TS strict scaffold, ESLint 9 flat + Prettier, lib-boundary rule (Codex-hardened), directory skeleton, env/secret hygiene, scripts contract, docs | claude-sonnet-5 |
| 2026-07-09 | 0.2 | Bumped toolchain to latest stable per updated AR-1 (Vite 8.1.4, ESLint 10.6.0, plugin-react 6.0.3, @types/node 26); TypeScript held at 6.0.3 (typescript-eslint 8.63.0 incompatible with TS 7) — holdback recorded per AR-1 | claude-sonnet-5 |

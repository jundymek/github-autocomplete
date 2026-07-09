# Story 0.1: Project scaffold, linting, and boundary rule

Status: Approved

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

- [ ] Task 1 — Bootstrap the Vite React + TypeScript project on pnpm (AC: 1, 2)
  - [ ] From a clean repo, scaffold with the Vite `react-ts` template:
        `pnpm create vite@latest . --template react-ts` (scaffold into a temp dir and merge if the
        repo is non-empty, keeping existing `docs/`, `_bmad/`, `.claude/`, `README.md`, `.gitignore`).
  - [ ] Confirm Vite is **7.x** and React is **19.x** in `package.json`; align if the template
        installs a different major. [Source: architecture.md#AR-1]
  - [ ] Run `pnpm install` and commit `pnpm-lock.yaml`.
  - [ ] Verify the dependency manifest contains **no** autocomplete/combobox/component library and
        **no** state-management library (grep `package.json` deps — nothing like `downshift`,
        `react-select`, `@headlessui/*`, `@mui/*`, `redux`, `zustand`, `jotai`, `recoil`). [FR-13]
- [ ] Task 2 — Strip the template down to a strict, minimal placeholder stage (AC: 1)
  - [ ] Remove Vite demo cruft (default logos/SVGs, counter demo in `App.tsx`, demo CSS). Keep
        `App.tsx` as a minimal placeholder heading — **no component code yet** (per epics §Technical
        notes). [Source: epics.md#Story 0.1]
  - [ ] Confirm `tsconfig.json` (and `tsconfig.app.json`) has `"strict": true`. Vite's template sets
        it; verify explicitly. [Source: architecture.md#AR-1]
- [ ] Task 3 — Pin the runtime (AC: 1)
  - [ ] Add `.nvmrc` with `22`.
  - [ ] Add `"engines": { "node": ">=22", "pnpm": ">=9" }` to `package.json`. [Source: architecture.md#AR-1]
- [ ] Task 4 — ESLint 9 flat config + Prettier (AC: 3)
  - [ ] Create `eslint.config.js` (flat config) wiring `@eslint/js`, `typescript-eslint`, and
        `eslint-plugin-react-hooks`. No legacy `.eslintrc`. [Source: architecture.md#AR-13]
  - [ ] Add Prettier (`prettier` + `.prettierrc`) and `eslint-config-prettier` so ESLint carries no
        stylistic rules. Add a `.prettierignore` (exclude `docs/`, lockfile, build output). [Source: architecture.md#AR-13]
  - [ ] Confirm `pnpm lint` passes clean.
- [ ] Task 5 — The lib-boundary rule (AC: 4)
  - [ ] In `eslint.config.js`, add a `no-restricted-imports` override **scoped to `src/lib/**`**
        forbidding import patterns matching `**/features/**`, `**/features/*`, and app/demo files
        (`**/App`, `**/main`, `**/demo/**`). Message must explain the AR-2 one-way import rule.
        [Source: architecture.md#AR-2, CLAUDE.md#Architecture boundary]
  - [ ] **Prove the rule fires:** temporarily add an import from `src/features/**` inside a file
        under `src/lib/autocomplete/`, run `pnpm lint`, confirm it errors, then revert. Record the
        error output in the Dev Agent Record / README. (A permanent negative fixture is optional.)
- [ ] Task 6 — Directory skeleton (AC: 5)
  - [ ] Create `src/lib/autocomplete/`, `src/features/github-search/`, `src/demo/`, `e2e/` (with a
        `.gitkeep` where empty). Layout must match architecture §3.2 exactly. [Source: architecture.md#3.2]
- [ ] Task 7 — Environment + secret hygiene (AC: 6)
  - [ ] Create `.env.example` containing `VITE_GITHUB_TOKEN=` and a comment: optional, never commit a
        real token. [Source: architecture.md#AR-9, prd.md#FR-16]
  - [ ] Ensure `.gitignore` ignores `.env.local`, `_bmad/`, `.claude/` (add if missing; do not
        duplicate). [Source: CLAUDE.md, prd.md#NFR-6]
- [ ] Task 8 — Scripts contract (AC: 7)
  - [ ] Add `package.json` scripts: `dev` = `vite`, `build` = `vite build`, `preview` = `vite preview`,
        `lint` = `eslint .`, `typecheck` = `tsc --noEmit`, `format` = `prettier --write .`. Add
        placeholder `test` = `vitest run`, `test:watch` = `vitest`, `test:e2e` = `playwright test`
        (Story 0.2 installs the tools; these can no-op/fail-cleanly until then, but the script names
        are fixed now). [Source: architecture.md#AR-13, epics.md#Story 0.2]
- [ ] Task 9 — Documentation deliverable (Definition of Done)
  - [ ] Create `docs/features/epic-0-foundation/0-1-project-scaffold-and-linting/README.md` per the
        CLAUDE.md template (what was scaffolded, versions, how the boundary rule works + the proof
        output, how to verify). **No MANUAL_TESTING.md** (tooling only). PERFORMANCE.md is **not
        applicable** for this story. [Source: CLAUDE.md#Documentation deliverables, epics.md#Story 0.1]
- [ ] Task 10 — Verify (AC: 1, 3)
  - [ ] Run `pnpm lint`, `pnpm typecheck`, and `pnpm build`; confirm all pass and paste summaries into
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

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-07-09 | 0.1 | Initial draft — story approved, ready for dev | Scrum Master (bmad-create-story) |

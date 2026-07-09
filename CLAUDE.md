# CLAUDE.md — github-autocomplete

Guidance for any Claude Code agent working in this repository. Read this before implementing a story.

## Project

github-autocomplete — a reusable, self-contained autocomplete component (React + TypeScript) that
searches GitHub users and repositories, built as a recruitment deliverable. The original brief is
`docs/task.md` (ground truth). The value is engineering quality: a genuinely reusable component
architecture (headless hook → generic component → GitHub adapter), accessibility (WAI-ARIA combobox),
graceful error handling, a meaningful test pyramid, and a transparent delivery process.

Planning lives in `docs/planning-artifacts/` (PRD, `architecture.md`, `epics.md`). Story specs
(what to build) live in `docs/implementation-artifacts/<id>-<slug>.md`. The visual ground truth
lives in `docs/design/`.

## Stack (do not substitute)

Vite · React 19 · TypeScript strict · CSS Modules + design tokens as CSS custom properties (NO
Tailwind and no CSS framework inside `src/lib/autocomplete/` — the component must be self-contained;
see architecture.md) · Vitest + React Testing Library + MSW for unit/integration tests · Playwright
(+ `@axe-core/playwright`) for a thin e2e layer. Package manager is **pnpm** (not npm), Node 22.
GitHub API is called client-side, unauthenticated by default, with an optional token (never commit
a token). No state management library, no autocomplete/combobox library (explicit task requirement),
no component library.

## Architecture boundary (critical)

- `src/lib/autocomplete/` — the reusable deliverable. Generic, framework-idiomatic, self-contained:
  no GitHub knowledge, no app imports, styles only via its own CSS Modules + `--ac-*` custom
  properties with fallbacks.
- `src/features/github-search/` — the GitHub-specific adapter (API client, merge+sort, item
  rendering, open-in-new-tab).
- `src/App.tsx` and demo files — the sandbox stage; may use anything, is NOT part of the component.

Never leak in the wrong direction: `lib/` must not import from `features/` or app code.

## Working rules

- **All docs, code comments, commit messages, and PRs are in English.**
- **One branch + PR per story:** `story/<id>-<slug>` → `master`, squash-merge.
- **Conventional Commits, scope = story id**, e.g. `feat(1.2): add keyboard navigation to useAutocomplete`.
- **Never add `Co-Authored-By` or any AI attribution** to commits or PRs. Keep them short.
- Tests are part of Definition of Done. Test-first where there is logic (hook state machine,
  sort/merge, API mapping). Component behavior is tested with RTL + MSW (mock HTTP at the network
  level, not fetch stubs). E2e stays thin: new-tab opening, focus management, axe.
- `_bmad/` and `.claude/` are local tooling and are gitignored — do not commit them.

## Story pipeline (every story, in order)

Each story is implemented by a fresh agent with a clean context. The agent:

1. Reads its story spec (`docs/implementation-artifacts/<id>-<slug>.md`), CLAUDE.md,
   `docs/planning-artifacts/architecture.md`, and `docs/design/` where relevant. Nothing else is
   assumed — the spec is the single source of requirements.
2. Creates a short implementation plan (recorded in the spec's Dev Agent Record), then codes on
   branch `story/<id>-<slug>`, test-first where there is logic.
3. Documents the work in `docs/features/<epic-folder>/<id>-<slug>/`: `README.md` (always),
   `MANUAL_TESTING.md` (if the story ships human-verifiable browser behavior), `PERFORMANCE.md`
   (only if the story has a real performance dimension — e.g. debounce/abort behavior, render
   volume; skip otherwise).
4. Runs the full verification locally: `pnpm lint && pnpm typecheck && pnpm test` (+ `pnpm
   test:e2e` when e2e exists) — all green before review.
5. Gets an independent **Codex review** of the story diff and a **security check** (secrets,
   injection, unsafe URL/target handling, dependency risk). Findings are fixed and re-verified.
6. Only when everything is green: opens a **pull request** with a precise description (what/why,
   AC checklist, test evidence, review outcomes). PRs are squash-merged into `master`.
7. Updates the spec's Dev Agent Record (status, completion notes, file list) before the PR.

## Documentation deliverables (MANDATORY for every story)

Every implemented story MUST ship a documentation folder. This is part of Definition of Done — a
story is not complete without it.

**Location:** `docs/features/<epic-folder>/<id>-<slug>/`

**Epic → folder mapping:**

| Epic | Folder |
|------|--------|
| 0 | `docs/features/epic-0-foundation/` |
| 1 | `docs/features/epic-1-core-autocomplete/` |
| 2 | `docs/features/epic-2-github-adapter/` |
| 3 | `docs/features/epic-3-demo-e2e-launch/` |

The task folder name matches the story spec filename, e.g. spec
`docs/implementation-artifacts/1-1-useautocomplete-hook.md` → folder
`docs/features/epic-1-core-autocomplete/1-1-useautocomplete-hook/`.

### Required files

**`README.md` — always.** Documents what was actually built:

```markdown
# <id> — <Story title>

## What was built
Short summary of what this story delivered.

## Files touched
- `path/to/file` — NEW/UPDATE — one line on what/why

## Key decisions
Implementation choices and any deviations from the spec (with rationale).

## How it works
Only if non-obvious.

## Tests
- Unit/integration: what the tests cover.
- Manual: see MANUAL_TESTING.md (if present).
```

**`MANUAL_TESTING.md` — only when the story produces something a human verifies in a browser**
(visible UI, keyboard/focus behavior, an interaction). Skip it for pure config/tooling or logic
covered solely by unit tests. When in doubt, the story spec's "Documentation deliverables" section
states which files are required — follow it.

```markdown
# Manual testing — <id> <Story title>

## Prerequisites
e.g. `pnpm dev`.

## Steps
1. Numbered, concrete actions (type X, press ArrowDown, press Enter).

## Expected
What should happen at each step.

## Accessibility checks
Keyboard navigation, visible focus, screen-reader expectations (when the story touches UI).
```

Keep the docs concise and accurate — they describe what shipped, not aspirations.

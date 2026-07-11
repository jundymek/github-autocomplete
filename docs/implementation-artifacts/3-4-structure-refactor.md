---
baseline_commit: d48220fc2696168a08310d6ae8c38e69f17cffb2
---

# Story 3.4: Structure refactor — lib public API barrel + demo country grouping

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a consumer (and evaluator) of the reusable `Autocomplete<T>` component,
I want `src/lib/autocomplete/` to expose one explicit public entry point, and the demo's second
data source grouped under its own folder,
so that the library's API surface is a deliberate contract (not "whatever path resolves") and the
repository structure consistently tells one story: group by responsibility, never by file type
(AR-2; NFR-5 self-containment; task.md "reusable and self-contained").

## Background (why this follow-up exists)

A structure review before the final README story (3.3) found two gaps and one deliberate rejection:

1. **The lib has no public API.** Consumers deep-import internals
   (`../../lib/autocomplete/Autocomplete`, `../../lib/autocomplete/types`), so every file inside
   the lib is de facto public and no file can be renamed without breaking consumers. For a
   deliverable whose brief is "a reusable and self-contained component", the missing piece is the
   contract half of reusability: a barrel that says *this is public, the rest is internal*.
2. **`src/demo/` mixes responsibilities at one level.** Five `country*` files sit loose at the demo
   root next to stage chrome, and `demo/hooks/` holds a single file — the group-by-file-type
   anti-pattern this project otherwise argues against. Grouping the whole country instance under
   `src/demo/country/` makes the demo read at a glance: "second adapter (reuse proof) + stage".
3. **Explicitly rejected (non-goal):** splitting the `createFetchSuggestions*` factories out of
   `mergeResults.ts`. See Non-goals below — the rejection and rationale are part of this story's
   deliverable.

This story must land **before Story 3.3** (README + deploy): 3.3's AC 3 documents the Component
API, and it must document barrel-based imports, not internal file paths.
[Source: docs/task.md; docs/planning-artifacts/architecture.md#AR-2 / #3.2;
docs/implementation-artifacts/3-3-readme-and-deploy.md#AC 3]

## Acceptance Criteria

1. **`src/lib/autocomplete/index.ts` defines the public API (NEW).** The barrel exports, as
   explicit named exports (no `export *`):
   - `Autocomplete` (from `./Autocomplete`) and `useAutocomplete` (from `./useAutocomplete`);
   - the public types (type-only re-exports from `./types`): `AutocompleteProps`,
     `UseAutocompleteOptions`, `UseAutocompleteResult`, `AutocompleteState`,
     `AutocompleteHandlers`, `AutocompleteStatus`, `AutocompleteError`, `AutocompleteErrorContent`,
     `AutocompleteErrorTone`, `AutocompleteMessages`, `AutocompleteFooterContext`,
     `AutocompleteInputProps`, `AutocompleteListboxProps`, `AutocompleteItemProps` — every type
     reachable from the component props or the hook's options/result, nothing else.
   A short header comment states that this file is the only supported import path for consumers.
   No runtime behavior change of any kind.
2. **No lib-internal file imports the barrel.** Files inside `src/lib/autocomplete/` keep their
   direct relative imports (`./types`, `./useAutocomplete`) — the barrel is a leaf, so no import
   cycle can form.
3. **All consumers import from the barrel.** The five deep imports outside the lib are rewritten
   to `import … from '../../lib/autocomplete'`:
   - `src/features/github-search/GithubAutocomplete.tsx` (lines importing `Autocomplete` and
     `AutocompleteFooterContext`),
   - `src/features/github-search/describeError.ts` (`AutocompleteError`,
     `AutocompleteErrorContent`),
   - `src/demo/components/CountryPanel.tsx` (`Autocomplete`, `AutocompleteFooterContext`).
   After the change, `grep -rn "lib/autocomplete/" src --include='*.ts*' | grep -v "^src/lib"`
   returns nothing.
4. **ESLint enforces the contract in both directions.** `eslint.config.js` gains a second
   `no-restricted-imports` block scoped to non-lib sources (e.g.
   `files: ['src/**/*.{ts,tsx}'], ignores: ['src/lib/**']`) that forbids deep imports into lib
   internals (`**/lib/autocomplete/*`, `**/lib/autocomplete/**`) with a message pointing to the
   barrel. The existing AR-2 block (lib must not import features/app/demo) stays untouched.
   `pnpm lint` fails if a deep import is reintroduced (verify by trial before finalizing).
5. **The country instance is grouped under `src/demo/country/`.** Moved there (git mv, content
   unchanged except relative-import paths): `countryAdapter.ts`, `countryAdapter.test.ts`,
   `countries.ts`, `countryRenderItem.tsx`, `countryInstance.test.tsx`, and
   `hooks/useSelectedCountry.ts` (the now-empty `src/demo/hooks/` is removed). Import updates:
   - inside `country/`: `useSelectedCountry.ts` imports `./countries`; the other moved files'
     relative imports are unchanged (they move together); `countryInstance.test.tsx` imports
     `../components/CountryPanel`;
   - `src/demo/components/CountryPanel.tsx` imports `../country/countryAdapter`,
     `../country/countries`, `../country/countryRenderItem`, `../country/useSelectedCountry`;
   - `src/demo/components/SelectedReadout.tsx` imports type `Country` from `../country/countries`.
   `demo.css`, `constants.ts`, `components/` and `App.tsx` are otherwise untouched.
6. **Architecture doc reflects reality.** `docs/planning-artifacts/architecture.md` §3.2 file
   layout is updated: `index.ts  # public API barrel — the only consumer import path` added under
   `src/lib/autocomplete/`, and the `src/demo/` line notes the `country/` grouping. No other
   architecture text changes.
7. **Story 3.3 records the dependency.** `docs/implementation-artifacts/3-3-readme-and-deploy.md`
   Dev Notes gain one line: the Component API section documents barrel-based imports and therefore
   depends on Story 3.4 having landed.
8. **Nothing behaves differently and everything stays green.** `pnpm lint && pnpm typecheck &&
   pnpm test && pnpm test:e2e` all pass; the test files' assertions are unchanged (only import
   paths moved); the demo page renders both instances exactly as before (`pnpm dev` spot-check).

## Tasks / Subtasks

- [x] Task 1 — Public API barrel (AC: 1, 2)
  - [x] Create `src/lib/autocomplete/index.ts` with the named exports listed in AC 1 (values via
        `export { … } from`, types via `export type { … } from`) and the header comment.
  - [x] Confirm no file under `src/lib/autocomplete/` imports `./index` or `.` (leaf barrel).
- [x] Task 2 — Rewire consumers (AC: 3)
  - [x] Update the three consumer files to import from `'../../lib/autocomplete'`.
  - [x] Run the grep from AC 3 to prove no deep import remains outside `src/lib/`.
- [x] Task 3 — ESLint deep-import guard (AC: 4)
  - [x] Add the second `no-restricted-imports` block to `eslint.config.js` (scope: all `src`
        except `src/lib/**`; patterns per AC 4; message: "import from src/lib/autocomplete (the
        public barrel) — lib internals are not a public API").
  - [x] Verify enforcement: temporarily restore one deep import, confirm `pnpm lint` fails, revert.
- [x] Task 4 — Group the demo country instance (AC: 5)
  - [x] `git mv` the six files into `src/demo/country/`; delete the empty `src/demo/hooks/`.
  - [x] Fix the relative imports listed in AC 5 (movers + `CountryPanel.tsx` + `SelectedReadout.tsx`).
- [x] Task 5 — Docs (AC: 6, 7 + deliverables below)
  - [x] Update `architecture.md` §3.2 tree (barrel + `demo/country/`).
  - [x] Add the dependency line to Story 3.3's Dev Notes.
  - [x] Create `docs/features/epic-3-demo-e2e-launch/3-4-structure-refactor/README.md` (what was
        built, files touched, key decisions — including the recorded non-goals and their rationale).
- [x] Task 6 — Verify (AC: 8)
  - [x] `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` all green.
  - [x] `pnpm dev` spot-check: both demo instances search, navigate and select as before.

## Non-goals (deliberate, recorded as part of this story)

- **No `adapter.ts` split out of `mergeResults.ts`.** The file holds the pure merge/sort/cap and
  the `createFetchSuggestions*` factories that compose it. Splitting was considered and rejected:
  no behavioral, readability, or contract driver — only file-name aesthetics — against real costs
  (test/import churn in a 343-line test file, drift from the closed Story 2.2 feature docs, diluted
  `git blame` in a history that is itself part of the deliverable). The factories are the adapter's
  construction API and live next to the merge they compose.
- **No `hooks/`/`styles/`/`types/` subfolders inside `src/lib/autocomplete/`.** Five source files
  with one shared responsibility; type-based folders would add indirection, not clarity. The lib
  stays flat and co-located — the same group-by-responsibility principle that motivates AC 5.
- **The country instance stays in `demo/`, not `features/`.** `features/` is for production-grade
  adapters (API client, typed errors, rate-limit handling); the country adapter is a 22-line demo
  fixture whose only job is proving `Autocomplete<T>` generic. Promoting it would blur the
  deliverable boundary (AR-2's "sandbox stage").

## Dev Notes

**This is a structure-only story: zero behavior change is the headline requirement.** Every edit
is an export declaration, an import path, a file move, an ESLint block, or documentation. If any
test assertion needs changing (beyond an import path), stop — something is wrong.

**The exact current deep imports (verified 2026-07-11):**

```
src/demo/components/CountryPanel.tsx:3        import { Autocomplete } from '../../lib/autocomplete/Autocomplete'
src/demo/components/CountryPanel.tsx:4        import type { AutocompleteFooterContext } from '../../lib/autocomplete/types'
src/features/github-search/GithubAutocomplete.tsx:4  import { Autocomplete } from '../../lib/autocomplete/Autocomplete'
src/features/github-search/GithubAutocomplete.tsx:5  import type { AutocompleteFooterContext } from '../../lib/autocomplete/types'
src/features/github-search/describeError.ts:1 import type { AutocompleteError, AutocompleteErrorContent } from '../../lib/autocomplete/types'
```

Nothing in `e2e/` or `src/test/` imports the lib — no changes there.
[Source: grep over src/, e2e/ on the current master]

**ESLint flat-config shape.** The existing boundary block (AR-2, lib→outward) is at
`eslint.config.js` and uses `files: ['src/lib/**/*.{ts,tsx}']` with `no-restricted-imports`
patterns. Mirror its style for the new inward guard; flat config supports `ignores` alongside
`files` within one config object. Keep both blocks separate and separately commented — they
enforce different directions of the same AR-2 contract. [Source: eslint.config.js (AR-2 block);
docs/planning-artifacts/architecture.md#AR-2]

**Barrel pitfalls to avoid.**
- Do not `export *` — the deliberate, enumerated list *is* the point (an intentional API surface).
- Type re-exports must use `export type { … }` (the project compiles with `verbatimModuleSyntax`-
  era TS 6 strict settings; type-only syntax keeps erasure unambiguous).
- The barrel must stay a leaf (AC 2) — lib internals never import it, so no cycles are possible.
- CSS is not re-exported: `Autocomplete.tsx` already imports its own CSS Module, and `tokens.css`
  remains a documented opt-in stylesheet (see Story 0.3 docs), not a JS export.

**Demo move mechanics.** Use `git mv` so history follows renames. After the move, the only content
edits are relative-import paths (AC 5 lists every one). `countryInstance.test.tsx` currently
imports `./components/CountryPanel`; from `country/` that becomes `../components/CountryPanel`.
`useSelectedCountry.ts` currently imports `../countries`; inside `country/` that becomes
`./countries`. [Source: src/demo/* import grep, 2026-07-11]

**Why before 3.3, and what 3.3 needs.** Story 3.3 AC 3 writes the Component API table into the
root README. With this story landed, that table documents
`import { Autocomplete, useAutocomplete } from '<pkg>/lib/autocomplete'` — the real contract.
Land 3.4 first; add the one-line dependency note into 3.3's Dev Notes (AC 7).
[Source: docs/implementation-artifacts/3-3-readme-and-deploy.md#Acceptance Criteria (AC 3)]

**No new runtime dependency (AR-1); no version changes.** This story installs nothing.
[Source: CLAUDE.md#Stack; docs/planning-artifacts/architecture.md#AR-1]

**Branch & PR.** `story/3-4-structure-refactor` → `master`, squash. Commit e.g.
`refactor(3.4): add lib public API barrel and group demo country instance`. **No AI attribution /
no `Co-Authored-By`.** Run the mandatory pre-PR review gate (security review + independent
second-pass review + verified triage), re-run the full verification after any fix, then PR.
[Source: CLAUDE.md#Working rules / #Story pipeline]

### Project Structure Notes

- Files this story touches:
  - `src/lib/autocomplete/index.ts` — NEW — public API barrel (AC 1).
  - `src/features/github-search/GithubAutocomplete.tsx` — UPDATE — barrel imports (AC 3).
  - `src/features/github-search/describeError.ts` — UPDATE — barrel import (AC 3).
  - `src/demo/components/CountryPanel.tsx` — UPDATE — barrel import + `../country/*` paths (AC 3, 5).
  - `src/demo/components/SelectedReadout.tsx` — UPDATE — `../country/countries` path (AC 5).
  - `src/demo/country/{countryAdapter.ts,countryAdapter.test.ts,countries.ts,countryRenderItem.tsx,countryInstance.test.tsx,useSelectedCountry.ts}` — MOVED from `src/demo/` root and `src/demo/hooks/` (AC 5).
  - `eslint.config.js` — UPDATE — inward deep-import guard (AC 4).
  - `docs/planning-artifacts/architecture.md` — UPDATE — §3.2 tree (AC 6).
  - `docs/implementation-artifacts/3-3-readme-and-deploy.md` — UPDATE — dependency note (AC 7).
  - `docs/features/epic-3-demo-e2e-launch/3-4-structure-refactor/README.md` — NEW — story docs.
- **MANUAL_TESTING.md is not required**: no user-visible behavior changes (pure structure); the
  `pnpm dev` spot-check in Task 6 covers the human sanity pass. PERFORMANCE.md not required.
  [Source: CLAUDE.md#Documentation deliverables]

### References

- [Source: docs/task.md — "reusable and self-contained autocomplete component"]
- [Source: docs/planning-artifacts/architecture.md#AR-2 (three layers, one-way imports) / #3.2 (file layout)]
- [Source: docs/implementation-artifacts/3-3-readme-and-deploy.md#AC 3 (Component API table) — the dependency driving the ordering]
- [Source: eslint.config.js — existing AR-2 `no-restricted-imports` block to mirror]
- [Source: src/lib/autocomplete/types.ts — the full exported type list backing AC 1]
- [Source: src/demo/* — current country file locations and import graph]
- [Source: CLAUDE.md#Architecture boundary / #Working rules / #Story pipeline / #Documentation deliverables]

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5) via Claude Code.

### Implementation Plan

1. Create the barrel `src/lib/autocomplete/index.ts` (explicit named exports per AC 1, header
   comment, leaf — verified no lib-internal file imports it).
2. Rewire the three consumers (five deep imports) to `'../../lib/autocomplete'`; prove with the
   AC 3 grep.
3. Add the inward `no-restricted-imports` block to `eslint.config.js`; prove enforcement by
   restoring one deep import (lint fails with the barrel message), then revert.
4. `git mv` the six country files into `src/demo/country/`, remove empty `src/demo/hooks/`, fix
   the relative imports listed in AC 5.
5. Docs: architecture §3.2 tree, Story 3.3 dependency note, feature README (incl. non-goals).
6. Full verification + `pnpm dev` spot-check, then the pre-PR review gate.

### Debug Log References

- AC 3 grep proof: `grep -rn "lib/autocomplete/" src --include='*.ts*' | grep -v "^src/lib"`
  returns nothing.
- AC 4 enforcement trial: restoring `'../../lib/autocomplete/types'` in `describeError.ts` made
  `pnpm lint` fail with "import from src/lib/autocomplete (the public barrel) — lib internals are
  not a public API"; reverted.

### Completion Notes List

- Structure-only story delivered with zero behavior change: no test assertion was modified — only
  import paths in moved/consumer files.
- Verification: `pnpm lint`, `pnpm typecheck`, `pnpm test` (15 files, 205 tests) and
  `pnpm test:e2e` (14 tests) all green.
- `pnpm dev` spot-check executed via a scripted browser session against the dev server (GitHub API
  stubbed for determinism): GitHub instance renders options and ArrowDown highlights
  (`aria-activedescendant` set); country instance filters "pol", ArrowDown+Enter selects Poland
  into the readout. Both instances behave as before.
- Barrel is a leaf: no file under `src/lib/autocomplete/` imports `./index` or `.`.
- ESLint now guards both AR-2 directions: existing outward block untouched; new inward block scoped
  `files: ['src/**/*.{ts,tsx}'], ignores: ['src/lib/**']`.

### Pre-PR review gate (security review + independent second pass + triage)

- **Security review:** no findings. The diff adds no runtime logic, input handling, network/DOM
  changes, or secrets — the barrel is pure named re-exports and the ESLint block is lint-time only.
- **Independent second-pass review (codex-rescue):** confirmed no accidental behavior change, no
  missed deep imports, barrel complete vs `types.ts` (2 values + 14 types, leaf), moved-file
  imports consistent. Two findings triaged:
  1. *(med)* Inward ESLint guard covers only `src/**`, so `e2e/*.spec.ts` could deep-import lib
     internals unflagged. **Triaged: by design, documented false positive.** AC 4 prescribes
     exactly this scope (`files: ['src/**/*.{ts,tsx}'], ignores: ['src/lib/**']`), and it was
     verified empirically that `e2e/` imports nothing from `src/` at all (specs import only
     `./helpers/*` and Playwright — they drive the app through the browser). Widening the scope
     would exceed the story spec; noted as a possible future hardening.
  2. *(low)* Story status said `in-progress` while all tasks were checked. **Fixed:** status is a
     workflow-managed field; set to `review` at completion per the dev-story workflow.
- Full verification re-run after triage: lint, typecheck, unit (205), e2e (14) — all green.

### File List

- `src/lib/autocomplete/index.ts` — NEW — public API barrel (AC 1, 2).
- `src/features/github-search/GithubAutocomplete.tsx` — UPDATE — barrel imports (AC 3).
- `src/features/github-search/describeError.ts` — UPDATE — barrel import (AC 3).
- `src/demo/components/CountryPanel.tsx` — UPDATE — barrel import + `../country/*` paths (AC 3, 5).
- `src/demo/components/SelectedReadout.tsx` — UPDATE — `../country/countries` path (AC 5).
- `src/demo/country/countryAdapter.ts` — MOVED from `src/demo/` (git mv; content unchanged).
- `src/demo/country/countryAdapter.test.ts` — MOVED from `src/demo/` (git mv; content unchanged).
- `src/demo/country/countries.ts` — MOVED from `src/demo/` (git mv; content unchanged).
- `src/demo/country/countryRenderItem.tsx` — MOVED from `src/demo/` (git mv; content unchanged).
- `src/demo/country/countryInstance.test.tsx` — MOVED from `src/demo/` (git mv; import path `../components/CountryPanel`).
- `src/demo/country/useSelectedCountry.ts` — MOVED from `src/demo/hooks/` (git mv; import path `./countries`); empty `src/demo/hooks/` removed.
- `eslint.config.js` — UPDATE — inward deep-import guard (AC 4).
- `docs/planning-artifacts/architecture.md` — UPDATE — §3.2 tree (AC 6).
- `docs/implementation-artifacts/3-3-readme-and-deploy.md` — UPDATE — dependency note (AC 7).
- `docs/features/epic-3-demo-e2e-launch/3-4-structure-refactor/README.md` — NEW — story docs.
- `docs/implementation-artifacts/3-4-structure-refactor.md` — UPDATE — Dev Agent Record, checkboxes, status.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-11 | 0.1 | Follow-up story drafted from the pre-README structure review: add the lib's public API barrel (`index.ts`) + ESLint inward guard, group the demo country instance under `src/demo/country/`, record the rejected `mergeResults.ts` split as a non-goal. Must land before Story 3.3. | Łukasz (via BMAD create-story) |
| 2026-07-11 | 1.0 | Story implemented: barrel + inward ESLint guard (enforcement proven by trial) + `demo/country/` grouping (git mv) + docs. Zero behavior change; full verification green (lint, typecheck, 205 unit tests, 14 e2e, dev spot-check). | Claude Fable 5 (dev-story) |

# 0.1 — Project scaffold, linting, and boundary rule

## What was built

A greenfield Vite + React 19 + TypeScript-strict project on pnpm, with ESLint flat config +
Prettier, the `src/lib/**` import-boundary rule (AR-2), the target directory skeleton, secret
hygiene (`.env.example`), and the fixed `pnpm` scripts contract. `App.tsx` is a minimal
placeholder — no component/hook/adapter code yet (that starts in Epic 1).

## Versions

Per the AR-1 latest-stable version policy (owner decision, 2026-07-09), every dependency is at
its latest stable release at implementation time, with one recorded holdback (see below):

- Vite `8.1.4` (react plugin `@vitejs/plugin-react@6.0.3`)
- React `19.2.7` / react-dom `19.2.7`
- TypeScript `6.0.3` — **HELD BACK** from latest (`7.0.2`); see holdback note below
- `strict: true` explicit in both `tsconfig.app.json` and `tsconfig.node.json`
- ESLint `10.6.0` (flat config, `eslint.config.js`) + `typescript-eslint@8.63.0` +
  `eslint-plugin-react-hooks@7.1.1` (flat-shaped `configs.flat['recommended-latest']`) +
  `@eslint/js@10.0.1` + `globals@17.7.0`
- Prettier `3.9.4` + `eslint-config-prettier@10.1.8` (composed last so ESLint carries no
  stylistic rules)
- `@types/node@26.1.1`, `@types/react@19.2.17`, `@types/react-dom@19.2.3`
- Node `22` (pinned via `.nvmrc` and `package.json#engines`), pnpm `>=9`

### Version holdback (per AR-1)

- **TypeScript held at `~6.0.3` instead of latest `7.0.2`.** `typescript-eslint@8.63.0` (its own
  latest stable) declares peer `typescript >=4.8.4 <6.1.0` and hard-crashes at lint time under
  TS 7 (`TypeError: Cannot read properties of undefined (reading 'Cjs')` inside
  `@typescript-eslint/typescript-estree`) — verified locally: with TS `7.0.2`, `pnpm typecheck`
  and `pnpm build` pass but `pnpm lint` crashes. TypeScript `6.0.3` is the newest release inside
  the supported peer range, so it is the smallest possible holdback that keeps the toolchain
  green. Revisit when typescript-eslint ships TS 6.1+/7 support.

## Files touched

- `package.json` — NEW — project manifest: name, `engines`, dependencies, the fixed scripts
  contract (`dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:watch`, `test:e2e`,
  `format`).
- `pnpm-lock.yaml` — NEW — committed lockfile.
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` — NEW — project references split;
  `strict: true` added explicitly to both app and node configs.
- `vite.config.ts` — NEW — Vite + `@vitejs/plugin-react`.
- `eslint.config.js` — NEW — ESLint 9 flat config: `@eslint/js` recommended, `typescript-eslint`
  recommended, `eslint-plugin-react-hooks` flat recommended-latest, the `src/lib/**`
  `no-restricted-imports` boundary override, `eslint-config-prettier` last.
- `.prettierrc`, `.prettierignore` — NEW — Prettier config; ignores `docs/`, `CLAUDE.md`,
  `pnpm-lock.yaml`, build output, and local tooling dirs (`_bmad/`, `.claude/`, `.superpowers/`).
- `.nvmrc` — NEW — pins Node `22`.
- `.env.example` — NEW — documents `VITE_GITHUB_TOKEN=` with no real value.
- `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css` — NEW — stripped-down app shell;
  `App.tsx` is a placeholder heading only, all Vite demo cruft (counter, logos, hero image,
  Vite/React marketing sections) removed.
- `public/favicon.svg` — NEW — kept from the template; `public/icons.svg` (demo-only sprite)
  removed.
- `src/lib/autocomplete/.gitkeep`, `src/features/github-search/.gitkeep`, `src/demo/.gitkeep`,
  `e2e/.gitkeep` — NEW — empty directory skeleton per architecture §3.2.

## Key decisions

- **Version policy.** The story was first implemented against the original AR-1 (Vite 7.x pin,
  TypeScript 5.9), then re-aligned to the updated AR-1 latest-stable policy (owner decision,
  2026-07-09, commit b9b65dc): all dependencies bumped to latest stable via `pnpm up --latest`,
  with the single TypeScript holdback documented above. The template's `oxlint` was replaced with
  ESLint flat config + `typescript-eslint` + `eslint-plugin-react-hooks` + Prettier +
  `eslint-config-prettier` per AR-13 (the spec mandates ESLint + Prettier, not oxlint).
- **`strict: true` added explicitly.** The current template's `tsconfig.app.json` /
  `tsconfig.node.json` no longer include an explicit `"strict": true` line (though most strict
  sub-flags are implied elsewhere); AC1 requires it stated explicitly, so it was added to both
  files under a `/* Strict type-checking */` block.
- **`eslint-plugin-react-hooks@7` flat export.** `configs['recommended-latest']` in this plugin
  version is still legacy-shaped (`plugins: ["react-hooks"]` as an array), which flat config
  rejects. The plugin also exports `configs.flat['recommended-latest']`, which is properly
  flat-shaped — that is what `eslint.config.js` composes.
- **Formatter scope.** `pnpm format` (Prettier `--write .`) was run once repo-wide; it initially
  reformatted `CLAUDE.md` and an unrelated `.superpowers/` file, which are out of scope for this
  story (CLAUDE.md must not be overwritten). Both were excluded via `.prettierignore` and the
  spurious CLAUDE.md reformat was reverted with `git checkout -- CLAUDE.md` before any commit.
- **`.gitignore` already covered `.env.local`, `_bmad/`, `.claude/`** from repo setup — no edit
  was needed for AC6.
- **Codex review findings.** An independent Codex review of the branch diff found: (High) the
  boundary-rule glob patterns missed extension-qualified and bare-directory import spellings —
  fixed, see above. (Medium) `src/features/**` has no lint rule preventing it from importing
  `demo/App` — consciously **not** added: AC4 scopes the rule to `src/lib/**` only ("A
  `no-restricted-imports` ESLint rule **scoped to `src/lib/**`**"), and `src/features/**` is
  documented (not yet lint-enforced) to import only from `lib/`, per architecture §3.2/AR-2; adding
  a second boundary edge is out of this story's acceptance criteria. (Low) `tsconfig.app.json` was
  missing `DOM.Iterable` and `noUncheckedSideEffectImports` versus the current stock Vite template
  — both added.

## How it works — the lib-boundary rule (AR-2)

`eslint.config.js` adds an override scoped to `files: ['src/lib/**/*.{ts,tsx}']` with a
`no-restricted-imports` rule forbidding import specifiers matching `**/features/*`,
`**/features/**`, `**/App`, `**/App.tsx`, `**/App.ts`, `**/main`, `**/main.tsx`, `**/main.ts`,
`**/demo`, `**/demo/*`, `**/demo/**`. This mechanically enforces the one-way import direction
`lib/` ← `features/github-search/` ← `demo`/`App` (never the reverse). Extension-qualified
(`App.tsx`) and bare directory (`../../demo`) specifiers are covered explicitly — an independent
Codex review probed the initial pattern set with `eslint --stdin` and found both spellings slipped
past a version that only listed extensionless `**/App`/`**/demo/**`; the pattern list above is the
fixed version, re-verified with the same probes.

**Proof the rule fires** — a temporary file `src/lib/autocomplete/_boundary-proof.ts` was added
with:

```ts
import { nothing } from '../../features/github-search/nothing'
export { nothing }
```

Running `pnpm lint` produced:

```
/Users/.../src/lib/autocomplete/_boundary-proof.ts
  2:1  error  '../../features/github-search/nothing' import is restricted from being used by a pattern. src/lib/autocomplete/ is the reusable deliverable and must never import from src/features/** or app/demo code (AR-2). The import direction is one-way: lib/ <- features/github-search/ <- demo/App  no-restricted-imports

✖ 1 problem (1 error, 0 warnings)
```

The file was then deleted and `src/lib/autocomplete/.gitkeep` restored; `pnpm lint` is clean
again on the committed tree.

Additional negative probes (run via `eslint --stdin --stdin-filename src/lib/autocomplete/probe.ts`,
no file written) after the Codex-driven pattern fix, both correctly rejected:

```
$ printf "import demo from '../../demo'\nexport { demo }\n" | eslint --stdin --stdin-filename src/lib/autocomplete/probe.ts
<stdin>:1:1  error  '../../demo' import is restricted ... no-restricted-imports

$ printf "import App from '../../App.tsx'\nexport { App }\n" | eslint --stdin --stdin-filename src/lib/autocomplete/probe.ts
<stdin>:1:1  error  '../../App.tsx' import is restricted ... no-restricted-imports
```

## Scripts contract

| Script | Command | Status |
|---|---|---|
| `dev` | `vite` | wired |
| `build` | `tsc -b && vite build` | wired |
| `preview` | `vite preview` | wired |
| `lint` | `eslint .` | wired |
| `typecheck` | `tsc --noEmit` | wired |
| `format` | `prettier --write .` | wired |
| `test` | `vitest run` | name fixed now, tool installed in Story 0.2 |
| `test:watch` | `vitest` | name fixed now, tool installed in Story 0.2 |
| `test:e2e` | `playwright test` | name fixed now, tool installed in Story 0.2 |

`test`/`test:watch`/`test:e2e` will fail today (`vitest`/`playwright` are not installed) — this is
expected and explicitly in-scope per the story (Story 0.2 wires them).

## Tests

No unit tests in this story (pure tooling/config). Verification is:

```
pnpm lint && pnpm typecheck && pnpm build
```

All three pass — see command output above and in the story's Dev Agent Record.

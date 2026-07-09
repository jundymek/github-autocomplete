# Story 1.1: `useAutocomplete<T>` hook — state machine, debounce, threshold, cancellation

Status: Approved

## Story

As an integrating developer,
I want a generic headless hook that owns the fetch lifecycle and dropdown state,
so that any UI can get threshold, debounce, cancellation, and unambiguous states for free with any data source (FR-1, FR-2, FR-3, FR-8 state model, FR-14; AR-3, §3.4; NFR-2).

## Acceptance Criteria

1. The hook `useAutocomplete<T>(options)` accepts a required `fetchSuggestions(query: string, signal: AbortSignal) => Promise<T[]>`, an optional `getItemKey` (may be unused until 1.2), and options `minChars` (default **3**) and `debounceMs` (default **300**), both overridable. It returns exactly one `state` object and one `handlers` object per §3.4 — never loose booleans. (AR-3, AR-4, §3.4, NFR-4)
2. **Threshold (FR-1, AR-3):** when the query length is `< minChars`, no request is issued, `status` is `idle`, `isOpen` is `false`, and `items` is empty. Deleting from `minChars` to `minChars - 1` characters (3 → 2 by default) closes the dropdown (`isOpen: false`, `status: 'idle'`) **and aborts any in-flight request**. The boundary is inclusive: exactly `minChars` characters qualifies.
3. **Debounce (FR-2, AR-3, NFR-2):** a qualifying query change starts/resets a `debounceMs` timer; the request fires only after `debounceMs` of inactivity. Intermediate keystrokes within the window produce **no** request. Typing `"react"` quickly results in exactly one request, for `"react"` — verified with fake timers.
4. **Stale-request cancellation (FR-3, NFR-2):** each fetch gets a fresh `AbortController`. A new qualifying query, a drop below threshold, or unmount **aborts the previous controller**. A late/aborted response is discarded and can never overwrite newer state. `AbortError` (and any error whose `name === 'AbortError'` / `signal.aborted`) is **swallowed** — never surfaced as `status: 'error'`.
5. **State machine (FR-8, §3.4):** `status: 'idle' | 'loading' | 'success' | 'empty' | 'error'` is a discriminated union and the **single source of truth** for what the dropdown renders — never derived from `items.length`. `empty` (resolved with zero items) is distinct from `success` (resolved with ≥1 item). `error` carries `error: { message: string }`. Transitions: `idle → loading` (debounced fetch starts), `loading → success` (resolved, items > 0), `loading → empty` (resolved, items === 0), `loading → error` (rejected, non-abort), and back to `idle` when the query drops below threshold.
6. **Error passthrough is generic (FR-14, NFR-5):** the hook has **zero** knowledge of GitHub error shapes. On rejection it stores `status: 'error'` with a `message`. It must **preserve the originally thrown error** for the consumer (expose it as `error.cause` — the caught value — alongside the generic `message`) so the adapter can later derive rate-limit text without the hook understanding it. The hook never imports from `features/` or app code (AR-2).
7. The `state` shape is exactly: `{ query: string, status, items: T[], highlightedIndex: number | null, isOpen: boolean, error?: { message: string; cause?: unknown } }`. `highlightedIndex` exists in the shape now (default `null`) but its keyboard reducers land in 1.2 — this story only initializes/resets it (reset to `null` on new query and on close). (§3.4)
8. The public surface (`useAutocomplete`, its options type, the `state`/`handlers` types) is fully typed with TSDoc, TypeScript strict clean. (NFR-4, §3.1)
9. Unit tests (Vitest, `vi.useFakeTimers()`, no real network — a stubbed `fetchSuggestions`) cover: the threshold boundary (2 → 3 chars), debounce collapsing to one request, stale-response-ignored-via-abort, unmount cleanup (abort + no state update after unmount), the error path, and the empty path. (FR-18, §3.6 integration/unit row)

## Tasks / Subtasks

- [ ] Task 1 — Types (`src/lib/autocomplete/types.ts`) (AC: 1, 5, 6, 7, 8)
  - [ ] Define `AutocompleteStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error'`.
  - [ ] Define `AutocompleteState<T> = { query: string; status: AutocompleteStatus; items: T[]; highlightedIndex: number | null; isOpen: boolean; error?: { message: string; cause?: unknown } }`.
  - [ ] Define `UseAutocompleteOptions<T> = { fetchSuggestions: (query: string, signal: AbortSignal) => Promise<T[]>; getItemKey?: (item: T) => string; minChars?: number; debounceMs?: number }`. TSDoc every field. Prefer `type` aliases (§3.1).
  - [ ] Define the `handlers` object type with at least `onInputChange(value: string): void` and `close(): void` for this story; leave keyboard/ARIA handler fields declared but documented as "implemented in 1.2" (so 1.2 extends without breaking the type contract). Decision: declare the full §3.4 handler surface as the type now, implement only input/close here — record this in Dev Agent Record.
- [ ] Task 2 — **Write tests first** (`src/lib/autocomplete/useAutocomplete.test.tsx`) (AC: 9) — TEST-FIRST
  - [ ] Set up `vi.useFakeTimers()` in `beforeEach` and restore in `afterEach`; render the hook via RTL `renderHook` (jsdom). Use a controllable stub `fetchSuggestions` (a `vi.fn()` returning a manually-resolvable promise / deferred) — **not** MSW (this story has no HTTP; §3.6 unit level). Advance debounce with `vi.advanceTimersByTimeAsync`.
  - [ ] **Threshold boundary 2 → 3:** type `"re"` → assert no call, `status: 'idle'`, `isOpen: false`; extend to `"rea"` and advance 300ms → assert exactly one call with `"rea"`.
  - [ ] **Debounce collapsing:** type `"r"`,`"re"`,`"rea"`,`"reac"`,`"react"` rapidly (each < 300ms apart), advance 300ms → assert `fetchSuggestions` called exactly once, with `"react"`.
  - [ ] **Stale response ignored via abort:** start query A (resolve deferred later), change to query B; assert A's `AbortController.signal.aborted === true`; resolve A late → assert state reflects B, never A; resolve B → assert B rendered.
  - [ ] **Unmount cleanup:** start a fetch, `unmount()` before it resolves → assert the in-flight signal is aborted and resolving the promise afterward triggers no state update / no act warning.
  - [ ] **Error path:** stub rejects with `new Error('boom')` → assert `status: 'error'`, `error.message` present, `error.cause` is the thrown Error; then assert an `AbortError` rejection does **not** produce `status: 'error'` (stays/settles non-error).
  - [ ] **Empty path:** stub resolves `[]` → assert `status: 'empty'` (distinct from `success`), `items: []`, `isOpen: true`.
- [ ] Task 3 — Hook implementation (`src/lib/autocomplete/useAutocomplete.ts`) (AC: 1–8)
  - [ ] Implement debounce (timer ref, cleared on each `onInputChange` and on unmount), threshold gate, `AbortController` per fetch stored in a ref, abort-on-change/threshold-drop/unmount.
  - [ ] Map resolution → `success`/`empty` by items length; map rejection → `error` unless aborted (check `signal.aborted` or `err?.name === 'AbortError'`). Store `error.cause` = caught value (AC-6).
  - [ ] Guard against post-unmount / stale `setState`: only commit results whose owning controller is still the current one (compare against the ref) — the abort check plus a mounted ref both apply.
  - [ ] Reset `highlightedIndex` to `null` on new query and on `close()`; keyboard reducers deferred to 1.2 (add a `// 1.2:` marker where they'll attach).
  - [ ] TSDoc on the exported hook and types (NFR-4).
- [ ] Task 4 — Verify (AC: all)
  - [ ] `pnpm lint && pnpm typecheck && pnpm test` all green (repo uses **pnpm**, Node 22 — see Dev Notes). The lib-boundary ESLint rule (AR-2) must not flag this file (zero `features/`/app imports).

## Documentation deliverables

Part of Definition of Done (see CLAUDE.md). Create the task documentation folder:
`docs/features/epic-1-core-autocomplete/1-1-useautocomplete-hook/`

- **README.md** — required. Document the hook's public API (`useAutocomplete<T>` signature, options + defaults, the `state`/`handlers` contract per §3.4), the state machine (the five statuses and their transitions), the debounce/threshold/abort behavior, the generic error passthrough (`message` + preserved `cause`), and what is deferred (keyboard reducers → 1.2, rendering → 1.3).
- **PERFORMANCE.md** — **required for this story.** Per CLAUDE.md, `PERFORMANCE.md` is written "only if the story has a real performance dimension — e.g. debounce/abort behavior." This story *is* that dimension: it owns debounce (one request per settled query, NFR-2) and abort-based stale-response suppression. Document: the debounce window and why 300ms, the "exactly one request per settled query" guarantee, the AbortController lifecycle (create/abort on change/threshold-drop/unmount), and the no-stale-flicker property — with pointers to the tests that prove each.
- **MANUAL_TESTING.md** — **skip.** Headless logic with no rendered UI; fully covered by unit/integration tests (epics.md 1.1). Note this in the README.

## Dev Notes

**Prerequisite.** Epic 0 (0.1 scaffold + boundary rule, 0.2 test harness/CI) is merged: Vite 7 + React 19 + TS strict on pnpm/Node 22, Vitest+RTL+jsdom configured, the `no-restricted-imports` rule scoped to `src/lib/**` active. This is the **first story of Epic 1** and the logic core the rest of the epic builds on (1.2 adds keyboard/ARIA reducers to the same hook; 1.3 renders over it). Keep it thin and convention-setting. [Source: docs/planning-artifacts/epics.md#Epic 1 / #Story 1.1; architecture.md §4]

**Branch & PR.** `story/1-1-useautocomplete-hook` → `master`, squash. Conventional Commit, scope = story id, e.g. `feat(1.1): add useAutocomplete hook with debounce, threshold and cancellation`. **No `Co-Authored-By` / no AI attribution.** Run the Codex pre-PR review + security check, wait for CI green, record outcomes in the Dev Agent Record. [Source: CLAUDE.md#Working rules, #Story pipeline; architecture.md §3.7]

**Package manager is pnpm (NOT npm).** `pnpm lint` / `pnpm typecheck` / `pnpm test`. Node 22 (`.nvmrc`). No new runtime dependencies expected (React only). If any dev dep is added, commit `package.json` **and** `pnpm-lock.yaml` together (CI runs `--frozen-lockfile`). [Source: CLAUDE.md#Stack; architecture.md AR-1]

**The hook owns ALL behavior — headless, no UI (AR-3).** Debounce (~300ms, default, configurable), threshold (min 3, default, configurable), the `idle|loading|success|empty|error` discriminated-union state machine, and per-fetch `AbortController` with `AbortError` swallowed all live here. Keyboard-navigation *state fields* (`highlightedIndex`) exist in the shape now; their reducers (ArrowDown/Up clamp, Enter, Escape) land in **1.2** — do not implement them here beyond initializing/resetting `highlightedIndex`. [Source: architecture.md AR-3, §3.4; epics.md#Story 1.1 technical notes]

**State machine is the single source of truth (§3.4, FR-8).** Components (1.3) render off `status`, never off `items.length`. `empty` must be distinct from `success` so the UI can show "No matches" vs. a list. `error` carries `{ message }`. Never leave the dropdown in an ambiguous loading/empty/error state — that is the exact bug class this story eliminates by construction. [Source: architecture.md AR-3, §3.4; prd.md#FR-8]

**Generic error passthrough — the boundary rule (FR-14, NFR-5, AR-2).** The hook must **not** know what a GitHub rate limit or HTTP status is. It converts a rejection into `status: 'error'` + a generic `message`, but must **preserve the thrown value** so the consumer (the Epic 2 adapter, later) can map it to a specific message. Decision: expose the caught value as `error.cause`. The default generic `message` should be neutral (e.g. `'Something went wrong.'`); the adapter overrides display text at the component layer (1.3's message-override props). `src/lib/autocomplete/` has **zero** imports from `features/` or app code and zero GitHub strings. [Source: architecture.md AR-2, AR-4, §3.3 ("the generic lib layer knows only `{ status: 'error'; message }`-level information"); prd.md#FR-14/NFR-5; CLAUDE.md#Architecture boundary]

**AbortController contract (FR-3, AR-3, NFR-2).** One controller per fetch. Abort the previous on: (a) a new qualifying query, (b) query dropping below `minChars`, (c) unmount. A response from an aborted controller is discarded — guard the `setState` by checking the controller is still current *and* the component is mounted. `AbortError` is not an error state; detect via `signal.aborted` or `err.name === 'AbortError'`. This is what guarantees "no stale-response flicker" (NFR-2). [Source: architecture.md AR-3, §3.6; prd.md#FR-3/NFR-2]

**`fetchSuggestions(query, signal)` is the single seam (AR-4).** The hook calls this injected function and passes its controller's `signal`. This same contract is implemented by the GitHub adapter (Epic 2) and the demo's country source (Epic 3) — it is the one cross-layer contract. Do not add any assumptions about `T` beyond what this story needs. [Source: architecture.md AR-4, §4 cross-component dependencies]

**Testing — fake timers, stubbed fetch, NOT MSW (§3.6).** This story is the **unit/logic** layer: no HTTP is involved, so the injected `fetchSuggestions` is a plain stub/deferred (`vi.fn()`), and debounce is driven by `vi.useFakeTimers()`. MSW (network-boundary mocking) is for stories that actually issue HTTP — that starts in 1.3 (rendered component over real HTTP outcomes) and Epic 2. Do not introduce fetch stubs of `global.fetch` here; there is no fetch to stub — the data source is injected. [Source: architecture.md AR-12, §3.6; epics.md#Story 1.1]

### Project Structure Notes

- New files under **`src/lib/autocomplete/`** (the reusable-deliverable layer, per §3.2): `useAutocomplete.ts`, `types.ts`, and co-located `useAutocomplete.test.tsx`. This is the first lib module — it sets the location 1.2/1.3 extend. [Source: architecture.md §3.2]
- Tests co-located as `*.test.tsx` (§3.1). Prefer `type` aliases over `interface` (§3.1).
- No CSS, no component, no ARIA getters here — those are 1.2 (getters) and 1.3 (component/CSS).

### References

- [Source: docs/planning-artifacts/epics.md#Story 1.1: `useAutocomplete<T>` hook — state machine, debounce, threshold, cancellation]
- [Source: docs/planning-artifacts/architecture.md#AR-3 `useAutocomplete<T>` — headless hook owning all behavior]
- [Source: docs/planning-artifacts/architecture.md#AR-4 `Autocomplete<T>` — injected contract (`fetchSuggestions(query, signal)`)]
- [Source: docs/planning-artifacts/architecture.md#AR-2 Three-layer architecture with a one-way import rule]
- [Source: docs/planning-artifacts/architecture.md#3.4 Hook → component contract (single state object + handlers)]
- [Source: docs/planning-artifacts/architecture.md#3.3 Error-type modeling (generic lib knows only `{ status:'error'; message }`)]
- [Source: docs/planning-artifacts/architecture.md#3.6 Testing conventions (unit level, fake timers)]
- [Source: docs/planning-artifacts/prds/prd-github-autocomplete-2026-07-09/prd.md#FR-1, #FR-2, #FR-3, #FR-8, #FR-14, #NFR-2, #NFR-4, #NFR-5]
- [Source: CLAUDE.md#Architecture boundary, #Working rules, #Documentation deliverables]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-09 | 0.1 | Initial draft (headless create-story, Approved) | bmad-create-story |

# 1.1 — `useAutocomplete<T>` hook — state machine, debounce, threshold, cancellation

## What was built

The generic headless hook that owns the whole autocomplete fetch lifecycle: threshold gating,
debouncing, per-fetch `AbortController` cancellation, and an unambiguous
`idle | loading | success | empty | error` state machine. It is the logic core of the reusable
`src/lib/autocomplete/` layer — no UI, no GitHub knowledge, no app imports.

## Files touched

- `src/lib/autocomplete/types.ts` — NEW — public types: `AutocompleteState<T>`, `AutocompleteHandlers`, `UseAutocompleteOptions<T>`, `AutocompleteStatus`, `AutocompleteError` (TSDoc on every field).
- `src/lib/autocomplete/useAutocomplete.ts` — NEW — the hook implementation.
- `src/lib/autocomplete/useAutocomplete.test.tsx` — NEW — 12 unit tests (fake timers, deferred stub, no network).
- `src/lib/autocomplete/.gitkeep` — DELETE — directory now has real content.

## Public API

```ts
const { state, handlers } = useAutocomplete<T>({
  fetchSuggestions, // required: (query: string, signal: AbortSignal) => Promise<T[]>
  getItemKey,       // optional: (item: T) => string — consumed from 1.2 onward
  minChars: 3,      // default; inclusive threshold
  debounceMs: 300,  // default
})
```

- `state` — exactly `{ query, status, items, highlightedIndex, isOpen, error? }`. `status` is the
  single source of truth for what the dropdown renders; never derive it from `items.length`.
  `error` is `{ message, cause? }` and present only when `status === 'error'`.
- `handlers` — `{ onInputChange, close, onKeyDown, onItemClick, onItemHover }`. Only
  `onInputChange` and `close` carry behavior in this story; the keyboard/pointer handlers are
  declared no-ops so 1.2 can implement them without changing the type contract.

## State machine

`idle → loading` (debounced fetch starts) · `loading → success` (resolved, ≥1 item) ·
`loading → empty` (resolved, 0 items — distinct from `success` so the UI can say "No matches") ·
`loading → error` (rejected, non-abort) · any → `idle` (query drops below `minChars`).

## Behavior

- **Threshold (inclusive):** queries shorter than `minChars` issue no request; the dropdown closes,
  state resets to `idle`, and any in-flight request is aborted.
- **Debounce:** a qualifying change starts/resets a `debounceMs` timer; typing `"react"` quickly
  produces exactly one request, for `"react"`.
- **Cancellation:** one `AbortController` per fetch; the previous one is aborted on a new
  qualifying query, a threshold drop, or unmount. A stale/aborted response is discarded and can
  never overwrite newer state. `AbortError` rejections are swallowed, never surfaced as `error`.
- **Generic error passthrough:** on a non-abort rejection the hook stores a neutral
  `message` (`"Something went wrong."`) and preserves the originally thrown value as
  `error.cause`, so a source-specific adapter (Epic 2) can derive e.g. rate-limit text without the
  hook knowing anything about it.

## Deferred

- Keyboard reducers (ArrowDown/Up, Enter, Escape), item click/hover, ARIA prop getters → **1.2**.
- Rendering, CSS, message-override props → **1.3**.

## Tests

- Unit (Vitest, `vi.useFakeTimers()`, deferred `vi.fn()` stub — no MSW, no HTTP): initial idle
  state, threshold boundary 2 → 3, threshold drop closes + aborts, debounce collapsing to one
  request, custom `minChars`/`debounceMs`, success path, stale-response-ignored-via-abort,
  unmount cleanup, error path with preserved `cause`, `AbortError` swallowed, empty path,
  `close()` semantics. See `src/lib/autocomplete/useAutocomplete.test.tsx`.
- Manual: none — headless logic with no rendered UI, fully covered by unit tests
  (`MANUAL_TESTING.md` intentionally omitted).
- Performance-relevant guarantees: see [PERFORMANCE.md](./PERFORMANCE.md).

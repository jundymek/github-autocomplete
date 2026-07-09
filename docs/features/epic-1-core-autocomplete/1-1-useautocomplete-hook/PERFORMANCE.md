# Performance — 1.1 `useAutocomplete<T>` hook

This story owns the two request-volume/perceived-latency mechanisms of the component (NFR-2):
debouncing and abort-based stale-response suppression.

## Debounce window: 300 ms (default, configurable)

Every qualifying input change clears the previous timer and starts a new `debounceMs` timer; the
fetch fires only after the input has been stable for the full window. 300 ms is the conventional
sweet spot for type-ahead: short enough to feel responsive after a pause, long enough that
continuous typing (inter-keystroke gaps are typically well under 300 ms) produces no intermediate
requests — important against the unauthenticated GitHub rate limit this component will run under.
Integrators can tune it via `debounceMs`.

**Guarantee — exactly one request per settled query:** typing `"react"` as five rapid keystrokes
issues exactly one `fetchSuggestions` call, with `"react"`.
Proof: test "collapses rapid keystrokes into exactly one request for the settled query"
(`src/lib/autocomplete/useAutocomplete.test.tsx`), driven by `vi.useFakeTimers()`.

The threshold gate (`minChars`, default 3, inclusive) additionally means sub-threshold queries cost
zero requests — proof: "does not fetch below minChars and fetches at exactly minChars".

## AbortController lifecycle

One fresh `AbortController` per fetch, held in a ref. The previous controller is aborted on:

1. a new qualifying query (debounce settled) — before the new fetch starts;
2. the query dropping below `minChars`;
3. unmount.

Aborting lets the adapter's `fetch` actually cancel the network request (the signal is passed
through `fetchSuggestions(query, signal)`), so abandoned requests stop consuming bandwidth and
rate-limit budget as soon as the browser can drop them.

Proofs: "closes the dropdown, resets to idle, and aborts in-flight fetch when the query drops
below minChars" (2), "ignores a stale response: aborts A on query change…" (1), "aborts the
in-flight fetch on unmount and never updates state afterwards" (3).

## No stale-response flicker

A response may still arrive after its controller was aborted (races, or sources that ignore the
signal). Commits are therefore guarded: a result is applied only if its owning controller is still
the current one *and* the hook is still mounted; `AbortError` rejections are swallowed. A slow
response for an old query can never overwrite the state of a newer one — the UI never flickers
back to stale suggestions.

Proofs: "ignores a stale response: aborts A on query change and only ever renders B" and
"swallows AbortError rejections instead of surfacing an error state".

## Render volume

State lives in a single `useState` object; each lifecycle step commits at most one state update,
and all handlers are `useCallback`-stable, so consumers re-render only on actual state
transitions. No memoization beyond that is needed at this layer.

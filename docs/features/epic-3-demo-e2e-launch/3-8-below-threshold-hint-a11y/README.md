# 3.8 — Announce the below-threshold hint (accessibility for the "type N more characters" gate)

## What was built

The below-threshold gating hint ("Type N more characters to search") was **visual-only**: while a
focused input holds 1–2 characters (below the default `minChars: 3`), the popup rendered the hint,
but the visually-hidden `aria-live="polite"` region stayed empty and the input was not linked to the
hint. A screen-reader user got no feedback that the search was gated.

This story adds — **at the component layer only** (`Autocomplete.tsx`), without touching the hook's
`isOpen:false` / empty-`statusMessage` invariant:

1. The live region announces a **plain-text** form of the hint while below threshold, tracking the
   remaining count as the user types; otherwise it keeps deriving from `state.statusMessage`
   (loading/empty/error/results) exactly as before.
2. The input gets `aria-describedby` pointing at the visible hint node **only** while below
   threshold — absent otherwise and after an Escape-dismiss, so there is never a dangling reference.

## Files touched

- `src/lib/autocomplete/Autocomplete.tsx` — UPDATE — plain-text `defaultBelowThresholdAnnouncement`
  builder; compute the announcement string and feed the one live region (`belowThreshold` → hint,
  else `state.statusMessage`); stable `hintId` (via `useId`) on the visible hint node; input
  `aria-describedby={belowThreshold ? hintId : undefined}` composed after the `{...inputProps}`
  spread.
- `src/lib/autocomplete/types.ts` — UPDATE — new optional `messages.belowThresholdAnnouncement:
  (remainingChars: number) => string` (plain-text sibling of the rich `belowThreshold`), documented.
- `src/lib/autocomplete/Autocomplete.test.tsx` — UPDATE — new describe block: live-region text +
  count update, `aria-describedby` present only below threshold, dropped on Escape-dismiss, override
  reflected in both the visual hint and the announcement, and a regression that at/above threshold
  the normal state is announced with no `aria-describedby`.
- `e2e/a11y.spec.ts` — UPDATE — an axe scan of the below-threshold state (asserts
  `aria-describedby` is present and the described hint is visible before scanning).
- `README.md` — UPDATE — documents `messages.belowThresholdAnnouncement`.

## Key decisions

- **New parallel message option, not reuse of `messages.belowThreshold`.** `belowThreshold` is typed
  `(remaining) => ReactNode` and the default returns JSX (bold count), so it cannot reliably yield a
  flat announcement string, and the spec forbids reading text back out of rendered nodes (AC 2). A
  minimal parallel option `belowThresholdAnnouncement: (remaining) => string` (default mirrors the
  visual text) is the smaller correct change — a host can localize the sighted hint and its
  announcement together. This is the "rich visual vs. flat announcement" split the spec calls for.
- **One live region.** Its text is `belowThreshold ? announcement : state.statusMessage` — the two
  sources never fight (exactly one is active per render) and there is no second live region (which
  would double-announce).
- **`aria-describedby` lives at the component layer**, composed after the `{...inputProps}` spread —
  the hook's `getInputProps()` is generic and emits no `aria-describedby`, so there is no conflict.
- **Hook unchanged.** `useAutocomplete.ts`'s `isOpen:false` below threshold and `deriveStatusMessage`
  returning `''` when closed are correct fetch-state-machine invariants (AC 6) and were not touched.
- **No adapter change.** The fix is entirely in the lib layer; `src/features/` and `src/demo/` were
  not touched — both the GitHub and country instances inherit the announcement with zero code.

## How it works

`belowThreshold` (already computed by the component: focused + non-empty + `< minChars` + not
Escape-dismissed) selects the announcement source. When true, `defaultBelowThresholdAnnouncement`
(or the `messages.belowThresholdAnnouncement` override) builds `Type N more character(s) to search`
from `minChars - query.length`; the polite region coalesces the wholesale text change as the count
drops (no extra debounce needed). The same `belowThreshold` flag toggles the input's
`aria-describedby` and the visible hint carries the matching `id`.

## Tests

- **Unit/integration (RTL):** below-threshold live-region text + count update (`Type 2…` → `Type
  1…`); `aria-describedby` present only below threshold and dropped after Escape-dismiss; a
  `messages.belowThreshold` + `belowThresholdAnnouncement` override reflected in both the visual hint
  and the announcement; regression that at/above threshold the normal `3 results` message is
  announced with no `aria-describedby`.
- **E2E / axe:** a below-threshold scan in `e2e/a11y.spec.ts` — zero critical/serious violations with
  the new `aria-describedby` present.
- **Manual:** see [MANUAL_TESTING.md](./MANUAL_TESTING.md) (VoiceOver screen-reader steps).

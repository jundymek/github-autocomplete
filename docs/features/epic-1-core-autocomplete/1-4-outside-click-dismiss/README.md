# 1.4 — Outside-click / focus-loss dismissal for the `Autocomplete<T>` dropdown

## What was built

A follow-up bug-fix for a gap in Story 1.3: the generic `Autocomplete<T>` component previously
closed its dropdown **only** on Escape and on selecting an item. Typing a query opened the portalled
listbox, and clicking anywhere else on the page left it floating open indefinitely — visible on both
demo instances (GitHub + country) in the Story 3.1 demo.

Now, while the popup is open, a pointer press **outside** the component closes it — the same outcome
as Escape (`isOpen → false`, highlight reset, **query retained**, no new request). The fix lives
entirely in the reusable lib component, so both demo instances inherit it with no adapter changes.

## Files touched

- `src/lib/autocomplete/Autocomplete.tsx` — UPDATE — added a `popupRef` on the portalled popup div
  and a `useEffect` (gated on `popupOpen`) that attaches a `document` `pointerdown` listener; an
  outside press calls the hook's `close()` (results) and mirrors the existing Escape hint-dismiss
  (`setHintDismissedFor`) for the below-threshold hint. Listener is removed on close/unmount.
- `src/lib/autocomplete/Autocomplete.dismiss.test.tsx` — NEW — RTL tests for every AC-7 case.
- `docs/features/epic-1-core-autocomplete/1-3-autocomplete-component/{README,MANUAL_TESTING}.md` —
  UPDATE — note outside-click as a supported dismissal path.

`src/lib/autocomplete/useAutocomplete.ts` was **not** changed — the hook already exposes everything
needed (`close()`), and the story's scope guard forbids touching its state machine.

## Key decisions

- **`pointerdown`, not `click` or `blur`.** A `blur` on the input fires *before* an option's
  `click`/`pointerup`, so a blur-driven close would tear the popup down before the selection
  resolves — the classic "clicking my own dropdown selects nothing" bug. `pointerdown` closes
  promptly on press, before focus churn, and covers mouse + touch + pen. Focus-loss dismissal is
  achieved through this same outside-`pointerdown` path, never via an input `onBlur`.
- **Portal-aware "inside" check.** The popup is portalled to `document.body`, so it is **not** a DOM
  descendant of the component root. A naive `root.contains(target)` is `false` for option clicks and
  would break every selection. The close condition is therefore
  `!rootRef.current?.contains(target) && !popupRef.current?.contains(target)` — the popup element is
  explicitly treated as "inside".
- **Reuse `close()`, don't reimplement.** The results case delegates to the hook's `close()`
  (cancel debounce, abort in-flight, reset highlight, keep query) rather than duplicating that logic.
  The component's only extra responsibility is the below-threshold hint dismissal it already owns.
- **Listener lifecycle.** The listener is attached inside a `useEffect` gated on `popupOpen`
  (`state.isOpen || belowThreshold`) and removed in the effect cleanup — no listener while
  idle/closed, none left after unmount, no per-render churn. Bubbling phase is sufficient (the lib
  never `stopPropagation`s on the popup); verified by test rather than pre-emptively using capture.

## How it works

While `popupOpen` is true, `document` has one `pointerdown` listener. On each press it resolves the
event target and closes only if the target is outside **both** `rootRef` and `popupRef`. For the
results popup it calls `handlers.close()`; if the below-threshold hint is showing it also records
`hintDismissedFor = query` so re-focusing without typing does not re-show it (identical to the
Escape path). Typing a new query resets that and re-shows the hint as before.

## Tests

- Unit/integration (`Autocomplete.dismiss.test.tsx`, RTL): (a) outside `pointerdown` closes an open
  results dropdown, sets `aria-expanded="false"`, retains the query, and fires no new request;
  (b) `pointerdown` on an option inside the portal selects it (`onSelect` once) and does not
  pre-close, and a press on the footer inside the popup does not close it; (c) Escape still closes +
  retains query (regression guard); (d) outside press dismisses the below-threshold hint and typing
  re-shows it; (e) the `document` `pointerdown` listener is removed on unmount and on close, with no
  fire/throw after unmount.
- All 119 existing lib tests (including every Story 1.3 test) pass unchanged.
- Manual: see [MANUAL_TESTING.md](./MANUAL_TESTING.md) — also verified end-to-end in a real browser
  against the Story 3.1 demo (country instance): open → click outside closes with query retained;
  option click still selects; Escape still works; below-threshold hint dismisses on outside press.

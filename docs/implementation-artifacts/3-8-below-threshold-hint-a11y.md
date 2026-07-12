---
baseline_commit: b8ae32ce7be796cc9bcde2606b6624095034bdc4
---

# Story 3.8: Announce the below-threshold hint — accessibility for the "type N more characters" gate

Status: draft

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a screen-reader user of any `Autocomplete<T>` instance,
I want the "type N more characters to search" gating hint to be announced (and associated with the
input) the same way sighted users see it,
so that I understand why nothing is happening below the `minChars` threshold instead of typing into
apparent silence (task.md "visual feedback" generalized to non-visual; NFR-1 accessibility; §3.5
ARIA/live-region contract).

## Background (why this follow-up exists)

An independent senior review of the delivered implementation (2026-07-12, over commit `b8ae32c`)
found the below-threshold hint is **visual-only**. When a focused input holds 1–2 characters
(below the default `minChars: 3`), the component renders a popup with "Type N more characters to
search", but:

- The hint popup opens on the component-local `belowThreshold` flag, while `state.isOpen` stays
  `false` (the hook never opens below threshold — correct for the fetch state machine).
- The visually-hidden live region renders `state.statusMessage`, which is empty whenever
  `!state.isOpen` (see `deriveStatusMessage`: `if (!state.isOpen) return ''`). So below threshold the
  live region says nothing.
- The input is not linked to the hint via `aria-describedby`.

Net effect: a screen-reader user gets no feedback that the search is gated and how many more
characters are needed — the one state the component shows purely on the component-local flag is the
one it does not announce. Every other state (loading/empty/error/results) is announced through the
live region because those set `isOpen: true`.

The below-threshold hint is a **component-layer** concept (the hook deliberately owns only the fetch
lifecycle and never opens below threshold), so the fix lives in `Autocomplete.tsx` — not by forcing
the hook to open below threshold (that would corrupt the state machine), but by announcing/associating
the hint at the component layer where `belowThreshold` already exists.
[Source: independent review 2026-07-12; src/lib/autocomplete/Autocomplete.tsx (`belowThreshold`,
`popupBody` hint branch, `srOnly` live region); src/lib/autocomplete/useAutocomplete.ts
(`deriveStatusMessage` returns '' when closed — intentional, do not change);
docs/planning-artifacts/architecture.md#3.5/#AR-4; CLAUDE.md#Architecture boundary]

## Acceptance Criteria

1. **The below-threshold hint is announced via the live region (UPDATE `Autocomplete.tsx`).**
   While `belowThreshold` is true, the component's existing visually-hidden `role="status"
   aria-live="polite"` region contains the hint text (a plain-string form of the "type N more
   characters to search" message), so a screen reader announces it politely as the user types 1→2
   characters and the remaining count changes. When `belowThreshold` is false, the live region keeps
   deriving from `state.statusMessage` exactly as today (loading/empty/error/results). The two
   sources must not fight: below threshold → the hint string; otherwise → `state.statusMessage`.
2. **A plain-text announcement string exists alongside the rich visual hint.** The visual hint may be
   `ReactNode` (it renders "**N** more character(s)" with a bold count). The announcement needs a
   flat string. Provide a default plain-text builder (e.g. `Type N more character(s) to search`) and
   let a host override it. Reuse the existing `messages.belowThreshold` override if it can yield a
   string, or add a parallel plain-text message option — choose the smaller public-API change and
   document it. Do not read text back out of rendered `ReactNode`.
3. **The input is associated with the hint via `aria-describedby` while below threshold.** The hint
   element (or a dedicated visually-rendered hint node) carries a stable id derived from the hook's
   base id, and the input gets `aria-describedby={hintId}` **only** while `belowThreshold` is true;
   the attribute is absent otherwise (no dangling reference). This does not go through
   `getInputProps()` (which is the hook's generic ARIA and knows nothing about the component-local
   below-threshold concept) — it is added at the component layer on the rendered `<input>`, composed
   with the spread `inputProps` without overwriting any hook-provided attribute.
4. **The count updates are announced, not spammed.** Typing "r" → "re" changes "3 more" → "2 more";
   the polite live region announces the current value. Because it is `aria-live="polite"` and the
   text changes wholesale, the assistive tech coalesces rapid changes — no extra debounce is needed.
   Verify the region's text tracks `minChars - query.length`.
5. **No regression to the visual hint or to any other state's announcement.** The visible popup hint
   is unchanged (still the rich `ReactNode` with the bold remaining count). Loading/empty/error/
   results announcements are unchanged (they still flow from `state.statusMessage` with `isOpen`
   true). Escape-dismiss of the hint (existing `hintDismissedFor` behavior) also clears the
   announcement and removes `aria-describedby` (the hint is no longer shown, so nothing to describe).
6. **The hook is not changed to open below threshold.** `state.isOpen` stays `false` below threshold
   and `deriveStatusMessage` keeps returning `''` when closed — those are correct invariants of the
   fetch state machine (idle below threshold). This story adds the announcement at the component
   layer only. (`useAutocomplete.ts` and `types.ts` for the hook are expected UNCHANGED unless a
   plain-text message option is genuinely better placed on the hook's `statusMessages`; if so, keep
   it minimal and documented.)
7. **Tests (test-first).**
   - Component (RTL): focus + type 1 char (below `minChars`) → the live region (`role="status"`)
     contains the plain hint text with the correct remaining count; type a 2nd char → count updates;
     the input has `aria-describedby` pointing at the visible hint element while below threshold and
     **not** once at/above threshold or when the hint is Escape-dismissed.
   - Custom `minChars` and a `messages.belowThreshold`/plain-text override are reflected in both the
     visual hint and the announcement.
   - Regression: at/above threshold the live region announces the normal state messages
     (loading/empty/error/results) and carries no `aria-describedby` to the hint.
   - The country instance (different `minChars`? verify) still announces correctly — the behavior is
     generic, not GitHub-specific.
8. **E2E / axe.** The `e2e/a11y.spec.ts` axe scan must stay clean with the new `aria-describedby`
   present. Add (or extend an existing) below-threshold assertion only if it can ride the existing
   thin flow; a dedicated new spec is likely unwarranted for a live-region string. Verify the axe
   scan exercises (or is extended to exercise) the below-threshold state at least once.
9. **Everything stays green.** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` all pass.

## Tasks / Subtasks

- [ ] Task 1 — Announcement string + live-region wiring (AC: 1, 2, 4) — test-first
  - [ ] Add the RTL tests (red): below-threshold live-region text + count updates + override.
  - [ ] Add a default plain-text below-threshold builder and (if needed) a minimal public message
        option; feed the hint string into the existing `role="status"` region when `belowThreshold`,
        else keep `state.statusMessage` (green).
- [ ] Task 2 — `aria-describedby` association (AC: 3, 5) — test-first
  - [ ] Add the RTL tests (red): input `aria-describedby` present only below threshold, absent
        otherwise and after Escape-dismiss; points at the visible hint element.
  - [ ] Give the hint element a stable id (derived from the hook base id / `useId`); set
        `aria-describedby` on the input at the component layer, composed with `inputProps` without
        clobbering hook ARIA (green).
- [ ] Task 3 — Docs & API surface (AC: 2)
  - [ ] If a public message option changed/was added: document it in `types.ts` and the root README
        Component API section (from 3.3). If the existing `messages.belowThreshold` sufficed, note
        that no API change was needed.
- [ ] Task 4 — Verify (AC: 6, 8, 9)
  - [ ] Full suite: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` (axe clean below
        threshold).
  - [ ] `pnpm dev` + screen-reader spot check (VoiceOver): focus, type 1 then 2 chars, confirm the
        remaining-count hint is announced and the input is described by it; both instances.
- [ ] Task 5 — Docs (deliverables below)
  - [ ] `docs/features/epic-3-demo-e2e-launch/3-8-below-threshold-hint-a11y/README.md`.
  - [ ] `docs/features/epic-3-demo-e2e-launch/3-8-below-threshold-hint-a11y/MANUAL_TESTING.md`
        (screen-reader steps: focus, type below threshold, hear the hint + count update; describe the
        `aria-describedby` expectation; both instances).

## Non-goals (deliberate)

- **Do not make the hook open below threshold.** The `idle`/`isOpen:false` below-threshold invariant
  is correct and tested; forcing `isOpen:true` would leak a non-fetch popup state into the fetch
  state machine and break loading/empty/error derivation. The announcement is a component-layer
  concern.
- **No `role="alert"` / assertive region.** The hint is advisory, not an error; `aria-live="polite"`
  (the existing region) is correct. Do not escalate politeness.
- **No visual change to the hint.** The rich `ReactNode` with the bold remaining count stays. This
  story adds a non-visual announcement + association, nothing visual.
- **No announcement when the input is empty/blurred.** `belowThreshold` already requires focus and a
  non-empty query below threshold (and not Escape-dismissed) — keep that exact gate; an empty focused
  input announces nothing.
- **No new dependency, no `--ac-*` token additions (AR-1, Story 0.3).**

## Dev Notes

**Current state (verified 2026-07-12, commit b8ae32c).**
- `Autocomplete.tsx`:
  - `belowThreshold = isFocused && query.length > 0 && query.length < minChars && hintDismissedFor !== query`.
  - `popupOpen = state.isOpen || belowThreshold`; the hint popup renders on `belowThreshold` via
    `popupBody()`'s first branch (`messages?.belowThreshold ?? defaultBelowThresholdHint`).
  - The live region: `<div className={styles.srOnly} role="status" aria-live="polite">{state.statusMessage}</div>`
    — `state.statusMessage` is `''` below threshold, so nothing is announced.
  - `defaultBelowThresholdHint(remaining)` returns a `ReactNode` ("Type **N** more character(s) to
    search") — the visual form; a flat string sibling is needed for the announcement (AC 2).
- `useAutocomplete.ts` `deriveStatusMessage`: `if (!state.isOpen) return ''` — intentional; below
  threshold `isOpen` is false. Do NOT change this to "fix" the announcement; announce at the
  component layer instead.
- `getInputProps()` returns generic ARIA (combobox/expanded/controls/activedescendant) and knows
  nothing about below-threshold — so `aria-describedby` must be added at the component layer on the
  `<input>`, composed with the spread `inputProps` (AC 3).

**Why the component, not the hook, owns this.** The hook is the reusable state machine for
*fetching*; "below threshold" is the absence of a fetch, surfaced by the component as a hint. The
component already computes `belowThreshold` and renders the hint — announcing and associating it is a
presentation concern that belongs where the hint lives. Pushing it into the hook would make the hook
learn a component-only concept.

**Composing `aria-describedby`.** The input is rendered as `<input {...inputProps} ... />` with an
explicit `onKeyDown`/`onFocus`/`onBlur` already layered on top. Add `aria-describedby={belowThreshold
? hintId : undefined}` in the same explicit-props layer, after the spread, so it never overwrites a
hook attribute (the hook does not emit `aria-describedby`, so there is no conflict — verify). Give the
hint node `id={hintId}` where `hintId` derives from a `useId()` (component-local is fine; it need not
come from the hook).

**Announcement source-of-truth.** Keep one live region. Its text = below threshold ? plainHint :
`state.statusMessage`. Do not add a second live region (double announcements). The plain hint builder
mirrors the visual one but returns a string; if `messages.belowThreshold` already returns a string in
practice, reuse it — otherwise add a small parallel option and document the split (rich visual vs.
flat announcement) so a host can localize both.

**MSW, not fetch stubs** for any component test that crosses the threshold into a fetch; the
below-threshold assertions need no network (no fetch fires below threshold).

**Both instances inherit the fix with zero adapter code.** If a `src/features/`/`src/demo/` file
needs a behavior change, the fix leaked out of the lib layer — stop.

**Branch & PR.** `story/3-8-below-threshold-hint-a11y` → `master`, squash. Commit e.g.
`fix(3.8): announce the below-threshold hint to assistive tech`. **No AI attribution / no
`Co-Authored-By`.** Run the mandatory pre-PR review gate (security review + independent second-pass
review + verified triage), re-run the full verification after any fix, then PR.
[Source: CLAUDE.md#Working rules / #Story pipeline]

### Project Structure Notes

- Files this story touches:
  - `src/lib/autocomplete/Autocomplete.tsx` — UPDATE — announce hint in the live region + input
    `aria-describedby` while below threshold; plain-text hint builder (AC 1, 2, 3).
  - `src/lib/autocomplete/types.ts` — UPDATE (only if a plain-text message option is added) — document it (AC 2).
  - `src/lib/autocomplete/Autocomplete.test.tsx` — UPDATE/NEW — live-region text, count update,
    `aria-describedby` presence/absence, override (AC 7).
  - `e2e/a11y.spec.ts` — UPDATE (only if a below-threshold axe assertion is added) (AC 8).
  - `README.md` — UPDATE (only if the public message API changed) (AC 2).
  - `docs/features/epic-3-demo-e2e-launch/3-8-below-threshold-hint-a11y/{README.md,MANUAL_TESTING.md}` — NEW.
  - `docs/implementation-artifacts/3-8-below-threshold-hint-a11y.md` — UPDATE — Dev Agent Record on completion.
- `src/lib/autocomplete/useAutocomplete.ts` expected UNCHANGED (the `isOpen:false`/empty-message
  invariants are correct). `src/features/`, `src/demo/` expected UNCHANGED.
- **MANUAL_TESTING.md required** (screen-reader-verifiable behavior). **PERFORMANCE.md not required**.
  [Source: CLAUDE.md#Documentation deliverables]

### References

- [Source: independent senior review, 2026-07-12, over commit b8ae32c — "the below-threshold hint is
  only rendered visually; the live region never announces it and the input isn't linked via ARIA"]
- [Source: src/lib/autocomplete/Autocomplete.tsx — `belowThreshold`, `popupBody` hint branch,
  `defaultBelowThresholdHint`, `srOnly` live region, `hintDismissedFor`]
- [Source: src/lib/autocomplete/useAutocomplete.ts — `deriveStatusMessage` (returns '' when closed),
  `getInputProps` generic ARIA]
- [Source: docs/planning-artifacts/architecture.md#3.5 (live region / ARIA) / #AR-4 (component surface)]
- [Source: docs/implementation-artifacts/1-3-autocomplete-component.md — the `aria-live` status region
  this extends]
- [Source: CLAUDE.md#Architecture boundary / #Working rules / #Story pipeline / #Documentation deliverables]

## Dev Agent Record

### Agent Model Used

_(to be filled by the dev agent)_

### Implementation Plan

_(to be filled by the dev agent)_

### Debug Log References

_(to be filled by the dev agent)_

### Completion Notes List

_(to be filled by the dev agent)_

### Pre-PR Review Gate

_(to be filled by the dev agent)_

### File List

_(to be filled by the dev agent)_

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-12 | 0.1 | Follow-up story drafted from the independent senior review over commit b8ae32c: the below-threshold "type N more characters" hint is visual-only; announce it through the existing polite live region and associate it with the input via `aria-describedby` at the component layer (the hook's `isOpen:false` below-threshold invariant is left unchanged). | Łukasz (via BMAD create-story) |

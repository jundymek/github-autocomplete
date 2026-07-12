---
baseline_commit: 40aa1cf62ad75f96bc16942356b896ad998af169
---

# Story 3.5: Demo polish — pin the footer to the bottom of tall viewports

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a visitor viewing the demo page on a tall viewport,
I want the footer to sit at the bottom of the viewport instead of floating mid-page,
so that the page reads as a finished, deliberately composed stage rather than content that ran
out — polish on the sandbox stage only, with zero impact on the reusable component (AR-5, NFR-5).

## Background (why this follow-up exists)

A post-release visual pass (2026-07-12, after the 3.3 deploy) found that on viewports taller than
the page content (~1100 px+), the demo footer renders directly below the stage and a strip of bare
canvas continues underneath it to the bottom of the window. Nothing establishes a min-height
column: `body` has no height rule, `#root` is an unstyled div, and `footer` simply follows
`.wrap` in flow (`src/App.tsx`, `src/demo/demo.css`). The design ground truth
(`docs/design/demo-page.html`) has the same gap — it was authored for content-height screenshots,
so this story *extends* the design rather than deviating from it.

This is a demo-chrome-only fix. It must not touch `src/lib/autocomplete/` (the component imposes
no layout on a host — AR-5) and must not disturb the `?clip=1` clipping host used by the e2e
overflow spec.
[Source: src/App.tsx; src/demo/demo.css; src/index.css; docs/design/demo-page.html;
docs/planning-artifacts/architecture.md#AR-5]

## Acceptance Criteria

1. **Sticky-footer column on the demo page.** On viewports taller than the page content, the
   footer's bottom edge sits at the bottom of the viewport, with the canvas gap absorbed *above*
   the footer's top border (the standard sticky-footer pattern), not by stretching the footer
   itself. Concretely, in `src/demo/demo.css`:
   - `#root` becomes a min-full-height flex column:
     `display: flex; flex-direction: column; min-height: 100vh;` followed by
     `min-height: 100dvh;` (the `vh` line is the fallback for browsers without dynamic viewport
     units; keep both, `dvh` last so it wins where supported).
   - `footer { margin-top: auto; }` pushes the footer to the column's end.
   No other layout rule changes. `.wrap`, `.stage`, header and panel rules are untouched.
2. **Short viewports are unaffected.** When content is taller than the viewport (e.g. the 860 px
   single-column breakpoint, or the dropdown open with 50 results), the page scrolls exactly as
   before — `min-height` (never `height`) guarantees the column can grow; nothing clips or
   overlaps, and the footer follows the content as today.
3. **The clipping host route stays intact.** `/?clip=1` renders only `.wrap > ClippingHost`
   (no footer), so the flex column has a single child and the layout inside `.wrap` is
   unchanged. The e2e clipping spec passes unmodified.
4. **The reusable component is untouched.** No file under `src/lib/autocomplete/` changes; the
   popup's portalled positioning (measured from the input's viewport rect) is unaffected by the
   root becoming a flex column.
5. **Everything stays green.** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` all
   pass with no test modifications (this story is CSS-only; existing e2e specs — including the
   axe scan — are the regression net).
6. **Design ground truth follows.** `docs/design/demo-page.html` gets the same two rules
   (`#root`-equivalent wrapper or `body` column + `footer { margin-top: auto }`, matching how
   that file is structured) so the mockup and the app do not drift. Visual parity spot-checked.

## Tasks / Subtasks

- [x] Task 1 — Sticky-footer CSS (AC: 1, 2)
  - [x] Add the `#root` flex-column block (with the `100vh` → `100dvh` fallback pair) to
        `src/demo/demo.css`, placed near the `body` rule with a short comment stating the
        constraint (demo chrome only; `min-height` so short viewports still scroll).
  - [x] Add `margin-top: auto;` to the existing `footer` rule.
- [x] Task 2 — Design ground truth (AC: 6)
  - [x] Port the same pattern into `docs/design/demo-page.html`.
- [x] Task 3 — Verify (AC: 2, 3, 4, 5)
  - [x] `pnpm dev` spot-check: tall viewport (footer pinned, gap above the border), narrow/short
        viewport (scrolls as before), dropdown open with 50 results (unchanged), `/?clip=1`
        (clipping host renders as before). Self-verified via built preview + Chromium geometry
        measurement — all four scenarios PASS (see MANUAL_TESTING.md Result section).
  - [x] `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` all green (205 unit, 14 e2e).
- [x] Task 4 — Docs (deliverables below)
  - [x] `docs/features/epic-3-demo-e2e-launch/3-5-sticky-footer/README.md`.
  - [x] `docs/features/epic-3-demo-e2e-launch/3-5-sticky-footer/MANUAL_TESTING.md` (this is
        visible browser behavior; steps mirror the Task 3 spot-check).

## Non-goals (deliberate)

- **No new e2e test.** A viewport-geometry assertion (footer bottom == viewport bottom) would be
  brittle across engines for near-zero regression value; the existing e2e suite already loads the
  page and runs axe. The manual-testing doc covers the visual check.
- **No `position: sticky`/`fixed` footer.** The footer must not overlay content or persist while
  scrolling — the requirement is only "no dead canvas below the footer on tall screens".
- **No layout work inside `src/lib/autocomplete/`** — the component imposes no host layout (AR-5);
  there is nothing to change there.
- **No dark-mode or responsive redesign.** Only the vertical column behavior changes.

## Dev Notes

**Current state (verified 2026-07-12, commit 40aa1cf).**
- `src/App.tsx` renders `<><div class="wrap">header + stage</div><DemoFooter /></>` into
  `<div id="root">` (`index.html:23`). In `?clip=1` mode it renders only
  `<div class="wrap"><ClippingHost /></div>` — no footer, so AC 3 is satisfied structurally.
- `src/index.css` only sets `color-scheme` and `body { margin: 0 }`. `src/demo/demo.css` owns all
  page chrome; `body` there sets font/background/color, and `footer` is
  `border-top … ; padding: 22px 0 44px;`. No element in the chain has any height rule today.
- The footer markup is `DemoFooter.tsx` (`<footer><div class="wrap">…</div></footer>`) — static,
  presentational; no component change is needed.

**Why `#root`, not `body`.** React mounts the footer as a child of `#root`, so `#root` must be the
flex container for `margin-top: auto` to work. Styling `body` as the column would additionally
require `#root { display: contents }` or a grown flex child — more moving parts for the same
result. Keep it to two rules.

**Why the `100vh` fallback line.** `dvh` avoids the mobile URL-bar overshoot that plain `vh` has,
but is the newer unit; declaring `min-height: 100vh;` immediately followed by
`min-height: 100dvh;` gives every browser a working value (the cascade keeps the last supported
one). This mirrors the project's "latest platform features with graceful fallback" posture (AR-1).

**Where the slack goes.** With `footer { margin-top: auto }`, the spare vertical space lands
between `.wrap` (whose `.stage` already ends in `padding-bottom: 96px`) and the footer's
`border-top` — the canvas simply extends above the footer line, which is the intended look.
Do not stretch `.wrap` (`flex: 1` is unnecessary and would change nothing visible; leave it out).

**Portal positioning is viewport-based.** `Autocomplete.tsx` positions the portalled popup from
the input's `getBoundingClientRect()` measured at open/scroll/resize — a flex-column root does not
alter that math. No lib concern. [Source: src/lib/autocomplete/Autocomplete.tsx (usePopupStyle)]

**Tests.** CSS-only story: no unit test surface. The full suite (205 unit, 14 e2e incl. axe) runs
as the regression net (AC 5). MANUAL_TESTING.md is required because the story ships visible
browser behavior. PERFORMANCE.md is not required (no performance dimension).
[Source: CLAUDE.md#Documentation deliverables]

**No new dependency; no version changes (AR-1).** This story installs nothing.

**Branch & PR.** `story/3-5-sticky-footer` → `master`, squash. Commit e.g.
`fix(3.5): pin demo footer to the bottom of tall viewports`. **No AI attribution / no
`Co-Authored-By`.** Run the mandatory pre-PR review gate (security review + independent
second-pass review + verified triage), re-run the full verification after any fix, then PR.
[Source: CLAUDE.md#Working rules / #Story pipeline]

### Project Structure Notes

- Files this story touches:
  - `src/demo/demo.css` — UPDATE — `#root` flex column + `footer { margin-top: auto }` (AC 1).
  - `docs/design/demo-page.html` — UPDATE — same pattern in the design ground truth (AC 6).
  - `docs/features/epic-3-demo-e2e-launch/3-5-sticky-footer/README.md` — NEW — story docs.
  - `docs/features/epic-3-demo-e2e-launch/3-5-sticky-footer/MANUAL_TESTING.md` — NEW — visual
    verification steps.
  - `docs/implementation-artifacts/3-5-sticky-footer.md` — UPDATE — Dev Agent Record on completion.
- Nothing under `src/lib/`, `src/features/`, `e2e/` or configuration changes.

### References

- [Source: src/App.tsx — root structure; clip-mode branch renders no footer]
- [Source: index.html:23 — `<div id="root">` mount point]
- [Source: src/demo/demo.css — `body`, `.wrap`, `.stage`, `footer` rules this story extends]
- [Source: src/index.css — global reset (margin 0) already in place]
- [Source: docs/design/demo-page.html — design ground truth to keep in sync (AC 6)]
- [Source: docs/planning-artifacts/architecture.md#AR-5 — component imposes no host layout]
- [Source: CLAUDE.md#Architecture boundary / #Working rules / #Story pipeline / #Documentation deliverables]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (claude-opus-4-8[1m]) via BMAD dev-story workflow.

### Implementation Plan

1. Add the `#root` flex-column block (`display: flex; flex-direction: column; min-height: 100vh;`
   then `min-height: 100dvh;`) near the `body` rule in `src/demo/demo.css`, plus `margin-top: auto`
   on the existing `footer` rule (AC 1, 2).
2. Port the same pattern into `docs/design/demo-page.html` — there `body` is the flex column since
   that file has no `#root` and wraps `.wrap` + `footer` directly (AC 6).
3. Write README.md and MANUAL_TESTING.md.
4. Full verification + self-executed manual test (geometry measured on a built preview).
5. Review gate (security review + codex-rescue second pass + triage), then PR.

### Debug Log References

None — no defects encountered. CSS-only change; no test modifications.

### Completion Notes List

- Implemented exactly the two rules in AC 1: `#root` flex column with the `100vh → 100dvh` fallback
  pair, and `footer { margin-top: auto }`. No other layout rule touched (`.wrap`, `.stage`, header,
  panel rules unchanged). Verified no file under `src/lib/` changed (AC 4) — diff is only
  `src/demo/demo.css` and `docs/design/demo-page.html` (+ docs).
- Design ground truth kept in sync (AC 6): `body` is the flex column there, matching that file's
  structure; the app uses `#root` matching React's mount point.
- **Self-verified manual testing** against a real `pnpm build && pnpm preview` app, driving Chromium
  and measuring geometry: tall 1200×1400 → footer bottom = 1400 = viewport height, not scrollable
  (pinned, ~539 px absorbed above the border); short 1200×600 → scrollable, footer follows content
  (margin-top collapses to 0); narrow 700×600 → single-column, scrollable, unaffected; `/?clip=1` →
  no footer, single `.wrap` child in `#root`, route intact. All PASS. Dropdown-50-results case is
  covered by the passing e2e clipping spec.
- **Review gate — security review:** ran the /security-review skill. The actual working-tree diff is
  two CSS declarations plus two markdown docs — no code execution, user input, dynamic HTML,
  data flow, or dependency changes. **Zero security findings** (no attack surface introduced). (Note:
  the skill's auto-captured `git diff` initially showed the previously-committed 3.5/3.6 spec docs
  rather than this branch's working-tree CSS; the assessment above is against the real story diff.)
- **Review gate — independent second pass (codex-rescue):** see triage below.
- Verification: `pnpm lint && pnpm typecheck && pnpm test` (205 unit) and `pnpm test:e2e` (14 e2e
  incl. axe + clipping) all green.

### Review Triage (codex-rescue second pass)

Independent second-pass review via the codex-rescue agent (Codex, read-only) over the story diff
with the spec as context. **Verdict: CLEAN — no blocking, no non-blocking findings.** It verified
empirically against the actual working-tree diff:

- AC1: `#root` is `display:flex; flex-direction:column; min-height:100vh; min-height:100dvh;` in the
  required order and `footer { margin-top:auto }`; no other selector/declaration changed.
- AC2: uses `min-height`, never `height`, so the column grows and short/tall/narrow viewports still
  scroll.
- AC3: `src/App.tsx` `/?clip=1` still returns only `.wrap > <ClippingHost />`, no footer.
- AC4: `git diff --name-only` lists only `docs/design/demo-page.html` and `src/demo/demo.css` —
  nothing under `src/lib/`; `Autocomplete.tsx` still positions the popup from
  `getBoundingClientRect()` (`position: fixed`), unaffected by the flex-column root.
- AC6: `body` is the flex column in the design HTML (no `#root` there) with the same
  `footer { margin-top:auto }`.
- No clipping, breakpoint, portal-positioning, reset-margin, or `.wrap { margin: 0 auto }`
  regression found.

**Triage:** No findings to fix — nothing to verify or refute. The one item the reviewer flagged as
"unverified" was the runtime test-suite green state (it ran read-only and did not execute the
suite); that is independently confirmed here — `pnpm lint && pnpm typecheck && pnpm test` (205
passed) and `pnpm test:e2e` (14 passed, incl. axe + clipping) all green. No re-run needed since no
code changed after verification.

### File List

- `src/demo/demo.css` — UPDATE — `#root` flex column (`100vh`→`100dvh` fallback) + `footer
  { margin-top: auto }`.
- `docs/design/demo-page.html` — UPDATE — same sticky-footer pattern (`body` as the flex column).
- `docs/features/epic-3-demo-e2e-launch/3-5-sticky-footer/README.md` — NEW — story documentation.
- `docs/features/epic-3-demo-e2e-launch/3-5-sticky-footer/MANUAL_TESTING.md` — NEW — visual
  verification steps + self-verified result.
- `docs/implementation-artifacts/3-5-sticky-footer.md` — UPDATE — Dev Agent Record, tasks, status.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-12 | 0.1 | Follow-up story drafted from the post-release visual pass: sticky-footer column on the demo page (`#root` flex column + `footer { margin-top: auto }`), demo chrome only, design ground truth kept in sync. | Łukasz (via BMAD create-story) |
| 2026-07-12 | 1.0 | Implemented: `#root` flex column + `footer { margin-top: auto }` in `src/demo/demo.css`; same pattern (`body` column) in `docs/design/demo-page.html`; docs added. Full suite green (205 unit, 14 e2e). Review gate passed — security review zero findings, codex-rescue second pass CLEAN. Status → review. | Dev agent (BMAD dev-story) |

/**
 * Static copy for the demo page (Story 3.1), ported from
 * `docs/design/demo-page.html`. Kept in one place so the header/panels read as
 * composition, not inline strings. Demo-only — never imported by the lib.
 */

/** Eyebrow above the headline. */
export const EYEBROW = "code challenge · makers' den"

/**
 * The four requirement facts of the "contract strip" — the task's constraints
 * surfaced as UI (min chars, cap, ordering, keyboard contract).
 */
export const CONTRACT_FACTS = [
  'min 3 characters',
  'max 50 results, combined',
  'sorted A→Z by name',
  '↑↓ browse · ↵ opens a new tab',
] as const

/**
 * Footer items (the mockup's footer). An item with an `href` renders as a link
 * to a real destination; an item without one renders as plain text, so the demo
 * never ships a dead `#` link or a misleading "source" affordance.
 */
export const FOOTER_ITEMS = [
  { label: 'source on github', href: 'https://github.com/jundymek/github-autocomplete' },
  { label: 'docs/planning-artifacts' },
] as const

export const FOOTER_TAGLINE = 'react 19 · typescript strict · zero runtime deps'

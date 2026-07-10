import type { ReactNode } from 'react'

/** Props for the demo's panel shell. */
export type PanelProps = {
  /** Stable id used by both the `<h2>` and the section's `aria-labelledby`. */
  headingId: string
  /** Short mono badge, e.g. `instance 01` / `instance 02 · same core`. */
  badge: string
  /** Panel title (the `<h2>` text). */
  title: string
  /** Sub-copy under the title (may include inline `<code>`). */
  sub: ReactNode
  /** Extra class on the `<section>` (e.g. `panel--countries` for the teal theme). */
  className?: string
  /** The panel body — the autocomplete instance and any readout. */
  children: ReactNode
}

/**
 * The shared `<section class="panel">` chrome from the mockup: a badge, a
 * heading wired to the section via `aria-labelledby`, sub-copy, and a body slot.
 * Purely presentational; each instance supplies its own body and (for the teal
 * country theme) a `--ac-*`-overriding `className`.
 */
export function Panel({ headingId, badge, title, sub, className, children }: PanelProps) {
  const sectionClass = className ? `panel ${className}` : 'panel'
  return (
    <section className={sectionClass} aria-labelledby={headingId}>
      <span className="badge">{badge}</span>
      <h2 id={headingId}>{title}</h2>
      <p className="sub">{sub}</p>
      {children}
    </section>
  )
}

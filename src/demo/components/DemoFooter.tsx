import { FOOTER_ITEMS, FOOTER_TAGLINE } from '../constants'

/**
 * The page footer from the mockup: a couple of items and a stack tagline. An
 * item with an `href` renders as a link to a real destination; an item without
 * one renders as plain text — the demo ships no dead `#` link and no misleading
 * "source" affordance. Links open in the same tab (no surprising new-tab jump).
 * Static, presentational.
 */
export function DemoFooter() {
  return (
    <footer>
      <div className="wrap">
        {FOOTER_ITEMS.map((item) => (
          <span key={item.label}>
            {'href' in item ? (
              <a href={item.href} rel="noopener noreferrer">
                {item.label}
              </a>
            ) : (
              item.label
            )}
          </span>
        ))}
        <span>{FOOTER_TAGLINE}</span>
      </div>
    </footer>
  )
}

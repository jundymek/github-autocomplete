import type { ReactNode } from 'react'

import type { Country } from './countries'

/**
 * `renderItem` for the country instance, mirroring the mockup's instance-02
 * row (`docs/design/demo-page.html`): a flag glyph in the icon slot, the country
 * name as the primary line, and `capital · currency` as the meta line.
 *
 * It uses the demo's own global classes (`ac-flag`, `ac-name`, `ac-meta` in
 * `demo.css`) — the generic component owns only the row grid/highlight chrome;
 * the cell *content* is the host's, exactly like the GitHub adapter's row. No
 * `owner/repo` path and no query `<mark>` echo here (that is GitHub's, Story 2.3).
 */
export function renderCountryItem(country: Country): ReactNode {
  return (
    <>
      <span className="ac-flag" aria-hidden="true">
        {country.flag}
      </span>
      <span>
        <span className="ac-name">{country.name}</span>
        <span className="ac-meta">
          {country.capital} · {country.currency}
        </span>
      </span>
    </>
  )
}

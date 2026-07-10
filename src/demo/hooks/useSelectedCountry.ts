import { useCallback, useState } from 'react'

import type { Country } from '../countries'

/**
 * Owns the country instance's "selected" readout state (Story 3.1, AC 4).
 * The country `onSelect` fills a visible readout in the demo instead of opening
 * a tab (that is the GitHub instance's behavior). Extracted as a tiny hook so
 * the panel component stays presentational and the selection wiring is testable
 * in isolation.
 */
export function useSelectedCountry() {
  const [selected, setSelected] = useState<Country | null>(null)
  const select = useCallback((country: Country) => setSelected(country), [])
  return { selected, select }
}

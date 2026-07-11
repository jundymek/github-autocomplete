import type { Country } from '../country/countries'

/** Props for the country instance's selection readout. */
export type SelectedReadoutProps = {
  /** The last selected country, or `null` before any selection. */
  country: Country | null
}

/**
 * The visible "selected" readout for the country instance (AC 4): the country
 * `onSelect` fills this instead of opening a tab. Announced politely so the
 * selection is conveyed to assistive tech as well as sighted users.
 */
export function SelectedReadout({ country }: SelectedReadoutProps) {
  return (
    <p className="readout" aria-live="polite">
      {country ? (
        <>
          <span className="readout-label">Selected:</span> {country.flag} {country.name} —{' '}
          {country.capital} · {country.currency}
        </>
      ) : (
        <span className="readout-empty">Nothing selected yet — pick a country above.</span>
      )}
    </p>
  )
}

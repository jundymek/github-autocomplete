import { countries, type Country } from './countries'

/**
 * Country data source for the demo's second `Autocomplete<Country>` instance
 * (Story 3.1). This is the simplest possible implementation of the AR-4
 * `fetchSuggestions(query, signal) => Promise<T[]>` contract: a synchronous,
 * case-insensitive substring filter over a static in-repo list, wrapped in a
 * resolved promise.
 *
 * It deliberately does **not** re-implement the 3-character threshold — the
 * `useAutocomplete` hook owns that (default `minChars: 3`), and reusing the
 * hook's defaults exactly like the GitHub instance IS the reuse proof (FR-14).
 * The `signal` is accepted per the contract and honored as a no-op guard even
 * though the filter never touches the network.
 */
export async function fetchSuggestions(query: string, signal: AbortSignal): Promise<Country[]> {
  if (signal.aborted) return []
  const needle = query.trim().toLowerCase()
  return countries
    .filter((country) => country.name.toLowerCase().includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name))
}

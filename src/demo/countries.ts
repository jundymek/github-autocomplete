/**
 * Static country data for the demo's second autocomplete instance (Story 3.1).
 *
 * This module is demo-only: it lives under `src/demo/` and is never imported by
 * `src/lib/**` or `src/features/**`. It exists to prove the generic
 * `Autocomplete<T>` (Story 1.3) is reusable with an entirely different data
 * source and theme — no GitHub knowledge, no network, no runtime dependency.
 * The list is a small in-repo array (AR-11 recorded assumption), sized to
 * demonstrate case-insensitive substring filtering.
 */

/** One country row rendered by the demo's country instance. */
export type Country = {
  /** Display name (the field the adapter filters and sorts on). */
  name: string
  /** Flag emoji shown in the row's icon slot. */
  flag: string
  /** Capital city, shown in the meta line (`capital · currency`). */
  capital: string
  /** ISO 4217-ish currency code, shown in the meta line. */
  currency: string
  /** ISO 3166-1 alpha-2 code — stable, unique `getItemKey`. */
  code: string
}

/**
 * A representative set covering the mockup examples (Poland, French Polynesia)
 * plus enough neighbours to show substring filtering (e.g. "pol" → Poland +
 * French Polynesia; "land" → several). Not exhaustive — this is a demo fixture.
 */
export const countries: Country[] = [
  { name: 'Argentina', flag: '🇦🇷', capital: 'Buenos Aires', currency: 'ARS', code: 'AR' },
  { name: 'Australia', flag: '🇦🇺', capital: 'Canberra', currency: 'AUD', code: 'AU' },
  { name: 'Austria', flag: '🇦🇹', capital: 'Vienna', currency: 'EUR', code: 'AT' },
  { name: 'Brazil', flag: '🇧🇷', capital: 'Brasília', currency: 'BRL', code: 'BR' },
  { name: 'Canada', flag: '🇨🇦', capital: 'Ottawa', currency: 'CAD', code: 'CA' },
  { name: 'Chile', flag: '🇨🇱', capital: 'Santiago', currency: 'CLP', code: 'CL' },
  { name: 'Finland', flag: '🇫🇮', capital: 'Helsinki', currency: 'EUR', code: 'FI' },
  { name: 'France', flag: '🇫🇷', capital: 'Paris', currency: 'EUR', code: 'FR' },
  { name: 'French Polynesia', flag: '🇵🇫', capital: 'Papeete', currency: 'XPF', code: 'PF' },
  { name: 'Germany', flag: '🇩🇪', capital: 'Berlin', currency: 'EUR', code: 'DE' },
  { name: 'Iceland', flag: '🇮🇸', capital: 'Reykjavík', currency: 'ISK', code: 'IS' },
  { name: 'Ireland', flag: '🇮🇪', capital: 'Dublin', currency: 'EUR', code: 'IE' },
  { name: 'Japan', flag: '🇯🇵', capital: 'Tokyo', currency: 'JPY', code: 'JP' },
  { name: 'Netherlands', flag: '🇳🇱', capital: 'Amsterdam', currency: 'EUR', code: 'NL' },
  { name: 'New Zealand', flag: '🇳🇿', capital: 'Wellington', currency: 'NZD', code: 'NZ' },
  { name: 'Norway', flag: '🇳🇴', capital: 'Oslo', currency: 'NOK', code: 'NO' },
  { name: 'Poland', flag: '🇵🇱', capital: 'Warsaw', currency: 'PLN', code: 'PL' },
  { name: 'Portugal', flag: '🇵🇹', capital: 'Lisbon', currency: 'EUR', code: 'PT' },
  { name: 'Spain', flag: '🇪🇸', capital: 'Madrid', currency: 'EUR', code: 'ES' },
  { name: 'Sweden', flag: '🇸🇪', capital: 'Stockholm', currency: 'SEK', code: 'SE' },
  { name: 'Switzerland', flag: '🇨🇭', capital: 'Bern', currency: 'CHF', code: 'CH' },
  { name: 'Thailand', flag: '🇹🇭', capital: 'Bangkok', currency: 'THB', code: 'TH' },
  { name: 'United Kingdom', flag: '🇬🇧', capital: 'London', currency: 'GBP', code: 'GB' },
  { name: 'United States', flag: '🇺🇸', capital: 'Washington, D.C.', currency: 'USD', code: 'US' },
]

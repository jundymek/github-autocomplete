import type { ReactNode } from 'react'

import { Autocomplete } from '../../lib/autocomplete'
import type { AutocompleteFooterContext } from '../../lib/autocomplete'
import type { Country } from '../country/countries'
import { fetchSuggestions } from '../country/countryAdapter'
import { renderCountryItem } from '../country/countryRenderItem'
import { useSelectedCountry } from '../country/useSelectedCountry'
import { Panel } from './Panel'
import { SelectedReadout } from './SelectedReadout'

/** Stable, unique key for a country row — the ISO alpha-2 code. */
function getCountryKey(country: Country): string {
  return country.code
}

/**
 * Country-specific footer: "N results · sorted A→Z" plus a "select" hint (this
 * instance selects into a readout, it does not open a tab). Non-success states
 * defer to the lib's default footer by returning `undefined`.
 */
function renderCountryFooter(context: AutocompleteFooterContext): ReactNode {
  if (context.status !== 'success') return undefined
  return (
    <>
      <span>
        {context.resultCount} result{context.resultCount === 1 ? '' : 's'} · sorted A→Z
      </span>
      <span>↑↓ browse · ↵ select</span>
    </>
  )
}

/**
 * Instance 02 (AC 4): the re-themed country picker. Renders the **same** generic
 * `Autocomplete<Country>` (Story 1.3, zero lib changes) wired to the static
 * `countryAdapter` — the reuse proof (FR-14). The threshold/debounce come from
 * the hook's defaults (`minChars: 3`), exactly like the GitHub instance; the
 * adapter only supplies data. The teal theme is applied purely via `--ac-*`
 * overrides on the `.panel--countries` ancestor (see `demo.css`) — no props here
 * touch styling.
 */
export function CountryPanel() {
  const { selected, select } = useSelectedCountry()

  return (
    <Panel
      headingId="cn-h"
      badge="instance 02 · same core"
      title="Country picker"
      className="panel--countries"
      sub={
        <>
          Identical <code>&lt;Autocomplete&gt;</code>, different <code>fetchSuggestions</code>{' '}
          (static list) and a teal theme via <code>--ac-*</code> overrides — ~20 lines of adapter
          code.
        </>
      }
    >
      <Autocomplete<Country>
        fetchSuggestions={fetchSuggestions}
        renderItem={renderCountryItem}
        getItemKey={getCountryKey}
        onSelect={select}
        label="Search countries"
        placeholder="Search countries…"
        renderFooter={renderCountryFooter}
      />
      <SelectedReadout country={selected} />
    </Panel>
  )
}

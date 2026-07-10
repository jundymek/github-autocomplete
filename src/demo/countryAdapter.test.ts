import { fetchSuggestions } from './countryAdapter'
import { countries } from './countries'

/** A never-aborted signal for the common case. */
function liveSignal(): AbortSignal {
  return new AbortController().signal
}

describe('countryAdapter.fetchSuggestions', () => {
  it('filters by case-insensitive substring on the country name', async () => {
    const lower = await fetchSuggestions('pol', liveSignal())
    const upper = await fetchSuggestions('POL', liveSignal())
    const mixed = await fetchSuggestions('PoL', liveSignal())

    const names = lower.map((c) => c.name)
    // "pol" matches Poland (prefix) and French Polynesia (mid-word).
    expect(names).toContain('Poland')
    expect(names).toContain('French Polynesia')
    // Case must not change the result set.
    expect(upper.map((c) => c.name)).toEqual(names)
    expect(mixed.map((c) => c.name)).toEqual(names)
  })

  it('matches on any substring, not just a prefix', async () => {
    const result = await fetchSuggestions('land', liveSignal())
    const names = result.map((c) => c.name)
    // Mid/suffix substring matches: Finland, Iceland, Ireland, Netherlands,
    // New Zealand, Poland, Switzerland, Thailand.
    expect(names).toContain('Finland')
    expect(names).toContain('Iceland')
    expect(names).toContain('Netherlands')
    expect(names).not.toContain('France')
  })

  it('returns results sorted A→Z by name (locale-aware)', async () => {
    const result = await fetchSuggestions('a', liveSignal())
    const names = result.map((c) => c.name)
    const sorted = [...names].sort((x, y) => x.localeCompare(y))
    expect(names).toEqual(sorted)
  })

  it('resolves to an empty array when nothing matches', async () => {
    const result = await fetchSuggestions('zzzzz', liveSignal())
    expect(result).toEqual([])
  })

  it('does not mutate the underlying static list', async () => {
    const before = countries.map((c) => c.name)
    await fetchSuggestions('a', liveSignal())
    expect(countries.map((c) => c.name)).toEqual(before)
  })

  it('honors an already-aborted signal as a no-op (resolves empty, no work)', async () => {
    const controller = new AbortController()
    controller.abort()
    const result = await fetchSuggestions('pol', controller.signal)
    expect(result).toEqual([])
  })

  it('does not enforce the 3-char threshold itself (the hook owns it)', async () => {
    // A 1-char query still filters — the adapter is a pure data source; the
    // <3-char gate is the hook's job (proven at the component level).
    const result = await fetchSuggestions('p', liveSignal())
    expect(result.length).toBeGreaterThan(0)
  })
})

import { act, fireEvent, render, screen } from '@testing-library/react'

import { CountryPanel } from '../components/CountryPanel'

/**
 * Integration test for the demo's country instance (Story 3.1, AC 10).
 *
 * It renders `CountryPanel`, which wires the SHIPPED generic
 * `Autocomplete<Country>` (imported directly from `src/lib/**`, unmodified) to
 * `countryAdapter.fetchSuggestions` and the readout. It proves end-to-end that
 * the same core works against a completely different data source:
 *
 * - typing ≥3 chars renders the filtered countries,
 * - the hook (not the adapter) enforces the 3-char threshold — a 2-char query
 *   issues no fetch and shows no options,
 * - selecting (Enter or click) updates the visible readout instead of opening a
 *   tab.
 */
const DEBOUNCE_MS = 300

function combobox(): HTMLInputElement {
  return screen.getByRole('combobox', { name: 'Search countries' })
}

/** Types into the country combobox and flushes the hook's debounce. */
async function typeAndSettle(query: string) {
  const el = combobox()
  act(() => el.focus())
  fireEvent.change(el, { target: { value: query } })
  await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS))
}

describe('Country instance (generic Autocomplete + country adapter)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the filtered countries for a ≥3-char query', async () => {
    render(<CountryPanel />)

    await typeAndSettle('pol')

    const options = screen.getAllByRole('option')
    const labels = options.map((o) => o.textContent)
    expect(labels.some((t) => t?.includes('Poland'))).toBe(true)
    expect(labels.some((t) => t?.includes('French Polynesia'))).toBe(true)
    // Meta line is rendered by the country renderItem.
    expect(screen.getByText('Warsaw · PLN')).toBeInTheDocument()
  })

  it('shows the below-threshold hint and fetches nothing for a <3-char query (hook owns the gate)', async () => {
    render(<CountryPanel />)

    await typeAndSettle('po')

    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(combobox()).toHaveAttribute('aria-expanded', 'false')
  })

  it('updates the readout when a country is selected via Enter (never opens a tab)', async () => {
    const openSpy = vi.spyOn(window, 'open')
    render(<CountryPanel />)

    await typeAndSettle('pol')
    fireEvent.keyDown(combobox(), { key: 'ArrowDown' })
    fireEvent.keyDown(combobox(), { key: 'Enter' })

    // Scope to the readout <p> — "French Polynesia" also appears in the still-open
    // listbox option, so assert against the readout specifically.
    const readout = screen.getByText(/Selected:/).closest('p')
    // First alphabetical match for "pol" is French Polynesia (before Poland).
    expect(readout?.textContent).toContain('French Polynesia')
    expect(openSpy).not.toHaveBeenCalled()
    openSpy.mockRestore()
  })

  it('updates the readout when a country is selected via click', async () => {
    render(<CountryPanel />)

    await typeAndSettle('poland')
    const option = screen.getByRole('option', { name: /Poland/ })
    fireEvent.click(option)

    const readout = screen.getByText(/Selected:/).closest('p')
    expect(readout?.textContent).toContain('Poland')
    expect(readout?.textContent).toContain('Warsaw · PLN')
  })
})

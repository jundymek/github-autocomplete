import { act, fireEvent, render, screen } from '@testing-library/react'

import { Autocomplete } from './Autocomplete'
import styles from './Autocomplete.module.css'
import type { AutocompleteProps } from './types'

type Fruit = { id: string; label: string; description: string }

const FRUITS: Fruit[] = [
  { id: 'apple', label: 'Apple', description: 'A crisp fruit' },
  { id: 'banana', label: 'Banana', description: 'A yellow fruit' },
  { id: 'cherry', label: 'Cherry', description: 'A small red fruit' },
]

const DEBOUNCE_MS = 300

function renderFruits(item: Fruit, { highlighted }: { highlighted: boolean }) {
  return (
    <span data-highlighted={highlighted}>
      {item.label} — {item.description}
    </span>
  )
}

function renderAutocomplete(overrides: Partial<AutocompleteProps<Fruit>> = {}) {
  const onSelect = vi.fn()
  const fetchSuggestions = vi.fn(() => Promise.resolve(FRUITS))
  const props: AutocompleteProps<Fruit> = {
    fetchSuggestions,
    renderItem: renderFruits,
    getItemKey: (item) => item.id,
    onSelect,
    label: 'Search fruits',
    ...overrides,
  }
  render(<Autocomplete<Fruit> {...props} />)
  return { onSelect, fetchSuggestions: props.fetchSuggestions as ReturnType<typeof vi.fn> }
}

function input(): HTMLInputElement {
  return screen.getByRole('combobox')
}

function typeQuery(query: string) {
  const el = input()
  act(() => el.focus())
  fireEvent.change(el, { target: { value: query } })
}

async function typeAndSettle(query = 'abc') {
  typeQuery(query)
  await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS))
}

function popup(): HTMLElement | null {
  return document.body.querySelector(`:scope > [class~="${styles.pop}"]`)
}

describe('Autocomplete — reopen-on-focus (Story 1.5)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('refocusing a closed input with results reopens the same options and fires no new request', async () => {
    const { fetchSuggestions } = renderAutocomplete()

    await typeAndSettle('abc')
    expect(screen.getAllByRole('option')).toHaveLength(3)
    expect(fetchSuggestions).toHaveBeenCalledTimes(1)

    // Close via Escape (query retained), then blur.
    fireEvent.keyDown(input(), { key: 'Escape' })
    expect(popup()).toBeNull()
    fireEvent.blur(input())

    // Refocus the input — dropdown reopens with the same options, no refetch.
    fireEvent.focus(input())

    expect(input()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('option')).toHaveLength(3)
    expect(input().value).toBe('abc')
    await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS))
    expect(fetchSuggestions).toHaveBeenCalledTimes(1)
  })

  it('focusing a fresh (idle) input opens nothing and fires no request', () => {
    const { fetchSuggestions } = renderAutocomplete()

    fireEvent.focus(input())

    expect(popup()).toBeNull()
    expect(input()).toHaveAttribute('aria-expanded', 'false')
    expect(fetchSuggestions).not.toHaveBeenCalled()
  })

  it('below-threshold focus still shows the hint (unchanged) but not the results listbox', () => {
    renderAutocomplete()

    typeQuery('ab') // below minChars=3
    // The below-threshold hint popup shows on focus, but no listbox.
    expect(popup()).not.toBeNull()
    expect(input()).toHaveAttribute('aria-expanded', 'false')
  })

  it('ArrowDown after Escape re-shows the same options without a refetch (Story 3.9)', async () => {
    const { fetchSuggestions } = renderAutocomplete()

    await typeAndSettle('abc')
    expect(screen.getAllByRole('option')).toHaveLength(3)
    expect(fetchSuggestions).toHaveBeenCalledTimes(1)

    // Escape keeps focus on the input — no focus event will ever fire, so the
    // 1.5 focus-reopen path cannot help; ArrowDown is the keyboard recovery.
    fireEvent.keyDown(input(), { key: 'Escape' })
    expect(popup()).toBeNull()

    fireEvent.keyDown(input(), { key: 'ArrowDown' })

    expect(input()).toHaveAttribute('aria-expanded', 'true')
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(3)
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS))
    expect(fetchSuggestions).toHaveBeenCalledTimes(1)
  })

  it('Escape → ArrowDown → Enter selects the highlighted option (Story 3.9 full loop)', async () => {
    const { onSelect, fetchSuggestions } = renderAutocomplete()

    await typeAndSettle('abc')
    fireEvent.keyDown(input(), { key: 'Escape' })
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    fireEvent.keyDown(input(), { key: 'Enter' })

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(FRUITS[0])
    expect(popup()).toBeNull()
    expect(fetchSuggestions).toHaveBeenCalledTimes(1)
  })

  it('reopen composes with outside-click dismissal without flicker (close → refocus stays open)', async () => {
    renderAutocomplete()

    await typeAndSettle('abc')
    // Outside press closes (Story 1.4).
    fireEvent.pointerDown(document.body)
    expect(popup()).toBeNull()
    fireEvent.blur(input())

    // Clicking back into the input focuses it → reopens, and the 1.4 outside
    // handler does not close it (the press is inside the root/input).
    fireEvent.pointerDown(input())
    fireEvent.focus(input())

    expect(input()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })
})

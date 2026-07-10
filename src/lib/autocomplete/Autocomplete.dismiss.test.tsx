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
  const view = render(<Autocomplete<Fruit> {...props} />)
  return { view, onSelect, fetchSuggestions: props.fetchSuggestions }
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

/** A pointerdown on document.body — genuinely outside root and popup. */
function pressOutside() {
  fireEvent.pointerDown(document.body)
}

describe('Autocomplete — outside-press dismissal (Story 1.4)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('(a) outside pointerdown closes an open results dropdown and retains the query, firing no new request', async () => {
    const { fetchSuggestions } = renderAutocomplete()

    await typeAndSettle('abc')
    expect(popup()).not.toBeNull()
    expect(input()).toHaveAttribute('aria-expanded', 'true')
    const callsBefore = (fetchSuggestions as ReturnType<typeof vi.fn>).mock.calls.length

    pressOutside()

    expect(popup()).toBeNull()
    expect(input()).toHaveAttribute('aria-expanded', 'false')
    expect(input().value).toBe('abc')
    // No fetch is triggered by closing.
    await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS))
    expect((fetchSuggestions as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsBefore)
  })

  it('(b) pointerdown on an option inside the portal selects it and does not pre-close', async () => {
    const { onSelect } = renderAutocomplete()

    await typeAndSettle()
    const option = screen.getAllByRole('option')[1]

    // A press inside the popup must not trigger the outside-close handler.
    fireEvent.pointerDown(option)
    expect(popup()).not.toBeNull()

    fireEvent.click(option)
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(FRUITS[1])
  })

  it('(b) pointerdown on the footer inside the popup does not close it', async () => {
    renderAutocomplete()

    await typeAndSettle()
    const foot = popup()!.querySelector(`[class~="${styles.foot}"]`)!
    expect(foot).not.toBeNull()

    fireEvent.pointerDown(foot)
    expect(popup()).not.toBeNull()
  })

  it('(c) Escape still closes and retains the query (no regression)', async () => {
    renderAutocomplete()

    await typeAndSettle()
    expect(popup()).not.toBeNull()

    fireEvent.keyDown(input(), { key: 'Escape' })

    expect(popup()).toBeNull()
    expect(input().value).toBe('abc')
  })

  it('(d) outside pointerdown dismisses the below-threshold hint popup', async () => {
    renderAutocomplete()

    typeQuery('ab')
    expect(popup()).not.toBeNull()

    pressOutside()
    expect(popup()).toBeNull()

    // Typing again re-shows it (dismissal is tied to the current query).
    act(() => input().focus())
    fireEvent.change(input(), { target: { value: 'a' } })
    expect(popup()).not.toBeNull()
  })

  it('(e) removes the document pointerdown listener on unmount (no leak, no fire after unmount)', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const { view } = renderAutocomplete()

    await typeAndSettle()
    const added = addSpy.mock.calls.filter(([type]) => type === 'pointerdown')
    expect(added.length).toBeGreaterThanOrEqual(1)

    view.unmount()
    const removed = removeSpy.mock.calls.filter(([type]) => type === 'pointerdown')
    expect(removed.length).toBe(added.length)

    // A post-unmount outside press must not throw or warn.
    expect(() => pressOutside()).not.toThrow()
  })

  it('(e) removes the listener on close (no cost while idle/closed)', async () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    renderAutocomplete()

    await typeAndSettle()
    fireEvent.keyDown(input(), { key: 'Escape' })

    expect(
      removeSpy.mock.calls.some(([type]) => type === 'pointerdown'),
    ).toBe(true)
  })
})

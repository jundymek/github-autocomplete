import { act, fireEvent, render, screen } from '@testing-library/react'

import { Autocomplete } from './Autocomplete'
import styles from './Autocomplete.module.css'
import type { AutocompleteProps } from './types'

type Fruit = { id: string; label: string }

const FRUITS: Fruit[] = [
  { id: 'apple', label: 'Apple' },
  { id: 'banana', label: 'Banana' },
  { id: 'cherry', label: 'Cherry' },
]

const DEBOUNCE_MS = 300
const GAP_BELOW_INPUT_PX = 6
const VIEWPORT_MARGIN_PX = 8

function renderAutocomplete(overrides: Partial<AutocompleteProps<Fruit>> = {}) {
  const props: AutocompleteProps<Fruit> = {
    fetchSuggestions: () => Promise.resolve(FRUITS),
    renderItem: (item) => <span>{item.label}</span>,
    getItemKey: (item) => item.id,
    onSelect: vi.fn(),
    label: 'Search fruits',
    ...overrides,
  }
  return render(<Autocomplete<Fruit> {...props} />)
}

function input(): HTMLInputElement {
  return screen.getByRole('combobox')
}

function popup(): HTMLElement {
  const pop = document.body.querySelector<HTMLElement>(`:scope > [class~="${styles.pop}"]`)
  expect(pop).not.toBeNull()
  return pop!
}

/** jsdom rects are all zeros — stub the anchor's rect to a chosen geometry. */
function mockInputRect(rect: { top: number; bottom: number; left?: number; width?: number }) {
  const { top, bottom, left = 20, width = 300 } = rect
  input().getBoundingClientRect = () =>
    ({
      top,
      bottom,
      left,
      width,
      right: left + width,
      height: bottom - top,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect
}

function setInnerHeight(value: number) {
  Object.defineProperty(window, 'innerHeight', { value, configurable: true, writable: true })
}

/** Types a qualifying query and flushes the debounce so the popup opens. */
async function openPopup() {
  const el = input()
  act(() => el.focus())
  fireEvent.change(el, { target: { value: 'abc' } })
  await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS))
}

const ORIGINAL_INNER_HEIGHT = window.innerHeight

describe('Autocomplete — popup viewport fit (Story 3.10)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    setInnerHeight(ORIGINAL_INNER_HEIGHT)
  })

  it('with plenty of space below: top-anchored, maxHeight = space below minus margin (AC 1)', async () => {
    setInnerHeight(800)
    renderAutocomplete()
    mockInputRect({ top: 100, bottom: 140 })

    await openPopup()

    const pop = popup()
    expect(pop.style.top).toBe(`${140 + GAP_BELOW_INPUT_PX}px`)
    expect(pop.style.bottom).toBe('auto')
    // 800 - 140 - 6 (gap) - 8 (viewport margin) = 646
    expect(pop.style.maxHeight).toBe(`${800 - 140 - GAP_BELOW_INPUT_PX - VIEWPORT_MARGIN_PX}px`)
  })

  it('tight below, roomy above: flips — bottom-anchored, maxHeight = space above minus margin (AC 3)', async () => {
    setInnerHeight(800)
    renderAutocomplete()
    mockInputRect({ top: 700, bottom: 740 })

    await openPopup()

    const pop = popup()
    // Space below = 800 - 740 - 6 - 8 = 46 < 160 floor; space above = 700 - 6 - 8 = 686.
    expect(pop.style.bottom).toBe(`${800 - 700 + GAP_BELOW_INPUT_PX}px`)
    expect(pop.style.top).toBe('auto')
    expect(pop.style.maxHeight).toBe(`${700 - GAP_BELOW_INPUT_PX - VIEWPORT_MARGIN_PX}px`)
  })

  it('tight on both sides: stays below, clamped — no flip when above is not larger (AC 3)', async () => {
    setInnerHeight(300)
    renderAutocomplete()
    // Space below = 300 - 140 - 14 = 146 < 160, but space above = 100 - 14 = 86 is smaller.
    mockInputRect({ top: 100, bottom: 140 })

    await openPopup()

    const pop = popup()
    expect(pop.style.top).toBe(`${140 + GAP_BELOW_INPUT_PX}px`)
    expect(pop.style.bottom).toBe('auto')
    expect(pop.style.maxHeight).toBe(`${300 - 140 - GAP_BELOW_INPUT_PX - VIEWPORT_MARGIN_PX}px`)
  })

  it('equal space above and below (both tight): stays below (AC 3)', async () => {
    setInnerHeight(320)
    renderAutocomplete()
    // Space below = 320 - 180 - 14 = 126; space above = 140 - 14 = 126 — equal never flips.
    mockInputRect({ top: 140, bottom: 180 })

    await openPopup()

    const pop = popup()
    expect(pop.style.top).toBe(`${180 + GAP_BELOW_INPUT_PX}px`)
    expect(pop.style.bottom).toBe('auto')
  })

  it('resize re-measures and un-flips when space below recovers (AC 1, 3)', async () => {
    setInnerHeight(800)
    renderAutocomplete()
    mockInputRect({ top: 700, bottom: 740 })

    await openPopup()
    expect(popup().style.top).toBe('auto')

    setInnerHeight(1200)
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    const pop = popup()
    expect(pop.style.top).toBe(`${740 + GAP_BELOW_INPUT_PX}px`)
    expect(pop.style.bottom).toBe('auto')
    expect(pop.style.maxHeight).toBe(`${1200 - 740 - GAP_BELOW_INPUT_PX - VIEWPORT_MARGIN_PX}px`)
  })

  it('scroll re-measures: moving the input down the viewport flips the popup above (AC 1, 3)', async () => {
    setInnerHeight(800)
    renderAutocomplete()
    mockInputRect({ top: 100, bottom: 140 })

    await openPopup()
    expect(popup().style.bottom).toBe('auto')

    // An ancestor scroll moves the input near the viewport bottom; the
    // capture-phase scroll listener must re-run measure() and flip.
    mockInputRect({ top: 700, bottom: 740 })
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })

    const pop = popup()
    expect(pop.style.top).toBe('auto')
    expect(pop.style.bottom).toBe(`${800 - 700 + GAP_BELOW_INPUT_PX}px`)
  })

  it('maxHeight never goes negative when the input sits at the viewport edge (AC 1)', async () => {
    setInnerHeight(150)
    renderAutocomplete()
    // Space below = 150 - 148 - 14 = -12 → clamped to 0; space above = 120 - 14 = 106 → flips.
    mockInputRect({ top: 120, bottom: 148 })

    await openPopup()

    const pop = popup()
    expect(pop.style.bottom).toBe(`${150 - 120 + GAP_BELOW_INPUT_PX}px`)
    expect(parseFloat(pop.style.maxHeight)).toBeGreaterThanOrEqual(0)
  })
})

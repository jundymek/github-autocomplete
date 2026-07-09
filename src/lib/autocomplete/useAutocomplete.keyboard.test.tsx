import { act, fireEvent, render, screen } from '@testing-library/react'

import type { UseAutocompleteOptions } from './types'
import { useAutocomplete } from './useAutocomplete'

type Item = { id: string; label: string }

const ITEMS: Item[] = [
  { id: 'alpha', label: 'Alpha' },
  { id: 'beta', label: 'Beta' },
  { id: 'gamma', label: 'Gamma' },
]

const DEBOUNCE_MS = 300

/** A manually controllable promise so tests decide when a fetch settles. */
function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

type HarnessProps = {
  fetchSuggestions: UseAutocompleteOptions<Item>['fetchSuggestions']
  onSelect: (item: Item) => void
  statusMessages?: UseAutocompleteOptions<Item>['statusMessages']
}

/**
 * Test-only harness (§3.6): renders an input + list over the hook and spreads
 * the prop getters exactly as the shipped generic component (1.3) will. It is
 * never imported by shipped code.
 */
function Harness({ fetchSuggestions, onSelect, statusMessages }: HarnessProps) {
  const { state, handlers } = useAutocomplete<Item>({
    fetchSuggestions,
    getItemKey: (item) => item.id,
    onSelect,
    statusMessages,
  })

  return (
    <form onSubmit={(event) => event.preventDefault()}>
      <input aria-label="Search" {...handlers.getInputProps()} />
      {state.isOpen && (
        <ul {...handlers.getListboxProps()}>
          {state.items.map((item, index) => (
            <li key={item.id} {...handlers.getItemProps(item, index)}>
              {item.label}
            </li>
          ))}
        </ul>
      )}
      <output data-testid="status">{state.statusMessage}</output>
    </form>
  )
}

/** Types a qualifying query and flushes the debounce so the fetch starts. */
async function typeQuery(query = 'abc') {
  fireEvent.change(screen.getByRole('combobox'), { target: { value: query } })
  await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS))
}

/** Renders the harness and opens the dropdown with the given items. */
async function renderOpen(items: Item[] = ITEMS, onSelect = vi.fn()) {
  render(<Harness fetchSuggestions={() => Promise.resolve(items)} onSelect={onSelect} />)
  await typeQuery()
  return { onSelect }
}

function pressKey(key: string): boolean {
  // fireEvent returns false when preventDefault() was called on the event.
  return fireEvent.keyDown(screen.getByRole('combobox'), { key })
}

function highlightedOption(): HTMLElement | null {
  const options = screen.getAllByRole('option')
  return options.find((option) => option.getAttribute('aria-selected') === 'true') ?? null
}

describe('useAutocomplete — keyboard navigation and ARIA (via test harness)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('ArrowDown / ArrowUp with clamping, no wrap (AC 1)', () => {
    it('ArrowDown from the input highlights index 0 and sets aria-activedescendant', async () => {
      await renderOpen()
      const input = screen.getByRole('combobox')
      expect(input).not.toHaveAttribute('aria-activedescendant')

      pressKey('ArrowDown')

      const options = screen.getAllByRole('option')
      expect(options[0]).toHaveAttribute('aria-selected', 'true')
      expect(input).toHaveAttribute('aria-activedescendant', options[0].id)
    })

    it('ArrowDown advances one at a time and clamps at N-1 (no wrap to 0)', async () => {
      await renderOpen()
      const options = screen.getAllByRole('option')

      pressKey('ArrowDown')
      pressKey('ArrowDown')
      pressKey('ArrowDown')
      expect(options[2]).toHaveAttribute('aria-selected', 'true')

      pressKey('ArrowDown')
      expect(options[2]).toHaveAttribute('aria-selected', 'true')
      expect(options[0]).toHaveAttribute('aria-selected', 'false')
    })

    it('ArrowUp moves back and clamps at 0 (no wrap to N-1)', async () => {
      await renderOpen()
      const options = screen.getAllByRole('option')

      pressKey('ArrowDown')
      pressKey('ArrowDown')
      pressKey('ArrowUp')
      expect(options[0]).toHaveAttribute('aria-selected', 'true')

      pressKey('ArrowUp')
      expect(options[0]).toHaveAttribute('aria-selected', 'true')
      expect(options[2]).toHaveAttribute('aria-selected', 'false')
    })
  })

  describe('Home / End (AC 4)', () => {
    it('End moves the highlight to N-1, Home back to 0', async () => {
      await renderOpen()
      const options = screen.getAllByRole('option')

      pressKey('ArrowDown')
      pressKey('ArrowDown')

      pressKey('End')
      expect(options[2]).toHaveAttribute('aria-selected', 'true')

      pressKey('Home')
      expect(options[0]).toHaveAttribute('aria-selected', 'true')
    })
  })

  describe('Enter selection (AC 2)', () => {
    it('Enter with a highlighted item calls onSelect once with that item and prevents default', async () => {
      const { onSelect } = await renderOpen()

      pressKey('ArrowDown')
      pressKey('ArrowDown')
      const defaultNotPrevented = pressKey('Enter')

      expect(onSelect).toHaveBeenCalledTimes(1)
      expect(onSelect).toHaveBeenCalledWith(ITEMS[1])
      expect(defaultNotPrevented).toBe(false)
    })

    it('Enter with no highlighted item is a no-op (no onSelect)', async () => {
      const { onSelect } = await renderOpen()

      pressKey('Enter')

      expect(onSelect).not.toHaveBeenCalled()
    })
  })

  describe('click and hover route through the same selection/highlight paths (AC 2)', () => {
    it('clicking an option calls onSelect with that item', async () => {
      const { onSelect } = await renderOpen()

      fireEvent.click(screen.getAllByRole('option')[2])

      expect(onSelect).toHaveBeenCalledTimes(1)
      expect(onSelect).toHaveBeenCalledWith(ITEMS[2])
    })

    it('hovering an option moves the highlight there (shared highlightedIndex)', async () => {
      await renderOpen()
      const options = screen.getAllByRole('option')

      fireEvent.mouseMove(options[1])
      expect(options[1]).toHaveAttribute('aria-selected', 'true')

      // Keyboard continues from the hover position — one shared highlight.
      pressKey('ArrowDown')
      expect(options[2]).toHaveAttribute('aria-selected', 'true')
    })
  })

  describe('Escape (AC 3)', () => {
    it('closes the dropdown, clears the highlight, keeps the query, keeps focus on the input', async () => {
      await renderOpen()
      const input = screen.getByRole('combobox')
      input.focus()
      pressKey('ArrowDown')
      expect(highlightedOption()).not.toBeNull()

      const defaultNotPrevented = pressKey('Escape')

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      expect(input).toHaveAttribute('aria-expanded', 'false')
      expect(input).not.toHaveAttribute('aria-activedescendant')
      expect(input).toHaveValue('abc')
      expect(document.activeElement).toBe(input)
      expect(defaultNotPrevented).toBe(false)
    })
  })

  describe('Escape cancels pending work (AC 3)', () => {
    it('cancels a debounced fetch queued before Escape — the dropdown must not reopen', async () => {
      const fetchSuggestions = vi.fn(() => Promise.resolve(ITEMS))
      render(<Harness fetchSuggestions={fetchSuggestions} onSelect={vi.fn()} />)
      await typeQuery('abc')
      expect(fetchSuggestions).toHaveBeenCalledTimes(1)

      // New query typed — its debounce window is still open when Escape lands.
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'abcd' } })
      pressKey('Escape')

      await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS))

      expect(fetchSuggestions).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false')
    })
  })

  describe('clamp edge cases (AC 1)', () => {
    it('clamps both directions with a single item (N=1)', async () => {
      await renderOpen([ITEMS[0]])
      const option = screen.getByRole('option')

      pressKey('ArrowDown')
      expect(option).toHaveAttribute('aria-selected', 'true')
      pressKey('ArrowDown')
      expect(option).toHaveAttribute('aria-selected', 'true')
      pressKey('ArrowUp')
      expect(option).toHaveAttribute('aria-selected', 'true')
    })

    it('consumes nav keys over an open empty popup (N=0) without highlighting or selecting', async () => {
      const onSelect = vi.fn()
      await renderOpen([], onSelect)
      expect(screen.getByTestId('status')).toHaveTextContent('No matches')

      expect(pressKey('ArrowDown')).toBe(false)
      expect(pressKey('End')).toBe(false)
      expect(screen.getByRole('combobox')).not.toHaveAttribute('aria-activedescendant')

      pressKey('Enter')
      expect(onSelect).not.toHaveBeenCalled()
    })
  })

  describe('highlight resets on new query / new results (AC 5)', () => {
    it('clears the highlight when the query changes and when new results arrive', async () => {
      await renderOpen()
      const input = screen.getByRole('combobox')

      pressKey('ArrowDown')
      expect(input).toHaveAttribute('aria-activedescendant')

      await typeQuery('abcd')

      expect(input).not.toHaveAttribute('aria-activedescendant')
      expect(highlightedOption()).toBeNull()
    })
  })

  describe('ARIA wiring (AC 6, 7)', () => {
    it('wires the full §3.5 combobox attribute set with matching, stable ids', async () => {
      await renderOpen()
      const input = screen.getByRole('combobox')
      const listbox = screen.getByRole('listbox')
      const options = screen.getAllByRole('option')

      expect(input).toHaveAttribute('aria-autocomplete', 'list')
      expect(input).toHaveAttribute('aria-expanded', 'true')
      expect(input).toHaveAttribute('aria-controls', listbox.id)
      expect(listbox.id).toMatch(/-listbox$/)

      for (const [index, option] of options.entries()) {
        // Option ids derive from getItemKey → stable across renders.
        expect(option.id).toBe(`${listbox.id.replace(/-listbox$/, '')}-option-${ITEMS[index].id}`)
        expect(option).toHaveAttribute('aria-selected', 'false')
      }

      pressKey('ArrowDown')
      expect(input).toHaveAttribute('aria-activedescendant', options[0].id)
    })

    it('reflects the closed state before any fetch (aria-expanded=false, no activedescendant)', () => {
      render(<Harness fetchSuggestions={() => Promise.resolve(ITEMS)} onSelect={vi.fn()} />)
      const input = screen.getByRole('combobox')

      expect(input).toHaveAttribute('aria-expanded', 'false')
      expect(input).not.toHaveAttribute('aria-activedescendant')
    })
  })

  describe('key consumption (AC 9)', () => {
    it('does not consume navigation keys while the dropdown is closed', () => {
      render(<Harness fetchSuggestions={() => Promise.resolve(ITEMS)} onSelect={vi.fn()} />)

      expect(pressKey('ArrowDown')).toBe(true)
      expect(pressKey('Enter')).toBe(true)
      expect(pressKey('Escape')).toBe(true)
    })

    it('lets unhandled keys pass through untouched while open', async () => {
      await renderOpen()

      expect(pressKey('a')).toBe(true)
      expect(pressKey('Tab')).toBe(true)
    })

    it('prevents default on Arrow keys while open (text cursor must not move)', async () => {
      await renderOpen()

      expect(pressKey('ArrowDown')).toBe(false)
      expect(pressKey('ArrowUp')).toBe(false)
      expect(pressKey('Home')).toBe(false)
      expect(pressKey('End')).toBe(false)
    })
  })

  describe('live-region status text (AC 8)', () => {
    it("derives 'Searching…' while loading and 'N results' on success", async () => {
      const deferred = createDeferred<Item[]>()
      render(<Harness fetchSuggestions={() => deferred.promise} onSelect={vi.fn()} />)

      expect(screen.getByTestId('status')).toHaveTextContent('')

      await typeQuery()
      expect(screen.getByTestId('status')).toHaveTextContent('Searching…')

      await act(async () => deferred.resolve(ITEMS))
      expect(screen.getByTestId('status')).toHaveTextContent('3 results')
    })

    it("derives 'No matches' when the fetch resolves empty", async () => {
      render(<Harness fetchSuggestions={() => Promise.resolve([])} onSelect={vi.fn()} />)

      await typeQuery()

      expect(screen.getByTestId('status')).toHaveTextContent('No matches')
    })

    it('derives the generic error message (state.error.message) when the fetch rejects', async () => {
      render(<Harness fetchSuggestions={() => Promise.reject(new Error('boom'))} onSelect={vi.fn()} />)

      await typeQuery()

      // Exactly the lib's generic default — never the raw cause ("boom").
      expect(screen.getByTestId('status')).toHaveTextContent('Something went wrong.')
    })

    it('lets an adapter override the error status text from the preserved cause', async () => {
      render(
        <Harness
          fetchSuggestions={() => Promise.reject(new Error('rate limited'))}
          onSelect={vi.fn()}
          statusMessages={{
            error: (error) => (error.cause instanceof Error ? error.cause.message : error.message),
          }}
        />,
      )

      await typeQuery()

      expect(screen.getByTestId('status')).toHaveTextContent('rate limited')
    })

    it('honours statusMessages overrides without the lib knowing the source', async () => {
      render(
        <Harness
          fetchSuggestions={() => Promise.resolve(ITEMS)}
          onSelect={vi.fn()}
          statusMessages={{ results: (count) => `${count} things found` }}
        />,
      )

      await typeQuery()

      expect(screen.getByTestId('status')).toHaveTextContent('3 things found')
    })
  })
})

/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { act, fireEvent, render, screen, within } from '@testing-library/react'

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

/** Focuses the input and types a query (change event, like the hook tests). */
function typeQuery(query: string) {
  const el = input()
  act(() => el.focus())
  fireEvent.change(el, { target: { value: query } })
}

/** Types a qualifying query and flushes the debounce so the fetch settles. */
async function typeAndSettle(query = 'abc') {
  typeQuery(query)
  await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS))
}

function popup(): HTMLElement | null {
  return document.body.querySelector(`:scope > [class~="${styles.pop}"]`)
}

function pressKey(key: string) {
  fireEvent.keyDown(input(), { key })
}

/** The clear ("×") button, or null when the component does not render it. */
function clearButton(name: string | RegExp = 'Clear'): HTMLButtonElement | null {
  return screen.queryByRole('button', { name }) as HTMLButtonElement | null
}

describe('Autocomplete — generic presentational component', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('state rendering (AC 4, 6)', () => {
    it('below threshold: shows the countdown hint and contract footer, fires no request', async () => {
      const { fetchSuggestions } = renderAutocomplete()

      typeQuery('ab')
      await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2))

      const pop = popup()
      expect(pop).not.toBeNull()
      expect(pop!.textContent).toContain('Type 1 more character to search')
      expect(pop!.textContent).toContain('min 3 characters')
      expect(pop!.textContent).toContain('esc to close')
      expect(fetchSuggestions).not.toHaveBeenCalled()
      // The listbox popup itself is not open below threshold.
      expect(input()).toHaveAttribute('aria-expanded', 'false')
    })

    it('below threshold hint pluralizes and tracks minChars', async () => {
      renderAutocomplete({ minChars: 5 })

      typeQuery('ab')

      expect(popup()!.textContent).toContain('Type 3 more characters to search')
      expect(popup()!.textContent).toContain('min 5 characters')
    })

    it('loading: shows pulse dots, 3 skeleton rows, "searching…" footer and live region text', async () => {
      const deferred = createDeferred<Fruit[]>()
      renderAutocomplete({ fetchSuggestions: () => deferred.promise })

      await typeAndSettle()

      const pop = popup()!
      expect(pop.querySelectorAll(`[class~="${styles.skel}"]`)).toHaveLength(3)
      expect(document.querySelectorAll(`[class~="${styles.dot}"]`)).toHaveLength(3)
      expect(pop.textContent).toContain('searching…')
      expect(screen.getByRole('status')).toHaveTextContent('Searching…')
    })

    it('results: renders one option per item via renderItem plus the count footer', async () => {
      renderAutocomplete()

      await typeAndSettle()

      const options = screen.getAllByRole('option')
      expect(options).toHaveLength(3)
      expect(options[0]).toHaveTextContent('Apple — A crisp fruit')
      const pop = popup()!
      expect(pop.textContent).toContain('3 results · sorted A→Z')
      expect(pop.textContent).toContain('↑↓ browse · ↵ open')
      expect(screen.getByRole('status')).toHaveTextContent('3 results')
    })

    it('empty: echoes the query, shows the hint and the 0-results footer', async () => {
      renderAutocomplete({ fetchSuggestions: () => Promise.resolve([]) })

      await typeAndSettle('xqzyw')

      const pop = popup()!
      expect(pop.textContent).toContain('No matches for “xqzyw”')
      expect(pop.textContent).toContain('Check the spelling or try a shorter query.')
      expect(pop.textContent).toContain('0 results')
      expect(pop.textContent).toContain('esc to close')
      expect(screen.getByRole('status')).toHaveTextContent('No matches')
    })

    it('error: shows the danger title, generic description and a retry button that re-fires the last query', async () => {
      const fetchSuggestions = vi
        .fn<(query: string, signal: AbortSignal) => Promise<Fruit[]>>()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce(FRUITS)
      renderAutocomplete({ fetchSuggestions })

      await typeAndSettle()

      const pop = popup()!
      expect(pop.textContent).toContain('Search failed')
      expect(pop.textContent).toContain('Something went wrong.')
      expect(screen.getByRole('status')).toHaveTextContent('Something went wrong.')

      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
      await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS))

      expect(fetchSuggestions).toHaveBeenCalledTimes(2)
      expect(fetchSuggestions.mock.calls[1][0]).toBe('abc')
      expect(screen.getAllByRole('option')).toHaveLength(3)
    })

    it('rate-limit style: renders an adapter-supplied warning override without knowing what it means', async () => {
      renderAutocomplete({
        fetchSuggestions: () => Promise.reject(new Error('403')),
        messages: {
          error: () => ({
            title: 'Rate limit reached',
            description: 'Try again in 42s.',
            tone: 'warning',
            retryable: false,
          }),
        },
      })

      await typeAndSettle()

      const pop = popup()!
      expect(pop.textContent).toContain('Rate limit reached')
      expect(pop.textContent).toContain('Try again in 42s.')
      expect(pop.querySelector(`[class~="${styles.warn}"]`)).not.toBeNull()
      expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    })

    it('message overrides replace the default empty and below-threshold texts', async () => {
      renderAutocomplete({
        fetchSuggestions: () => Promise.resolve([]),
        messages: {
          belowThreshold: (remaining) => `Need ${remaining} more`,
          empty: (query) => `Nothing called ${query}`,
          emptyHint: 'Try something else',
        },
      })

      typeQuery('ab')
      expect(popup()!.textContent).toContain('Need 1 more')

      await typeAndSettle('abc')
      expect(popup()!.textContent).toContain('Nothing called abc')
      expect(popup()!.textContent).toContain('Try something else')
    })

    it('renderFooter overrides the default footer content', async () => {
      renderAutocomplete({
        renderFooter: (ctx) => (ctx.status === 'success' ? `custom ${ctx.resultCount}` : null),
      })

      await typeAndSettle()

      expect(popup()!.textContent).toContain('custom 3')
      expect(popup()!.textContent).not.toContain('sorted A→Z')
    })
  })

  describe('live region (AC 6)', () => {
    it('renders the status region in-flow (not in the portal) with aria-live=polite', async () => {
      const { view } = renderAutocomplete()

      await typeAndSettle()

      const status = screen.getByRole('status')
      expect(status).toHaveAttribute('aria-live', 'polite')
      expect(view.container.contains(status)).toBe(true)
      expect(popup()!.contains(status)).toBe(false)
    })
  })

  describe('portal (AC 5)', () => {
    it('renders the open dropdown as a direct child of document.body', async () => {
      const { view } = renderAutocomplete()

      await typeAndSettle()

      const pop = popup()
      expect(pop).not.toBeNull()
      expect(pop!.parentElement).toBe(document.body)
      expect(view.container.contains(pop)).toBe(false)
    })

    it('keeps aria-controls resolvable in loading, empty and error states (listbox exists whenever expanded)', async () => {
      const outcomes = [
        () => new Promise<Fruit[]>(() => {}),
        () => Promise.resolve<Fruit[]>([]),
        () => Promise.reject(new Error('boom')),
      ]
      for (const fetchSuggestions of outcomes) {
        const { view } = renderAutocomplete({ fetchSuggestions })
        await typeAndSettle()

        expect(input()).toHaveAttribute('aria-expanded', 'true')
        const controlsId = input().getAttribute('aria-controls')!
        const listbox = document.getElementById(controlsId)
        expect(listbox).not.toBeNull()
        expect(listbox).toHaveAttribute('role', 'listbox')
        expect(within(listbox as HTMLElement).queryAllByRole('option')).toHaveLength(0)
        view.unmount()
      }
    })

    it('removes the scroll and resize listeners when unmounted while open', async () => {
      const addSpy = vi.spyOn(window, 'addEventListener')
      const removeSpy = vi.spyOn(window, 'removeEventListener')
      const { view } = renderAutocomplete()

      await typeAndSettle()
      const added = addSpy.mock.calls.filter(([type]) => type === 'scroll' || type === 'resize')
      expect(added.length).toBeGreaterThanOrEqual(2)

      view.unmount()
      const removed = removeSpy.mock.calls.filter(
        ([type]) => type === 'scroll' || type === 'resize',
      )
      expect(removed.map(([type]) => type).sort()).toEqual(
        added.map(([type]) => type).sort(),
      )
    })

    it('keeps id-based ARIA relationships resolvable across the portal', async () => {
      renderAutocomplete()

      await typeAndSettle()
      pressKey('ArrowDown')

      const controlsId = input().getAttribute('aria-controls')!
      const listbox = document.getElementById(controlsId)
      expect(listbox).not.toBeNull()
      expect(listbox).toHaveAttribute('role', 'listbox')

      const activeId = input().getAttribute('aria-activedescendant')!
      const active = document.getElementById(activeId)
      expect(active).not.toBeNull()
      expect(active).toHaveAttribute('aria-selected', 'true')
    })
  })

  describe('keyboard end-to-end (AC 7, 11)', () => {
    it('ArrowDown highlights option 0; Enter selects it', async () => {
      const { onSelect } = renderAutocomplete()

      await typeAndSettle()
      pressKey('ArrowDown')

      const options = screen.getAllByRole('option')
      expect(options[0]).toHaveAttribute('aria-selected', 'true')

      pressKey('Enter')
      expect(onSelect).toHaveBeenCalledExactlyOnceWith(FRUITS[0])
    })

    it('Escape closes the dropdown, keeps the query and keeps focus on the input', async () => {
      renderAutocomplete()

      await typeAndSettle()
      expect(popup()).not.toBeNull()

      pressKey('Escape')

      expect(popup()).toBeNull()
      expect(input().value).toBe('abc')
      expect(document.activeElement).toBe(input())
    })

    it('Escape dismisses the below-threshold hint until the query changes', async () => {
      renderAutocomplete()

      typeQuery('ab')
      expect(popup()).not.toBeNull()

      pressKey('Escape')
      expect(popup()).toBeNull()

      fireEvent.change(input(), { target: { value: 'a' } })
      expect(popup()).not.toBeNull()
    })

    it('clicking an option selects it', async () => {
      const { onSelect } = renderAutocomplete()

      await typeAndSettle()
      fireEvent.click(screen.getAllByRole('option')[1])

      expect(onSelect).toHaveBeenCalledExactlyOnceWith(FRUITS[1])
    })
  })

  describe('accept collapses the popup (Story 3.7, AC 5, 7)', () => {
    it('after Enter the listbox is gone and aria-expanded is false', async () => {
      renderAutocomplete()

      await typeAndSettle()
      pressKey('ArrowDown')
      pressKey('Enter')

      expect(popup()).toBeNull()
      expect(input()).toHaveAttribute('aria-expanded', 'false')
      expect(input()).not.toHaveAttribute('aria-activedescendant')
    })

    it('after a click the listbox is gone and aria-expanded is false', async () => {
      renderAutocomplete()

      await typeAndSettle()
      fireEvent.click(screen.getAllByRole('option')[1])

      expect(popup()).toBeNull()
      expect(input()).toHaveAttribute('aria-expanded', 'false')
    })

    it('reopen-on-focus (1.5) re-shows the same results after an accept, with no refetch', async () => {
      const { fetchSuggestions } = renderAutocomplete()

      await typeAndSettle()
      pressKey('ArrowDown')
      pressKey('Enter')
      expect(popup()).toBeNull()
      const callsAfterAccept = (fetchSuggestions as ReturnType<typeof vi.fn>).mock.calls.length

      // Refocusing the settled, still-qualifying query reopens the existing
      // results without a new fetch (openIfResults path, unchanged).
      act(() => input().focus())
      fireEvent.focus(input())

      expect(popup()).not.toBeNull()
      expect(screen.getAllByRole('option')).toHaveLength(FRUITS.length)
      await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS))
      expect((fetchSuggestions as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsAfterAccept)
    })
  })

  describe('ARIA wiring (AC 7)', () => {
    it('exposes the full combobox contract with an accessible name from the label prop', async () => {
      renderAutocomplete({ label: 'Search fruits' })

      const el = screen.getByRole('combobox', { name: 'Search fruits' })
      expect(el).toHaveAttribute('aria-autocomplete', 'list')
      expect(el).toHaveAttribute('aria-expanded', 'false')
      expect(el).toHaveAttribute('aria-controls')

      await typeAndSettle()
      expect(el).toHaveAttribute('aria-expanded', 'true')
    })

    it('derives stable option ids from getItemKey', async () => {
      renderAutocomplete()

      await typeAndSettle()

      const options = screen.getAllByRole('option')
      expect(options[0].id).toContain('apple')
      expect(options[2].id).toContain('cherry')
    })
  })

  describe('self-contained styling and theming (AC 2, 3)', () => {
    const css = readFileSync(
      join(process.cwd(), 'src/lib/autocomplete/Autocomplete.module.css'),
      'utf8',
    )

    /** AC-3 fallbacks, verbatim from docs/design (hex compared case-insensitively). */
    const expectedFallbacks: Record<string, string> = {
      '--ac-color-surface': '#ffffff',
      '--ac-color-text': '#1f2328',
      '--ac-color-text-muted': '#59636e',
      '--ac-color-accent': '#6639ba',
      '--ac-color-highlight': '#f5f1fb',
      '--ac-color-border': '#d1d9e0',
      '--ac-color-danger': '#cf222e',
      '--ac-color-warning': '#9a6700',
      '--ac-color-warning-bg': '#fff8c5',
      '--ac-color-success': '#1a7f37',
      '--ac-font-ui': 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      '--ac-font-mono': 'ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace',
      '--ac-radius': '10px',
      '--ac-radius-item': '6px',
      '--ac-space': '8px',
      '--ac-shadow': '0 8px 24px rgba(31,35,40,.12), 0 1px 3px rgba(31,35,40,.08)',
      '--ac-dropdown-max-height': '368px',
      '--ac-z-index': '1000',
    }

    it.each(Object.entries(expectedFallbacks))(
      'consumes %s with its exact design fallback',
      (token, fallback) => {
        const escaped = `${token}\\s*,\\s*${fallback.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
        expect(css).toMatch(new RegExp(`var\\(${escaped}\\s*\\)`, 'i'))
      },
    )

    it('defines no :root token values and no global selectors', () => {
      expect(css).not.toMatch(/:root/)
      expect(css).not.toMatch(/:global/)
    })

    it('gates all motion behind prefers-reduced-motion', () => {
      expect(css).toMatch(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/)
      expect(css).toMatch(/@keyframes\s+ac-pulse/)
      expect(css).toMatch(/@keyframes\s+ac-in/)
    })

    it('applies the CSS module classes to the rendered input', () => {
      renderAutocomplete()
      expect(input().className).toContain(styles.input)
    })

    it('bridges an ancestor --ac-* override onto the portalled popup (theming without selector piercing)', async () => {
      const onSelect = vi.fn()
      render(
        <div style={{ ['--ac-color-accent' as string]: '#0f766e' }}>
          <Autocomplete<Fruit>
            fetchSuggestions={() => Promise.resolve(FRUITS)}
            renderItem={renderFruits}
            getItemKey={(item) => item.id}
            onSelect={onSelect}
            label="Themed"
          />
        </div>,
      )

      await typeAndSettle()

      const pop = popup()!
      expect(pop.style.getPropertyValue('--ac-color-accent')).toBe('#0f766e')
    })
  })

  describe('clear button (Story 3.6)', () => {
    it('is not rendered when the query is empty', () => {
      renderAutocomplete()
      act(() => input().focus())

      expect(clearButton()).toBeNull()
    })

    it('appears once the query has any content (below threshold too)', () => {
      renderAutocomplete()

      typeQuery('a')

      expect(clearButton()).not.toBeNull()
    })

    it('is hidden while loading (the pulse dots hold the lane instead)', async () => {
      const deferred = createDeferred<Fruit[]>()
      renderAutocomplete({ fetchSuggestions: () => deferred.promise })

      await typeAndSettle()

      // Loading: dots visible, button absent (mutually exclusive, one lane).
      expect(document.querySelectorAll(`[class~="${styles.dot}"]`)).toHaveLength(3)
      expect(clearButton()).toBeNull()

      // Once the fetch settles the button returns.
      await act(async () => deferred.resolve(FRUITS))
      expect(clearButton()).not.toBeNull()
    })

    it('clears the input, closes the popup and returns focus to the input on click', async () => {
      renderAutocomplete()

      await typeAndSettle()
      expect(popup()).not.toBeNull()
      expect(input().value).toBe('abc')

      fireEvent.click(clearButton()!)

      expect(input().value).toBe('')
      expect(popup()).toBeNull()
      expect(document.activeElement).toBe(input())
      // Emptied query → button gone again.
      expect(clearButton()).toBeNull()
    })

    it('after clearing, typing a fresh query re-shows the below-threshold hint', async () => {
      renderAutocomplete()

      // Dismiss the hint for a below-threshold query, then clear.
      typeQuery('ab')
      pressKey('Escape')
      expect(popup()).toBeNull()
      fireEvent.change(input(), { target: { value: 'abc' } })
      await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS))

      fireEvent.click(clearButton()!)
      expect(input().value).toBe('')

      // A fresh below-threshold query gets the hint again (dismissal reset).
      typeQuery('xy')
      expect(popup()!.textContent).toContain('Type 1 more character to search')
    })

    it('defaults the accessible name to "Clear" and honors the clearLabel prop', () => {
      const { view } = renderAutocomplete()
      typeQuery('a')
      expect(clearButton('Clear')).not.toBeNull()
      view.unmount()

      renderAutocomplete({ clearLabel: 'Wyczyść' })
      typeQuery('a')
      expect(clearButton('Wyczyść')).not.toBeNull()
      expect(clearButton('Clear')).toBeNull()
    })

    it('is a real type="button" in tab order after the input', () => {
      renderAutocomplete()
      typeQuery('a')

      const btn = clearButton()!
      expect(btn.tagName).toBe('BUTTON')
      expect(btn).toHaveAttribute('type', 'button')
      // Natural document order: the input precedes the button (no tabindex hacks).
      expect(input().compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(btn).not.toHaveAttribute('tabindex')
    })

    it('lives inside the component root, so pressing it never triggers the outside-close path first', async () => {
      const { view } = renderAutocomplete()

      await typeAndSettle()
      const btn = clearButton()!
      // Structural guarantee the outside-press listener relies on (AC 3).
      expect(view.container.contains(btn)).toBe(true)

      // A full pointer press+click still clears rather than being swallowed.
      fireEvent.pointerDown(btn)
      fireEvent.click(btn)
      expect(input().value).toBe('')
      expect(popup()).toBeNull()
    })
  })

  describe('data-source agnosticism (AC 10)', () => {
    type Country = { code: string; name: string }
    const COUNTRIES: Country[] = [
      { code: 'de', name: 'Germany' },
      { code: 'pl', name: 'Poland' },
      { code: 'pt', name: 'Portugal' },
    ]

    it('works unchanged with a static in-memory data source and custom renderItem/getItemKey', async () => {
      const onSelect = vi.fn()
      render(
        <Autocomplete<Country>
          fetchSuggestions={(query) =>
            Promise.resolve(
              COUNTRIES.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())),
            )
          }
          renderItem={(country, { highlighted }) => (
            <strong>{highlighted ? `» ${country.name}` : country.name}</strong>
          )}
          getItemKey={(country) => country.code}
          onSelect={onSelect}
          label="Search countries"
        />,
      )

      await typeAndSettle('pol')

      const options = screen.getAllByRole('option')
      expect(options).toHaveLength(1)
      expect(within(options[0]).getByText('Poland')).toBeInTheDocument()
      expect(options[0].id).toContain('pl')

      pressKey('ArrowDown')
      expect(within(options[0]).getByText('» Poland')).toBeInTheDocument()

      pressKey('Enter')
      expect(onSelect).toHaveBeenCalledExactlyOnceWith(COUNTRIES[1])
    })
  })
})

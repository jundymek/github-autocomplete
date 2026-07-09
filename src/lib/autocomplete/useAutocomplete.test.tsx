import { act, renderHook } from '@testing-library/react'

import { useAutocomplete } from './useAutocomplete'

type Item = { id: string; label: string }

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

const DEBOUNCE_MS = 300

/** Required-by-1.2 options that are irrelevant to the fetch-lifecycle tests. */
const baseOptions = {
  getItemKey: (item: Item) => item.id,
  onSelect: () => {},
}

type FetchSuggestions = (query: string, signal: AbortSignal) => Promise<Item[]>

describe('useAutocomplete', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts idle and closed with an empty query', () => {
    const fetchSuggestions = vi.fn()
    const { result } = renderHook(() => useAutocomplete<Item>({ ...baseOptions, fetchSuggestions }))

    expect(result.current.state).toEqual({
      query: '',
      status: 'idle',
      items: [],
      highlightedIndex: null,
      isOpen: false,
      statusMessage: '',
    })
    expect(fetchSuggestions).not.toHaveBeenCalled()
  })

  it('does not fetch below minChars and fetches at exactly minChars (2 → 3 boundary)', async () => {
    const deferred = createDeferred<Item[]>()
    const fetchSuggestions = vi.fn(() => deferred.promise)
    const { result } = renderHook(() => useAutocomplete<Item>({ ...baseOptions, fetchSuggestions }))

    act(() => result.current.handlers.onInputChange('re'))
    await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS))

    expect(fetchSuggestions).not.toHaveBeenCalled()
    expect(result.current.state.status).toBe('idle')
    expect(result.current.state.isOpen).toBe(false)

    act(() => result.current.handlers.onInputChange('rea'))
    await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS))

    expect(fetchSuggestions).toHaveBeenCalledTimes(1)
    expect(fetchSuggestions).toHaveBeenCalledWith('rea', expect.any(AbortSignal))
  })

  it('closes the dropdown, resets to idle, and aborts in-flight fetch when the query drops below minChars', async () => {
    const deferred = createDeferred<Item[]>()
    const fetchSuggestions = vi.fn<FetchSuggestions>(() => deferred.promise)
    const { result } = renderHook(() => useAutocomplete<Item>({ ...baseOptions, fetchSuggestions }))

    act(() => result.current.handlers.onInputChange('rea'))
    await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS))
    expect(result.current.state.status).toBe('loading')
    const signal = fetchSuggestions.mock.calls[0][1]

    act(() => result.current.handlers.onInputChange('re'))

    expect(signal.aborted).toBe(true)
    expect(result.current.state.status).toBe('idle')
    expect(result.current.state.isOpen).toBe(false)
    expect(result.current.state.items).toEqual([])
  })

  it('collapses rapid keystrokes into exactly one request for the settled query', async () => {
    const fetchSuggestions = vi.fn(() => Promise.resolve<Item[]>([]))
    const { result } = renderHook(() => useAutocomplete<Item>({ ...baseOptions, fetchSuggestions }))

    for (const q of ['r', 're', 'rea', 'reac', 'react']) {
      act(() => result.current.handlers.onInputChange(q))
      await act(() => vi.advanceTimersByTimeAsync(50))
    }
    await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS))

    expect(fetchSuggestions).toHaveBeenCalledTimes(1)
    expect(fetchSuggestions).toHaveBeenCalledWith('react', expect.any(AbortSignal))
  })

  it('respects custom minChars and debounceMs', async () => {
    const fetchSuggestions = vi.fn(() => Promise.resolve<Item[]>([]))
    const { result } = renderHook(() =>
      useAutocomplete<Item>({ ...baseOptions, fetchSuggestions, minChars: 1, debounceMs: 100 }),
    )

    act(() => result.current.handlers.onInputChange('a'))
    await act(() => vi.advanceTimersByTimeAsync(99))
    expect(fetchSuggestions).not.toHaveBeenCalled()

    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(fetchSuggestions).toHaveBeenCalledTimes(1)
    expect(fetchSuggestions).toHaveBeenCalledWith('a', expect.any(AbortSignal))
  })

  it('goes loading → success with items and opens the dropdown', async () => {
    const items: Item[] = [{ id: '1', label: 'react' }]
    const deferred = createDeferred<Item[]>()
    const fetchSuggestions = vi.fn(() => deferred.promise)
    const { result } = renderHook(() => useAutocomplete<Item>({ ...baseOptions, fetchSuggestions }))

    act(() => result.current.handlers.onInputChange('rea'))
    await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS))
    expect(result.current.state.status).toBe('loading')
    expect(result.current.state.isOpen).toBe(true)

    await act(async () => deferred.resolve(items))

    expect(result.current.state.status).toBe('success')
    expect(result.current.state.items).toEqual(items)
    expect(result.current.state.isOpen).toBe(true)
    expect(result.current.state.error).toBeUndefined()
  })

  it('ignores a stale response: aborts A on query change and only ever renders B', async () => {
    const deferredA = createDeferred<Item[]>()
    const deferredB = createDeferred<Item[]>()
    const fetchSuggestions = vi
      .fn<(query: string, signal: AbortSignal) => Promise<Item[]>>()
      .mockReturnValueOnce(deferredA.promise)
      .mockReturnValueOnce(deferredB.promise)
    const { result } = renderHook(() => useAutocomplete<Item>({ ...baseOptions, fetchSuggestions }))

    act(() => result.current.handlers.onInputChange('aaa'))
    await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS))
    const signalA = fetchSuggestions.mock.calls[0][1]

    act(() => result.current.handlers.onInputChange('bbb'))
    await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS))

    expect(signalA.aborted).toBe(true)
    expect(fetchSuggestions).toHaveBeenCalledTimes(2)

    // A resolves late — it must never overwrite newer state.
    await act(async () => deferredA.resolve([{ id: 'a', label: 'stale A' }]))
    expect(result.current.state.status).toBe('loading')
    expect(result.current.state.items).toEqual([])

    await act(async () => deferredB.resolve([{ id: 'b', label: 'fresh B' }]))
    expect(result.current.state.status).toBe('success')
    expect(result.current.state.items).toEqual([{ id: 'b', label: 'fresh B' }])
  })

  it('aborts the previous fetch immediately on a new qualifying query, before its debounce settles', async () => {
    const deferredA = createDeferred<Item[]>()
    const fetchSuggestions = vi.fn<FetchSuggestions>(() => deferredA.promise)
    const { result } = renderHook(() => useAutocomplete<Item>({ ...baseOptions, fetchSuggestions }))

    act(() => result.current.handlers.onInputChange('aaa'))
    await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS))
    const signalA = fetchSuggestions.mock.calls[0][1]

    // New qualifying query typed — B's debounce window is still open.
    act(() => result.current.handlers.onInputChange('bbb'))

    expect(signalA.aborted).toBe(true)

    // A resolving inside B's debounce window must not commit stale items.
    await act(async () => deferredA.resolve([{ id: 'a', label: 'stale A' }]))
    expect(result.current.state.items).toEqual([])
    expect(result.current.state.status).toBe('loading')
    expect(result.current.state.query).toBe('bbb')
  })

  it('aborts the in-flight fetch on unmount and never updates state afterwards', async () => {
    const deferred = createDeferred<Item[]>()
    const fetchSuggestions = vi.fn<FetchSuggestions>(() => deferred.promise)
    const { result, unmount } = renderHook(() => useAutocomplete<Item>({ ...baseOptions, fetchSuggestions }))

    act(() => result.current.handlers.onInputChange('rea'))
    await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS))
    const signal = fetchSuggestions.mock.calls[0][1]

    unmount()
    expect(signal.aborted).toBe(true)

    // Resolving after unmount must not warn or update state (jsdom would emit
    // an act()/setState-after-unmount warning, which vitest surfaces).
    await act(async () => deferred.resolve([{ id: '1', label: 'late' }]))
  })

  it('maps a rejection to status error with message and preserved cause', async () => {
    const boom = new Error('boom')
    const deferred = createDeferred<Item[]>()
    const fetchSuggestions = vi.fn(() => deferred.promise)
    const { result } = renderHook(() => useAutocomplete<Item>({ ...baseOptions, fetchSuggestions }))

    act(() => result.current.handlers.onInputChange('rea'))
    await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS))
    await act(async () => deferred.reject(boom))

    expect(result.current.state.status).toBe('error')
    expect(result.current.state.error?.message).toEqual(expect.any(String))
    expect(result.current.state.error?.message.length).toBeGreaterThan(0)
    expect(result.current.state.error?.cause).toBe(boom)
    expect(result.current.state.isOpen).toBe(true)
  })

  it('swallows AbortError rejections instead of surfacing an error state', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError')
    const deferredA = createDeferred<Item[]>()
    const deferredB = createDeferred<Item[]>()
    const fetchSuggestions = vi
      .fn<(query: string, signal: AbortSignal) => Promise<Item[]>>()
      .mockReturnValueOnce(deferredA.promise)
      .mockReturnValueOnce(deferredB.promise)
    const { result } = renderHook(() => useAutocomplete<Item>({ ...baseOptions, fetchSuggestions }))

    act(() => result.current.handlers.onInputChange('aaa'))
    await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS))
    act(() => result.current.handlers.onInputChange('bbb'))
    await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS))

    // The aborted fetch A rejects with AbortError — never an error state.
    await act(async () => deferredA.reject(abortError))
    expect(result.current.state.status).toBe('loading')
    expect(result.current.state.error).toBeUndefined()

    await act(async () => deferredB.resolve([{ id: 'b', label: 'ok' }]))
    expect(result.current.state.status).toBe('success')
  })

  it('goes to empty (distinct from success) when the fetch resolves with zero items', async () => {
    const deferred = createDeferred<Item[]>()
    const fetchSuggestions = vi.fn(() => deferred.promise)
    const { result } = renderHook(() => useAutocomplete<Item>({ ...baseOptions, fetchSuggestions }))

    act(() => result.current.handlers.onInputChange('zzz'))
    await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS))
    await act(async () => deferred.resolve([]))

    expect(result.current.state.status).toBe('empty')
    expect(result.current.state.items).toEqual([])
    expect(result.current.state.isOpen).toBe(true)
  })

  it('close() closes the dropdown and resets the highlight but keeps the query', async () => {
    const fetchSuggestions = vi.fn(() => Promise.resolve([{ id: '1', label: 'react' }]))
    const { result } = renderHook(() => useAutocomplete<Item>({ ...baseOptions, fetchSuggestions }))

    act(() => result.current.handlers.onInputChange('rea'))
    await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS))
    expect(result.current.state.isOpen).toBe(true)

    act(() => result.current.handlers.close())

    expect(result.current.state.isOpen).toBe(false)
    expect(result.current.state.highlightedIndex).toBeNull()
    expect(result.current.state.query).toBe('rea')
  })
})

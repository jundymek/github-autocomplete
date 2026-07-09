import { useCallback, useEffect, useRef, useState } from 'react'

import type {
  AutocompleteState,
  UseAutocompleteOptions,
  UseAutocompleteResult,
} from './types'

const DEFAULT_MIN_CHARS = 3
const DEFAULT_DEBOUNCE_MS = 300

/** Neutral fallback message; adapters override display text at the component layer. */
const GENERIC_ERROR_MESSAGE = 'Something went wrong.'

function createInitialState<T>(): AutocompleteState<T> {
  return {
    query: '',
    status: 'idle',
    items: [],
    highlightedIndex: null,
    isOpen: false,
  }
}

function isAbortRejection(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  )
}

/**
 * Generic headless autocomplete hook owning the whole fetch lifecycle:
 * threshold gating, debouncing, per-fetch `AbortController` cancellation, and
 * the `idle | loading | success | empty | error` state machine.
 *
 * It knows nothing about any concrete data source — suggestions come from the
 * injected {@link UseAutocompleteOptions.fetchSuggestions}, which receives an
 * `AbortSignal` that is aborted whenever the request becomes stale (a newer
 * qualifying query, a drop below `minChars`, or unmount). A stale response can
 * never overwrite newer state.
 *
 * @returns exactly one `state` object and one `handlers` object (§3.4).
 */
export function useAutocomplete<T>(options: UseAutocompleteOptions<T>): UseAutocompleteResult<T> {
  const { fetchSuggestions, minChars = DEFAULT_MIN_CHARS, debounceMs = DEFAULT_DEBOUNCE_MS } = options

  const [state, setState] = useState<AutocompleteState<T>>(createInitialState)

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const controllerRef = useRef<AbortController | null>(null)
  const isMountedRef = useRef(true)
  const fetchSuggestionsRef = useRef(fetchSuggestions)

  useEffect(() => {
    fetchSuggestionsRef.current = fetchSuggestions
  }, [fetchSuggestions])

  const clearDebounceTimer = useCallback(() => {
    if (debounceTimerRef.current !== undefined) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = undefined
    }
  }, [])

  const abortInFlight = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      clearDebounceTimer()
      abortInFlight()
    }
  }, [clearDebounceTimer, abortInFlight])

  const startFetch = useCallback(
    (query: string) => {
      abortInFlight()
      const controller = new AbortController()
      controllerRef.current = controller

      setState((prev) => ({
        ...prev,
        status: 'loading',
        isOpen: true,
        error: undefined,
      }))

      /** Only the fetch owned by the still-current controller may commit state. */
      const isCurrent = () => isMountedRef.current && controllerRef.current === controller

      fetchSuggestionsRef.current(query, controller.signal).then(
        (items) => {
          if (!isCurrent() || controller.signal.aborted) return
          setState((prev) => ({
            ...prev,
            status: items.length > 0 ? 'success' : 'empty',
            items,
            error: undefined,
          }))
        },
        (error: unknown) => {
          // AbortError is cancellation, not failure — swallow it.
          if (isAbortRejection(error) || controller.signal.aborted) return
          if (!isCurrent()) return
          setState((prev) => ({
            ...prev,
            status: 'error',
            items: [],
            error: { message: GENERIC_ERROR_MESSAGE, cause: error },
          }))
        },
      )
    },
    [abortInFlight],
  )

  const onInputChange = useCallback(
    (value: string) => {
      clearDebounceTimer()

      if (value.length < minChars) {
        abortInFlight()
        setState((prev) => ({
          ...prev,
          query: value,
          status: 'idle',
          items: [],
          highlightedIndex: null,
          isOpen: false,
          error: undefined,
        }))
        return
      }

      // Abort immediately, not at fetch time: a request for the previous query
      // must not be able to resolve and commit during this query's debounce
      // window (AC-4 "a new qualifying query aborts the previous controller").
      abortInFlight()
      setState((prev) => ({ ...prev, query: value, highlightedIndex: null }))
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = undefined
        startFetch(value)
      }, debounceMs)
    },
    [clearDebounceTimer, abortInFlight, minChars, debounceMs, startFetch],
  )

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false, highlightedIndex: null }))
  }, [])

  // 1.2: keyboard navigation (ArrowDown/Up clamp, Enter, Escape) and item
  // pointer handlers attach here; declared now so the contract is stable.
  const onKeyDown = useCallback(() => {}, [])
  const onItemClick = useCallback(() => {}, [])
  const onItemHover = useCallback(() => {}, [])

  return {
    state,
    handlers: { onInputChange, close, onKeyDown, onItemClick, onItemHover },
  }
}

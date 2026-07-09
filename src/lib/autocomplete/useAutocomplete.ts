import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type {
  ChangeEvent as ReactChangeEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from 'react'

import type {
  AutocompleteInputProps,
  AutocompleteItemProps,
  AutocompleteListboxProps,
  AutocompleteState,
  UseAutocompleteOptions,
  UseAutocompleteResult,
} from './types'

const DEFAULT_MIN_CHARS = 3
const DEFAULT_DEBOUNCE_MS = 300

/** Neutral fallback message; adapters override display text at the component layer. */
const GENERIC_ERROR_MESSAGE = 'Something went wrong.'

/** Generic live-region defaults; overridable via `options.statusMessages`. */
const DEFAULT_LOADING_MESSAGE = 'Searching…'
const DEFAULT_EMPTY_MESSAGE = 'No matches'
const defaultResultsMessage = (count: number) => `${count} ${count === 1 ? 'result' : 'results'}`

/** Stored state; `statusMessage` is derived at render time, never stored. */
type InternalState<T> = Omit<AutocompleteState<T>, 'statusMessage'>

function createInitialState<T>(): InternalState<T> {
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
  const {
    fetchSuggestions,
    getItemKey,
    onSelect,
    minChars = DEFAULT_MIN_CHARS,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    statusMessages,
  } = options

  const [state, setState] = useState<InternalState<T>>(createInitialState)

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
            // New results: nothing is pre-highlighted until a nav key (AC 5).
            highlightedIndex: null,
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
            highlightedIndex: null,
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
    // Closing cancels pending work: a debounced fetch queued before close
    // must not fire later and reopen the dropdown.
    clearDebounceTimer()
    abortInFlight()
    setState((prev) => ({ ...prev, isOpen: false, highlightedIndex: null }))
  }, [clearDebounceTimer, abortInFlight])

  // --- Ids (AC 7): stable per-instance base; option ids derive from getItemKey.
  const baseId = useId()
  const listboxId = `${baseId}-listbox`
  const optionId = useCallback(
    (item: T) => `${baseId}-option-${getItemKey(item)}`,
    [baseId, getItemKey],
  )

  const selectItem = useCallback(
    (item: T) => {
      onSelect(item)
    },
    [onSelect],
  )

  /** Moves the highlight to `index`; identical path for keyboard and hover. */
  const setHighlight = useCallback((index: number) => {
    setState((prev) => (prev.highlightedIndex === index ? prev : { ...prev, highlightedIndex: index }))
  }, [])

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      const { isOpen, items, highlightedIndex } = state
      // A closed dropdown consumes nothing — keys keep their native behavior.
      if (!isOpen) return

      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowUp':
        case 'Home':
        case 'End': {
          // Consume even with zero items so the text cursor never moves while
          // the popup (loading/empty/error) is open.
          event.preventDefault()
          if (items.length === 0) return
          const last = items.length - 1
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? last
                : event.key === 'ArrowDown'
                  ? // Clamp at the ends, no wrap (AR-3).
                    Math.min(highlightedIndex === null ? 0 : highlightedIndex + 1, last)
                  : Math.max(highlightedIndex === null ? 0 : highlightedIndex - 1, 0)
          setHighlight(next)
          return
        }
        case 'Enter': {
          // No highlight → not consumed: the form keeps its native submit.
          if (highlightedIndex === null || items[highlightedIndex] === undefined) return
          event.preventDefault()
          selectItem(items[highlightedIndex])
          return
        }
        case 'Escape': {
          event.preventDefault()
          close()
          return
        }
        default:
          // Unhandled keys pass through untouched (AC 9).
          return
      }
    },
    [state, close, selectItem, setHighlight],
  )

  const onItemClick = useCallback(
    (item: T) => {
      selectItem(item)
    },
    [selectItem],
  )

  const onItemHover = useCallback(
    (index: number) => {
      setHighlight(index)
    },
    [setHighlight],
  )

  // --- Prop getters (AC 6): spread verbatim so ARIA cannot be mis-wired.
  const getInputProps = useCallback((): AutocompleteInputProps => {
    const { isOpen, items, highlightedIndex, query } = state
    const highlighted = highlightedIndex !== null ? items[highlightedIndex] : undefined
    return {
      role: 'combobox',
      'aria-expanded': isOpen,
      'aria-controls': listboxId,
      'aria-autocomplete': 'list',
      'aria-activedescendant': highlighted !== undefined ? optionId(highlighted) : undefined,
      value: query,
      onChange: (event: ReactChangeEvent<HTMLInputElement>) => onInputChange(event.target.value),
      onKeyDown,
    }
  }, [state, listboxId, optionId, onInputChange, onKeyDown])

  const getListboxProps = useCallback(
    (): AutocompleteListboxProps => ({ role: 'listbox', id: listboxId }),
    [listboxId],
  )

  const getItemProps = useCallback(
    (item: T, index: number): AutocompleteItemProps => ({
      role: 'option',
      id: optionId(item),
      'aria-selected': index === state.highlightedIndex,
      onClick: () => onItemClick(item),
      // mousemove (not enter) so a list scrolling under a resting pointer
      // does not steal the highlight until the pointer actually moves.
      onMouseMove: () => onItemHover(index),
    }),
    [state.highlightedIndex, optionId, onItemClick, onItemHover],
  )

  // --- Live-region text (AC 8): derived, generic, override-friendly.
  const statusMessage = deriveStatusMessage(state, statusMessages)

  return {
    state: { ...state, statusMessage },
    handlers: {
      onInputChange,
      close,
      onKeyDown,
      onItemClick,
      onItemHover,
      getInputProps,
      getListboxProps,
      getItemProps,
    },
  }
}

function deriveStatusMessage<T>(
  state: InternalState<T>,
  overrides: UseAutocompleteOptions<T>['statusMessages'],
): string {
  if (!state.isOpen) return ''
  switch (state.status) {
    case 'loading':
      return overrides?.loading ?? DEFAULT_LOADING_MESSAGE
    case 'success':
      return (overrides?.results ?? defaultResultsMessage)(state.items.length)
    case 'empty':
      return overrides?.empty ?? DEFAULT_EMPTY_MESSAGE
    case 'error':
      return state.error !== undefined && overrides?.error !== undefined
        ? overrides.error(state.error)
        : (state.error?.message ?? GENERIC_ERROR_MESSAGE)
    case 'idle':
      return ''
  }
}

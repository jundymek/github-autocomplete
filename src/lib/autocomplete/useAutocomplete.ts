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

/**
 * The single reopen guard (Stories 1.5 + 3.9): a closed popup may reopen —
 * without any refetch — only while the query still qualifies and the result
 * state is settled (`success`, `empty`, or `error`; the message states reopen
 * too, so the user can re-read why there is nothing to pick). Both the
 * focus-reopen path and the keyboard-reopen path decide through this one
 * predicate; `idle`, `loading`, below-threshold, and already-open fail it.
 */
function canReopen<T>(state: InternalState<T>, minChars: number): boolean {
  return (
    !state.isOpen &&
    state.query.length >= minChars &&
    (state.status === 'success' || state.status === 'empty' || state.status === 'error')
  )
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

  /**
   * The single reset path: cancel the debounce, abort any in-flight fetch, and
   * drop back to idle/closed with the given query (`''` for a full clear). Both
   * the below-threshold branch of `onInputChange` and `clear()` route through
   * it, so there is exactly one place that defines "reset to initial".
   */
  const resetToInitial = useCallback(
    (value: string) => {
      clearDebounceTimer()
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
    },
    [clearDebounceTimer, abortInFlight],
  )

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
        resetToInitial(value)
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
    [clearDebounceTimer, abortInFlight, resetToInitial, minChars, debounceMs, startFetch],
  )

  const clear = useCallback(() => {
    // One-action reset to the initial state (AC 1). Routes through the shared
    // `resetToInitial` path — the same reset the below-threshold branch uses —
    // so there is one reset definition and zero duplication. Calling it directly
    // (rather than via `onInputChange('')`) makes the reset unconditional: it
    // holds even when a host sets minChars to 0, where an empty query would
    // otherwise be "at threshold" and trigger a fetch instead of clearing.
    resetToInitial('')
  }, [resetToInitial])

  const close = useCallback(() => {
    // Closing cancels pending work: a debounced fetch queued before close
    // must not fire later and reopen the dropdown.
    clearDebounceTimer()
    abortInFlight()
    setState((prev) => ({ ...prev, isOpen: false, highlightedIndex: null }))
  }, [clearDebounceTimer, abortInFlight])

  const openIfResults = useCallback(() => {
    // Reopen-on-focus (1.5): show already-fetched results again without a new
    // request, gated by the shared `canReopen` guard. Never fetches, never
    // touches the debounce/highlight; failing states fall through as no-ops.
    setState((prev) => (canReopen(prev, minChars) ? { ...prev, isOpen: true } : prev))
  }, [minChars])

  // --- Ids (AC 7): stable per-instance base; option ids derive from getItemKey.
  const baseId = useId()
  const listboxId = `${baseId}-listbox`
  const optionId = useCallback(
    (item: T) => `${baseId}-option-${getItemKey(item)}`,
    [baseId, getItemKey],
  )

  const selectItem = useCallback(
    (item: T) => {
      // Accept is "close + notify" (Story 3.7): the single selection path both
      // Enter and click route through collapses the popup and clears the
      // highlight, then hands the item to the consumer. Only isOpen/highlight
      // change — query/items/status survive so reopen-on-focus (1.5) still has
      // results.
      //
      // The close must be durable, so it cancels pending work exactly like
      // close(): a user can accept a still-visible option while a debounce is
      // queued (a new qualifying keystroke keeps the previous results open for
      // ~debounceMs before its fetch fires). Without this teardown that queued
      // fetch would resolve after accept and reopen the popup behind the
      // selection. At a genuinely settled accept both calls are harmless no-ops.
      //
      // onSelect fires once, in the handler (never inside the setState updater —
      // a reducer side effect would double-fire under StrictMode).
      clearDebounceTimer()
      abortInFlight()
      setState((prev) => ({ ...prev, isOpen: false, highlightedIndex: null }))
      onSelect(item)
    },
    [clearDebounceTimer, abortInFlight, onSelect],
  )

  /** Moves the highlight to `index`; identical path for keyboard and hover. */
  const setHighlight = useCallback((index: number) => {
    setState((prev) => (prev.highlightedIndex === index ? prev : { ...prev, highlightedIndex: index }))
  }, [])

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      const { isOpen, items, highlightedIndex } = state
      if (!isOpen) {
        // Keyboard reopen (3.9, APG): ArrowDown/ArrowUp on a closed popup with
        // settled results reopen it — no refetch, no debounce — highlighting
        // the first (Down) or last (Up) option, or nothing when the settled
        // state has no items (empty/error message popup). One setState so the
        // open and the highlight commit in the same paint. Every other key —
        // and the arrows whenever `canReopen` fails (idle, loading,
        // below-threshold) — stays unconsumed with its native behavior.
        if (
          (event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
          canReopen(state, minChars)
        ) {
          event.preventDefault()
          const highlight = items.length === 0 ? null : event.key === 'ArrowDown' ? 0 : items.length - 1
          setState((prev) => ({ ...prev, isOpen: true, highlightedIndex: highlight }))
        }
        return
      }

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
    [state, minChars, close, selectItem, setHighlight],
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
      onFocus: openIfResults,
    }
  }, [state, listboxId, optionId, onInputChange, onKeyDown, openIfResults])

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
      clear,
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

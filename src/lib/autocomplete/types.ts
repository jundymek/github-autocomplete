/**
 * Public types for the `useAutocomplete<T>` headless hook.
 *
 * This module is part of the reusable `src/lib/autocomplete/` layer: it is
 * fully generic and has zero knowledge of any concrete data source.
 */

import type {
  ChangeEvent as ReactChangeEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from 'react'

/**
 * The dropdown lifecycle state. This discriminant is the single source of
 * truth for what a consuming UI renders — never derive it from `items.length`.
 *
 * - `idle` — query below the `minChars` threshold; nothing to show.
 * - `loading` — a debounced fetch is in flight.
 * - `success` — the fetch resolved with at least one item.
 * - `empty` — the fetch resolved with zero items ("no matches").
 * - `error` — the fetch rejected with a non-abort error.
 */
export type AutocompleteStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error'

/**
 * The error surfaced by the hook when a fetch rejects.
 */
export type AutocompleteError = {
  /** Generic, source-agnostic display message (e.g. "Something went wrong."). */
  message: string
  /**
   * The originally thrown value, preserved verbatim so an adapter can map it
   * to a source-specific message. The hook itself never inspects it.
   */
  cause?: unknown
}

/**
 * The single state object returned by `useAutocomplete<T>`.
 */
export type AutocompleteState<T> = {
  /** The current input value, updated synchronously on every change. */
  query: string
  /** Lifecycle status — the only source of truth for what the dropdown shows. */
  status: AutocompleteStatus
  /** The last successfully fetched suggestions; empty unless `status` is `success`. */
  items: T[]
  /**
   * Index of the keyboard-highlighted item, or `null` when nothing is
   * highlighted. Keyboard reducers land in story 1.2; this story only
   * initializes it and resets it to `null` on a new query and on close.
   */
  highlightedIndex: number | null
  /** Whether the dropdown popup is open. */
  isOpen: boolean
  /** Present only when `status` is `'error'`. */
  error?: AutocompleteError
  /**
   * Text for the visually-hidden `aria-live="polite"` status region the
   * component renders (1.3). Derived from the lifecycle state:
   * loading → "Searching…", success → "N results", empty → "No matches",
   * error → the error message, idle/closed → `''`. Generic, source-agnostic
   * defaults; overridable via {@link UseAutocompleteOptions.statusMessages}.
   */
  statusMessage: string
}

/**
 * Props emitted by `getInputProps()` for the combobox `<input>`.
 *
 * Focus never leaves the input (activedescendant technique): the highlighted
 * option is referenced via `aria-activedescendant`, never DOM-focused.
 * A visible `<label>`/`aria-label` is supplied by the consuming component,
 * not by the getter.
 */
export type AutocompleteInputProps = {
  role: 'combobox'
  'aria-expanded': boolean
  /** Id of the listbox popup this input controls. */
  'aria-controls': string
  'aria-autocomplete': 'list'
  /** Id of the highlighted option, or `undefined` when nothing is highlighted. */
  'aria-activedescendant': string | undefined
  /** Controlled value — always equals `state.query`. */
  value: string
  onChange: (event: ReactChangeEvent<HTMLInputElement>) => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void
}

/** Props emitted by `getListboxProps()` for the popup list element. */
export type AutocompleteListboxProps = {
  role: 'listbox'
  id: string
}

/** Props emitted by `getItemProps(item, index)` for each option element. */
export type AutocompleteItemProps = {
  role: 'option'
  /** Stable per-item id derived from `getItemKey` (referenced by `aria-activedescendant`). */
  id: string
  /** `true` only on the keyboard/hover-highlighted option. */
  'aria-selected': boolean
  /** Selects the item — same selection path as Enter. */
  onClick: (event: ReactMouseEvent<HTMLElement>) => void
  /** Moves the highlight to this item — same highlight state as Arrow keys. */
  onMouseMove: (event: ReactMouseEvent<HTMLElement>) => void
}

/**
 * The single handlers object returned by `useAutocomplete<T>`.
 *
 * All key logic lives in `onKeyDown`; mouse interaction routes through the
 * same selection/highlight paths as the keyboard (§3.4). The three prop
 * getters are spread by the consuming component so it cannot mis-wire ARIA.
 */
export type AutocompleteHandlers<T> = {
  /** Feeds a new input value into the hook (threshold + debounce applied). */
  onInputChange: (value: string) => void
  /** Closes the dropdown and resets the highlight; the query is kept. */
  close: () => void
  /**
   * Keyboard navigation: ArrowDown/ArrowUp (clamped at the ends, no wrap),
   * Home/End, Enter (select highlighted), Escape (close, keep query).
   * Calls `preventDefault()` only on the keys it consumes; everything else
   * passes through untouched.
   */
  onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void
  /** Selects `item` via pointer — identical outcome to Enter on the highlight. */
  onItemClick: (item: T, index: number) => void
  /** Moves the highlight to the hovered item at `index`. */
  onItemHover: (index: number) => void
  /** ARIA/value/handler props for the combobox `<input>` — spread verbatim. */
  getInputProps: () => AutocompleteInputProps
  /** ARIA props for the popup list element — spread verbatim. */
  getListboxProps: () => AutocompleteListboxProps
  /** ARIA + interaction props for the option at `index` — spread verbatim. */
  getItemProps: (item: T, index: number) => AutocompleteItemProps
}

/**
 * Options accepted by `useAutocomplete<T>`.
 */
export type UseAutocompleteOptions<T> = {
  /**
   * The injected data source — the one cross-layer contract. Called with the
   * settled query and an `AbortSignal` that is aborted when the request
   * becomes stale (new query, threshold drop, or unmount).
   */
  fetchSuggestions: (query: string, signal: AbortSignal) => Promise<T[]>
  /**
   * Stable key extractor for an item. Option ids derive from it
   * (`${base}-option-${getItemKey(item)}`), so keys must be unique within a
   * result set and stable across renders.
   */
  getItemKey: (item: T) => string
  /**
   * Called with the selected item when the user presses Enter on the
   * highlighted option or clicks an option. What selection *does* (e.g.
   * navigation) is entirely the consumer's concern.
   */
  onSelect: (item: T) => void
  /** Minimum query length (inclusive) before any request is issued. @default 3 */
  minChars?: number
  /** Debounce window in milliseconds between typing and fetching. @default 300 */
  debounceMs?: number
  /**
   * Overrides for the derived {@link AutocompleteState.statusMessage} live
   * region text. Defaults are generic and source-agnostic; an adapter can
   * replace any of them without the lib learning about the data source.
   */
  statusMessages?: {
    /** Shown while a fetch is in flight. @default 'Searching…' */
    loading?: string
    /** Shown when the fetch resolved with zero items. @default 'No matches' */
    empty?: string
    /** Builds the success message. @default count => `${count} result(s)` */
    results?: (count: number) => string
    /**
     * Builds the error message, e.g. from the preserved `error.cause`.
     * @default the generic `error.message`
     */
    error?: (error: AutocompleteError) => string
  }
}

/**
 * The return value of `useAutocomplete<T>`: exactly one state object and one
 * handlers object — never loose booleans.
 */
export type UseAutocompleteResult<T> = {
  state: AutocompleteState<T>
  handlers: AutocompleteHandlers<T>
}

/**
 * Public types for the `useAutocomplete<T>` headless hook.
 *
 * This module is part of the reusable `src/lib/autocomplete/` layer: it is
 * fully generic and has zero knowledge of any concrete data source.
 */

import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

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
}

/**
 * The single handlers object returned by `useAutocomplete<T>`.
 *
 * The full §3.4 handler surface is declared now so story 1.2 can implement
 * the keyboard/item handlers without breaking the type contract. In this
 * story only `onInputChange` and `close` carry behavior; the rest are
 * wired-up no-ops.
 */
export type AutocompleteHandlers = {
  /** Feeds a new input value into the hook (threshold + debounce applied). */
  onInputChange: (value: string) => void
  /** Closes the dropdown and resets the highlight; the query is kept. */
  close: () => void
  /**
   * Keyboard navigation (ArrowDown/ArrowUp/Enter/Escape).
   * Implemented in 1.2 — currently a no-op.
   */
  onKeyDown: (event: ReactKeyboardEvent) => void
  /**
   * Selects the item at `index` via pointer.
   * Implemented in 1.2 — currently a no-op.
   */
  onItemClick: (index: number) => void
  /**
   * Moves the highlight to the hovered item at `index`.
   * Implemented in 1.2 — currently a no-op.
   */
  onItemHover: (index: number) => void
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
   * Stable key extractor for an item. Unused by this story; consumed by the
   * rendering/ARIA layer from 1.2 onward.
   */
  getItemKey?: (item: T) => string
  /** Minimum query length (inclusive) before any request is issued. @default 3 */
  minChars?: number
  /** Debounce window in milliseconds between typing and fetching. @default 300 */
  debounceMs?: number
}

/**
 * The return value of `useAutocomplete<T>`: exactly one state object and one
 * handlers object — never loose booleans.
 */
export type UseAutocompleteResult<T> = {
  state: AutocompleteState<T>
  handlers: AutocompleteHandlers
}

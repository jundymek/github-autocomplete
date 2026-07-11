/**
 * Public API of the reusable autocomplete library.
 *
 * This barrel is the ONLY supported import path for consumers
 * (`import { Autocomplete } from '<...>/lib/autocomplete'`). Everything not
 * re-exported here is an internal implementation detail and may change or
 * move without notice. Lib internals never import this file — it is a leaf,
 * so no import cycle can form.
 */

export { Autocomplete } from './Autocomplete'
export { useAutocomplete } from './useAutocomplete'

export type {
  AutocompleteProps,
  UseAutocompleteOptions,
  UseAutocompleteResult,
  AutocompleteState,
  AutocompleteHandlers,
  AutocompleteStatus,
  AutocompleteError,
  AutocompleteErrorContent,
  AutocompleteErrorTone,
  AutocompleteMessages,
  AutocompleteFooterContext,
  AutocompleteInputProps,
  AutocompleteListboxProps,
  AutocompleteItemProps,
} from './types'

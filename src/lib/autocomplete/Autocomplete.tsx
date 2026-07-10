import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'

import styles from './Autocomplete.module.css'
import type {
  AutocompleteError,
  AutocompleteErrorContent,
  AutocompleteFooterContext,
  AutocompleteProps,
} from './types'
import { useAutocomplete } from './useAutocomplete'

const DEFAULT_MIN_CHARS = 3
const DEFAULT_PLACEHOLDER = 'Search…'
const DEFAULT_LABEL = 'Search'
const GAP_BELOW_INPUT_PX = 6
const SKELETON_ROW_COUNT = 3

/**
 * The documented themeable surface (AR-5). On open, the computed value of
 * each token is read from the component root and bridged inline onto the
 * portalled popup — the popup lives under `document.body`, outside the
 * host's DOM subtree, so ancestor-set tokens would otherwise never reach it.
 */
const AC_TOKENS = [
  '--ac-color-surface',
  '--ac-color-text',
  '--ac-color-text-muted',
  '--ac-color-accent',
  '--ac-color-highlight',
  '--ac-color-border',
  '--ac-color-danger',
  '--ac-color-warning',
  '--ac-color-warning-bg',
  '--ac-color-success',
  '--ac-font-ui',
  '--ac-font-mono',
  '--ac-radius',
  '--ac-radius-item',
  '--ac-space',
  '--ac-shadow',
  '--ac-dropdown-max-height',
  '--ac-z-index',
] as const

function defaultBelowThresholdHint(remaining: number): ReactNode {
  return (
    <>
      Type{' '}
      <b>
        {remaining} more character{remaining === 1 ? '' : 's'}
      </b>{' '}
      to search
    </>
  )
}

function defaultEmptyTitle(query: string): ReactNode {
  return <>No matches for “{query}”</>
}

const DEFAULT_EMPTY_HINT = 'Check the spelling or try a shorter query.'
const DEFAULT_RETRY_LABEL = 'Try again'

function defaultErrorContent(error: AutocompleteError): AutocompleteErrorContent {
  return { title: 'Search failed', description: error.message }
}

function defaultFooter(context: AutocompleteFooterContext): ReactNode {
  if (context.belowThreshold) {
    return (
      <>
        <span>min {context.minChars} characters</span>
        <span>esc to close</span>
      </>
    )
  }
  switch (context.status) {
    case 'loading':
      return (
        <>
          <span>searching…</span>
          <span />
        </>
      )
    case 'success':
      return (
        <>
          <span>
            {context.resultCount} result{context.resultCount === 1 ? '' : 's'} · sorted A→Z
          </span>
          <span>↑↓ browse · ↵ open</span>
        </>
      )
    case 'empty':
      return (
        <>
          <span>0 results</span>
          <span>esc to close</span>
        </>
      )
    default:
      return null
  }
}

/**
 * Positions the portalled popup to the input's viewport rect: measured when
 * `active` becomes true and re-measured on `scroll` (capture, to catch
 * scrolling ancestors) and `resize`. `position: fixed` works directly off
 * `getBoundingClientRect()` viewport coordinates — no scroll-offset math.
 * The same measurement pass bridges the computed `--ac-*` token values from
 * `anchor`'s cascade onto the popup (see {@link AC_TOKENS}).
 */
function usePopupStyle(
  active: boolean,
  anchor: React.RefObject<HTMLElement | null>,
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({})

  useLayoutEffect(() => {
    if (!active) return

    const measure = () => {
      const el = anchor.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const next: Record<string, string | number> = {
        position: 'fixed',
        top: rect.bottom + GAP_BELOW_INPUT_PX,
        left: rect.left,
        width: rect.width,
      }
      const computed = getComputedStyle(el)
      for (const token of AC_TOKENS) {
        const value = computed.getPropertyValue(token).trim()
        if (value !== '') next[token] = value
      }
      setStyle((prev) => {
        const prevRecord = prev as Record<string, string | number>
        const prevKeys = Object.keys(prevRecord)
        const nextKeys = Object.keys(next)
        const unchanged =
          prevKeys.length === nextKeys.length && nextKeys.every((k) => prevRecord[k] === next[k])
        return unchanged ? prev : (next as CSSProperties)
      })
    }

    measure()
    window.addEventListener('scroll', measure, { capture: true })
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure, { capture: true })
      window.removeEventListener('resize', measure)
    }
  }, [active, anchor])

  return style
}

/**
 * Generic, self-contained autocomplete component over `useAutocomplete<T>`
 * (AR-4): renders the combobox input, a visually-hidden live region, and a
 * dropdown portalled to `document.body` so it stays fully visible inside
 * `overflow: hidden` hosts (AR-7). It contains no keyboard logic of its own —
 * every key routes through the hook's handlers (§3.4) — and no knowledge of
 * any concrete data source: content, texts and footer are all injectable.
 */
export function Autocomplete<T>(props: AutocompleteProps<T>) {
  const {
    fetchSuggestions,
    renderItem,
    getItemKey,
    onSelect,
    placeholder = DEFAULT_PLACEHOLDER,
    label = DEFAULT_LABEL,
    minChars = DEFAULT_MIN_CHARS,
    debounceMs,
    messages,
    statusMessages,
    renderFooter = defaultFooter,
  } = props

  const { state, handlers } = useAutocomplete<T>({
    fetchSuggestions,
    getItemKey,
    onSelect,
    minChars,
    debounceMs,
    statusMessages,
  })

  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  /** The portalled popup element; used for the "inside" test since it lives
   *  under document.body, outside rootRef's DOM subtree. */
  const popupRef = useRef<HTMLDivElement>(null)

  const [isFocused, setIsFocused] = useState(false)
  /** Query whose below-threshold hint Escape dismissed; typing resets it. */
  const [hintDismissedFor, setHintDismissedFor] = useState<string | null>(null)

  const belowThreshold =
    isFocused &&
    state.query.length > 0 &&
    state.query.length < minChars &&
    hintDismissedFor !== state.query
  const popupOpen = state.isOpen || belowThreshold

  const popupStyle = usePopupStyle(popupOpen, inputRef)

  // Keep the highlighted option in view inside the max-height-bounded list.
  // The option element is resolved via the input's aria-activedescendant —
  // the same id-based link assistive tech follows across the portal.
  useLayoutEffect(() => {
    if (state.highlightedIndex === null) return
    const activeId = inputRef.current?.getAttribute('aria-activedescendant')
    if (activeId === null || activeId === undefined) return
    const option = document.getElementById(activeId)
    if (option && typeof option.scrollIntoView === 'function') {
      option.scrollIntoView({ block: 'nearest' })
    }
  }, [state.highlightedIndex])

  const inputProps = handlers.getInputProps()

  // All keys route through the hook first (§3.4 — the component adds no
  // navigation/selection logic). The one presentational addition: Escape
  // dismisses the below-threshold hint popup, which the hook cannot own
  // because it never opens below the threshold (its isOpen stays false).
  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      inputProps.onKeyDown(event)
      if (!event.defaultPrevented && event.key === 'Escape' && belowThreshold) {
        event.preventDefault()
        setHintDismissedFor(state.query)
      }
    },
    [inputProps, belowThreshold, state.query],
  )

  // Outside-press dismissal (WAI-ARIA combobox): while the popup is open,
  // a pointerdown outside BOTH the component root and the portalled popup
  // closes it — same outcome as Escape. `pointerdown` (not click/blur) closes
  // on press, before focus churn, and covers mouse/touch/pen; a press inside
  // the popup (option/footer) is treated as inside so clicks still select.
  // The listener exists only while open and is removed on close/unmount (AC 5).
  useEffect(() => {
    if (!popupOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      const insideRoot = target !== null && rootRef.current?.contains(target) === true
      const insidePopup = target !== null && popupRef.current?.contains(target) === true
      if (insideRoot || insidePopup) return
      // Results: reuse the hook's close() (cancels debounce, aborts, resets
      // highlight, keeps the query). Hint: mirror the Escape-dismiss path.
      handlers.close()
      if (belowThreshold) setHintDismissedFor(state.query)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [popupOpen, belowThreshold, state.query, handlers])

  const retry = useCallback(() => {
    handlers.onInputChange(state.query)
    inputRef.current?.focus()
  }, [handlers, state.query])

  const errorContent: AutocompleteErrorContent | null =
    state.status === 'error' && state.error !== undefined
      ? (messages?.error ?? defaultErrorContent)(state.error)
      : null

  const footer = renderFooter({
    status: state.status,
    query: state.query,
    resultCount: state.status === 'success' ? state.items.length : 0,
    minChars,
    belowThreshold,
  })

  const popupBody = (): ReactNode => {
    if (belowThreshold) {
      const hint = messages?.belowThreshold ?? defaultBelowThresholdHint
      return (
        <div className={styles.state}>
          <div className={styles.stateDesc}>{hint(minChars - state.query.length)}</div>
        </div>
      )
    }
    switch (state.status) {
      case 'loading':
        return (
          <div aria-hidden="true">
            {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
              <div key={i} className={styles.skel}>
                <div className={styles.skelCircle} />
                <div className={styles.skelLine} />
              </div>
            ))}
          </div>
        )
      case 'success':
        return null
      case 'empty':
        return (
          <div className={styles.state}>
            <div className={styles.stateTitle}>
              {(messages?.empty ?? defaultEmptyTitle)(state.query)}
            </div>
            <div className={styles.stateDesc}>{messages?.emptyHint ?? DEFAULT_EMPTY_HINT}</div>
          </div>
        )
      case 'error': {
        if (errorContent === null) return null
        const tone = errorContent.tone ?? 'error'
        const toneClass = tone === 'warning' ? styles.warn : styles.error
        return (
          <div className={`${styles.state} ${toneClass}`}>
            <div className={styles.stateTitle}>{errorContent.title}</div>
            {errorContent.description !== undefined && (
              <div className={styles.stateDesc}>{errorContent.description}</div>
            )}
            {(errorContent.retryable ?? true) && (
              <button type="button" className={styles.retry} onClick={retry}>
                {messages?.retryLabel ?? DEFAULT_RETRY_LABEL}
              </button>
            )}
          </div>
        )
      }
      case 'idle':
        return null
    }
  }

  return (
    <div ref={rootRef} className={styles.root}>
      <input
        {...inputProps}
        ref={inputRef}
        type="text"
        autoComplete="off"
        spellCheck={false}
        className={styles.input}
        placeholder={placeholder}
        aria-label={label}
        onKeyDown={onKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {state.status === 'loading' && (
        <div className={styles.slot} aria-hidden="true">
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </div>
      )}
      {/* Rendered in-flow (not in the portal) so it stays inside the host's
          accessibility tree regardless of where the popup lands. */}
      <div className={styles.srOnly} role="status" aria-live="polite">
        {state.statusMessage}
      </div>
      {popupOpen &&
        createPortal(
          <div ref={popupRef} className={styles.pop} style={popupStyle}>
            {/* The listbox element exists whenever the combobox reports
                aria-expanded="true", so aria-controls always resolves —
                it just has no options outside the success state. */}
            {state.isOpen && (
              <ul {...handlers.getListboxProps()} className={styles.list}>
                {state.status === 'success' &&
                  state.items.map((item, index) => {
                    const highlighted = index === state.highlightedIndex
                    return (
                      <li
                        key={getItemKey(item)}
                        {...handlers.getItemProps(item, index)}
                        className={styles.item}
                      >
                        {renderItem(item, { highlighted })}
                      </li>
                    )
                  })}
              </ul>
            )}
            {popupBody()}
            {footer !== null && footer !== undefined && (
              <div className={styles.foot}>{footer}</div>
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}

# Manual testing — 1.3 `Autocomplete<T>` presentational component

## Prerequisites

The demo page arrives in Epic 3, so mount the component temporarily. Replace the body of
`src/App.tsx` with the harness below (do not commit it), then run `pnpm dev`.

```tsx
import type { CSSProperties } from 'react'
import { Autocomplete } from './lib/autocomplete/Autocomplete'

type Country = { code: string; name: string }
const COUNTRIES: Country[] = [
  { code: 'de', name: 'Germany' },
  { code: 'pl', name: 'Poland' },
  { code: 'pt', name: 'Portugal' },
  { code: 'pe', name: 'Peru' },
]

const search =
  (fail = false) =>
  (query: string) =>
    new Promise<Country[]>((resolve, reject) =>
      setTimeout(() => {
        if (fail) reject(new Error('boom'))
        resolve(COUNTRIES.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())))
      }, 600),
    )

export default function App() {
  return (
    <main style={{ padding: 40, display: 'flex', gap: 40 }}>
      {/* Clipping host — proves the portal escapes overflow: hidden */}
      <section style={{ width: 360, height: 90, overflow: 'hidden', border: '1px dashed #999' }}>
        <Autocomplete<Country>
          fetchSuggestions={search()}
          renderItem={(c, { highlighted }) => <span>{highlighted ? '» ' : ''}{c.name}</span>}
          getItemKey={(c) => c.code}
          onSelect={(c) => alert(c.name)}
          label="Search countries"
          placeholder="Search countries…"
        />
      </section>
      {/* Themed + always-failing instance */}
      <section
        style={{ width: 360, '--ac-color-accent': '#0F766E', '--ac-color-highlight': '#E9F4F2' } as CSSProperties}
      >
        <Autocomplete<Country>
          fetchSuggestions={search(true)}
          renderItem={(c) => <span>{c.name}</span>}
          getItemKey={(c) => c.code}
          onSelect={() => {}}
          label="Themed search"
          placeholder="Always fails…"
        />
      </section>
    </main>
  )
}
```

## Steps and expected results

1. **Below threshold:** click the first input, type `p`.
   *Expected:* a popup with "Type **2 more characters** to search" and the footer
   "min 3 characters / esc to close". No network/console activity, no listbox.
2. **Loading:** type `pol` (3 chars).
   *Expected:* after ~300 ms debounce, three pulsing dots appear at the input's right edge, the
   popup shows 3 grey skeleton rows and the footer reads "searching…".
3. **Results:** wait for the fetch (~600 ms).
   *Expected:* "Poland" listed; footer "1 result · sorted A→Z / ↑↓ browse · ↵ open". The dropdown
   extends **below the dashed clipping box** — it must not be cut off (portal proof).
4. **Keyboard highlight:** press ArrowDown / ArrowUp with a broader query (e.g. `er` won't
   qualify — use `p` + backspace tricks or add countries).
   *Expected:* highlighted row gets the light background + a 2px accent bar on the left; the
   highlight clamps at the first/last item (no wrap); with a long list it stays scrolled into view.
5. **Selection:** press Enter on a highlighted row, then repeat with a mouse click.
   *Expected:* `alert` with the country name in both cases.
6. **Escape:** reopen results, press Escape.
   *Expected:* popup closes; the query text stays in the input; focus stays in the input (caret
   still blinks; typing continues immediately).
7. **Empty state:** type `xqzyw`.
   *Expected:* "No matches for “xqzyw”" + "Check the spelling or try a shorter query." + footer
   "0 results / esc to close".
8. **Error + retry:** in the second (themed) input type `abc`.
   *Expected:* red "Search failed" title, "Something went wrong." description and a "Try again"
   button. Clicking it re-runs the search (dots + skeletons again, then the error again).
9. **Theming:** compare the two instances.
   *Expected:* the second instance's focus ring, dots and retry button are teal (`#0F766E`)
   purely from the ancestor `--ac-*` style — including inside the portalled dropdown.
10. **Reduced motion:** in DevTools → Rendering → "Emulate CSS prefers-reduced-motion: reduce",
    repeat step 2.
    *Expected:* dots static at reduced opacity; the popup appears without the fade/slide.

## Accessibility checks

- **Keyboard-only:** every step above works without a mouse; Tab reaches the input; the retry
  button is reachable with Tab and shows a visible focus outline.
- **Visible focus:** the input shows the 2px accent ring (offset by 2px surface) whenever focused.
- **Focus never leaves the input** while arrowing through options (inspect
  `document.activeElement` in the console; options are referenced via `aria-activedescendant`).
- **Screen reader / live region:** with VoiceOver (or by watching the `role="status"` element in
  the Elements panel) the states announce "Searching…", "1 result", "No matches", and the error
  message as they occur.
- **ARIA wiring:** the input has `role="combobox"`, `aria-expanded` toggling with the popup,
  `aria-controls` pointing at the portalled `role="listbox"`, and each row is a `role="option"`
  with an id derived from `getItemKey`.

Revert `src/App.tsx` when done.

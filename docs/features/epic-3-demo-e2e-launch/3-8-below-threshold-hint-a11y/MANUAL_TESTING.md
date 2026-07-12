# Manual testing — 3.8 Announce the below-threshold hint

Verifies that the "type N more characters" gate is announced to a screen reader and associated with
the input, matching what sighted users see. This is non-visual behavior, so a screen reader is
required for the core check.

## Prerequisites

- `pnpm dev`, open the demo in the browser.
- A screen reader: **VoiceOver** on macOS (`Cmd+F5` to toggle) is assumed below; NVDA/JAWS behave
  equivalently.

## Steps & Expected

Do this on **both** instances — the **GitHub** combobox (`minChars: 3`) and the **country** combobox
— the behavior is generic, not GitHub-specific.

1. Turn VoiceOver on (`Cmd+F5`).
2. Click into the combobox input and type a single character (e.g. `r`).
   - **Expected:** the popup shows "Type **2** more characters to search". VoiceOver announces
     "Type 2 more characters to search" politely (it does not interrupt).
3. Type a second character (e.g. `re`).
   - **Expected:** the visible hint updates to "Type **1** more character to search" (singular), and
     VoiceOver announces the new value. The count tracks `minChars − query.length`.
4. With the hint showing, navigate VoiceOver onto the input (e.g. `VO+Left/Right` or `Tab` back to
   it) and read its description.
   - **Expected:** VoiceOver reads the input's label **and** the hint text as its description — the
     input is `aria-describedby` the visible hint node while below threshold.
5. Type a third character (e.g. `rea`) so the query reaches `minChars`.
   - **Expected:** the gating hint disappears; the live region now announces the search state
     ("Searching…", then "N results" / "No matches" / the error message). The input **no longer**
     advertises the hint as its description (no dangling `aria-describedby`).
6. Delete back to a single character, then press **Escape**.
   - **Expected:** the hint popup closes; nothing is announced for the (now dismissed) hint and the
     input's description reference is gone. Typing changes the query again re-shows and re-announces
     the hint.

## Agent-driven DOM verification (done)

The **machine-observable** half of the steps above was driven in the running app (`pnpm dev`) via
Playwright and confirmed on **both** instances — this is the part an agent can verify without audio:

| Instance | Input | `aria-describedby` | Described hint text | `role="status"` live text |
|---|---|---|---|---|
| Search GitHub | `r` | `_r_1_-below-threshold-hint` | Type 2 more characters to search | Type 2 more characters to search |
| Search GitHub | `re` | present (same id) | — | Type **1** more character to search (singular) |
| Search GitHub | `rea` (at `minChars`) | **absent** | — | — |
| Search countries | `p` | `_r_3_-below-threshold-hint` | Type 2 more characters to search | Type 2 more characters to search |

So: the live region announces the hint below threshold and tracks the count (2→1, correct
pluralization); the input is `aria-describedby` the visible hint node whose id matches exactly; and
the association drops at threshold — on both the GitHub (features layer) and country (pure lib layer)
instances.

**Audible VoiceOver check — verified by Łukasz (2026-07-12):** with VoiceOver on, typing below
threshold is spoken (politely), the count updates 2→1 as more characters are typed, and returning
focus to the input reads the hint as the input's description (`aria-describedby`). This is the
human-only half; it now matches the agent-verified DOM state above.

## Accessibility checks

- **Live region:** the hint is announced via the existing visually-hidden `role="status"
  aria-live="polite"` region — polite, not assertive (the hint is advisory, not an error). No second
  live region, so no double announcements.
- **Association:** while below threshold the input carries `aria-describedby` pointing at the visible
  hint node; the attribute is absent at/above threshold and after Escape-dismiss (verify in DevTools:
  inspect the `<input>` and confirm `aria-describedby` appears/disappears with the hint).
- **No visual change:** the visible hint is unchanged — still the rich text with the bold remaining
  count.
- **axe:** the automated below-threshold scan in `e2e/a11y.spec.ts` stays clean (zero
  critical/serious violations) with the new `aria-describedby` present.

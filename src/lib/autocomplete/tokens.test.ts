/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Story 0.3 — the `--ac-*` token contract.
 *
 * `tokens.css` is the documented source of the design fallbacks (AR-5). These
 * tests pin every token name/value 1:1 to `docs/design/design-tokens.md` so a
 * drive-by edit cannot silently drift the contract Epic 1 bakes into
 * `Autocomplete.module.css` as `var(--ac-x, <fallback>)`.
 */

const css = readFileSync(join(process.cwd(), 'src/lib/autocomplete/tokens.css'), 'utf8')

/** Declarations parsed as `--ac-name: value;` (one per line in tokens.css). */
const declarations = new Map<string, string>(
  [...css.matchAll(/(--ac-[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
)

/** Verbatim values from docs/design/design-tokens.md — do not alter. */
const expectedTokens: Record<string, string> = {
  // Color
  '--ac-color-surface': '#FFFFFF',
  '--ac-color-text': '#1F2328',
  '--ac-color-text-muted': '#59636E',
  '--ac-color-accent': '#6639BA',
  '--ac-color-highlight': '#F5F1FB',
  '--ac-color-border': '#D1D9E0',
  '--ac-color-danger': '#CF222E',
  '--ac-color-warning': '#9A6700',
  '--ac-color-warning-bg': '#FFF8C5',
  '--ac-color-success': '#1A7F37',
  // Typography
  '--ac-font-ui': 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  '--ac-font-mono': 'ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace',
  // Spacing & shape
  '--ac-radius': '10px',
  '--ac-radius-item': '6px',
  '--ac-space': '8px',
  '--ac-shadow': '0 8px 24px rgba(31,35,40,.12), 0 1px 3px rgba(31,35,40,.08)',
  '--ac-dropdown-max-height': '368px',
  '--ac-z-index': '1000',
}

describe('tokens.css — --ac-* design token contract (AC 1, 2)', () => {
  it.each(Object.entries(expectedTokens))('declares %s with the exact design value', (name, value) => {
    expect(declarations.get(name)).toBe(value)
  })

  it('declares no tokens beyond the documented contract', () => {
    expect([...declarations.keys()].sort()).toEqual(Object.keys(expectedTokens).sort())
  })

  it('follows the --ac-<area>-<property> naming convention', () => {
    for (const name of declarations.keys()) {
      expect(name).toMatch(/^--ac-[a-z][a-z-]*$/)
    }
  })
})

describe('tokens.css — focus ring guarantee (AC 3)', () => {
  it('provides the accent token used as the visible focus indicator', () => {
    expect(declarations.get('--ac-color-accent')).toBe('#6639BA')
    // The focus-ring recipe (2px accent ring, 2px offset) must be documented
    // next to the token so Epic 1 implements it verbatim.
    expect(css).toMatch(/2px.*focus ring.*2px offset/i)
  })
})

/** WCAG 2.x relative luminance of a #RRGGBB color. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two #RRGGBB colors. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('tokens.css — WCAG AA contrast of the baked values (AC 3)', () => {
  const surface = '#FFFFFF'

  it.each([
    ['--ac-color-text', 7], // AAA per design rationale (16.1:1)
    ['--ac-color-text-muted', 4.5],
    ['--ac-color-accent', 4.5],
    ['--ac-color-danger', 4.5],
    ['--ac-color-warning', 4.5],
    ['--ac-color-success', 4.5],
  ])('%s meets ≥%s:1 on the surface color', (token, threshold) => {
    expect(contrast(declarations.get(token)!, surface)).toBeGreaterThanOrEqual(threshold)
  })

  it('accent meets ≥3:1 as a non-text focus indicator on surface', () => {
    expect(contrast(declarations.get('--ac-color-accent')!, surface)).toBeGreaterThanOrEqual(3)
  })

  it('primary text on the warning background meets AAA (documented 13.9:1)', () => {
    expect(
      contrast(declarations.get('--ac-color-text')!, declarations.get('--ac-color-warning-bg')!),
    ).toBeGreaterThanOrEqual(7)
  })

  it('text, muted, and accent stay AA on the highlighted row background', () => {
    const highlight = declarations.get('--ac-color-highlight')!
    expect(contrast(declarations.get('--ac-color-text')!, highlight)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(declarations.get('--ac-color-text-muted')!, highlight)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(declarations.get('--ac-color-accent')!, highlight)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('tokens.css — no global styles (AC 5)', () => {
  it('never targets :root, html, body, or the universal selector', () => {
    const selectors = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(^|\})\s*([^{}]+)\{/g)].map((m) =>
      m[2].trim(),
    )
    expect(selectors.length).toBeGreaterThan(0)
    for (const selector of selectors) {
      expect(selector).not.toMatch(/(^|[\s,>~+])(:root|html|body|\*)([\s,{.:[]|$)/)
    }
  })

  it('scopes all declarations to the documented .acRoot wrapper class', () => {
    const selectors = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(^|\})\s*([^{}]+)\{/g)].map((m) =>
      m[2].trim(),
    )
    for (const selector of selectors) {
      expect(selector).toBe('.acRoot')
    }
  })

  it('contains only custom-property declarations (no styling side effects)', () => {
    const bodies = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\{([^}]*)\}/g)].map((m) => m[1])
    for (const body of bodies) {
      for (const line of body.split(';').map((l) => l.trim()).filter(Boolean)) {
        expect(line).toMatch(/^--ac-/)
      }
    }
  })
})

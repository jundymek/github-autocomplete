import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { githubCombobox, options, searchAndAwaitResults } from './helpers/autocomplete'
import { mockGithub } from './helpers/mockGithub'

// NFR-1: WCAG 2.1 AA. The enforced bar is zero `critical`/`serious` axe
// violations across closed / open-with-results / error states. Impact levels
// below serious are reported for visibility but do not fail (documented in the
// feature README so an operator can tighten to zero-at-any-level).

const BLOCKING_IMPACTS = new Set(['critical', 'serious'])

// Scan with reduced motion so axe sees the SETTLED state, not a frame mid
// entry-animation. The popup fades in via `ac-in` (opacity 0→1); scanning
// during it blends the amber warning background and drops color-contrast just
// under AA. The component honors `prefers-reduced-motion: reduce` (no popup
// animation), so this makes the scans deterministic without masking any real
// static-state contrast issue.
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

async function scanBlocking(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze()
  return violations.filter((v) => v.impact !== null && BLOCKING_IMPACTS.has(v.impact ?? ''))
}

test('closed state has no critical/serious violations (AC 5)', async ({ page }) => {
  await mockGithub(page, 'small')
  await page.goto('/')
  await expect(githubCombobox(page)).toBeVisible()

  expect(await scanBlocking(page)).toEqual([])
})

test('below-threshold hint state has no critical/serious violations (3.8)', async ({ page }) => {
  await mockGithub(page, 'small')
  await page.goto('/')
  const input = githubCombobox(page)
  await input.click()
  // 1 char is below the default minChars of 3 → the gating hint shows and the
  // input gains aria-describedby pointing at it. Scan that live state.
  await input.fill('r')
  await expect(input).toHaveAttribute('aria-describedby', /.+/)
  // The described hint node is visible and carries the gating text. React's
  // useId ids contain characters (»/«/:) that are invalid in a raw CSS `#id`
  // selector, so match on the quoted `[id="…"]` attribute instead of `#${id}`.
  const hintId = await input.getAttribute('aria-describedby')
  const hint = page.locator(`[id="${hintId}"]`)
  await expect(hint).toBeVisible()
  await expect(hint).toContainText(/more character/i)

  expect(await scanBlocking(page)).toEqual([])
})

test('open-with-results state has no critical/serious violations (AC 5)', async ({ page }) => {
  await mockGithub(page, 'small')
  await page.goto('/')
  await searchAndAwaitResults(page)
  await expect(options(page)).toHaveCount(4)

  // Scan the open combobox/listbox — where the ARIA wiring (AR-6) is live.
  expect(await scanBlocking(page)).toEqual([])
})

test('error (rate-limit) state has no critical/serious violations (AC 5)', async ({ page }) => {
  await mockGithub(page, 'rate-limit')
  await page.goto('/')
  const input = githubCombobox(page)
  await input.click()
  await input.fill('react')
  await expect(page.getByText(/rate limit reached/i)).toBeVisible()

  expect(await scanBlocking(page)).toEqual([])
})

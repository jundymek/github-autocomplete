import { expect, test } from '@playwright/test'

import { githubCombobox, searchAndAwaitResults } from './helpers/autocomplete'
import { mockGithub } from './helpers/mockGithub'

// Focus management is browser-real: the input keeps focus throughout keyboard
// navigation (aria-activedescendant, not roving focus) and after Escape (AR-6).
test.beforeEach(async ({ page }) => {
  await mockGithub(page, 'small')
  await page.goto('/')
})

test('input keeps focus during ArrowDown/ArrowUp and after Escape (AC 7)', async ({ page }) => {
  await searchAndAwaitResults(page)
  const input = githubCombobox(page)

  await expect(input).toBeFocused()

  await input.press('ArrowDown')
  await expect(input).toBeFocused()
  // Navigation uses aria-activedescendant, not roving focus.
  await expect(input).toHaveAttribute('aria-activedescendant', /.+/)

  await input.press('ArrowDown')
  await input.press('ArrowUp')
  await expect(input).toBeFocused()

  // Escape closes the dropdown but keeps focus and the query text.
  await input.press('Escape')
  await expect(input).toHaveAttribute('aria-expanded', 'false')
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('react')
})

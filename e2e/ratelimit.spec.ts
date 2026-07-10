import { expect, test } from '@playwright/test'

import { githubCombobox } from './helpers/autocomplete'
import { mockGithub } from './helpers/mockGithub'

// Story 2.3 rate-limit render, proved end-to-end: a 403 carrying rate-limit
// headers maps to the dedicated amber message, distinct from the generic error.
test.beforeEach(async ({ page }) => {
  await mockGithub(page, 'rate-limit')
  await page.goto('/')
})

test('403 rate-limit route renders the dedicated rate-limit message (AC 4)', async ({ page }) => {
  const input = githubCombobox(page)
  await input.click()
  await input.fill('react')

  // Dedicated rate-limit wording (title + throttling/token hint), NOT the
  // generic "Search failed" http/network copy.
  await expect(page.getByText(/rate limit reached/i)).toBeVisible()
  await expect(page.getByText(/requests per minute|add a token|try again in/i)).toBeVisible()
  await expect(page.getByText('Search failed')).toHaveCount(0)
})

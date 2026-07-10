import { expect, test } from '@playwright/test'

import { githubCombobox, searchAndAwaitResults } from './helpers/autocomplete'
import { mockGithub } from './helpers/mockGithub'

// Story 1.4: outside-pointer dismissal. This is a genuinely browser-real path
// (a document-level pointerdown listener + a portalled popup) that RTL only
// approximates — asserted thinly here, not re-testing the hook's close
// internals (those have full RTL coverage).
test.beforeEach(async ({ page }) => {
  await mockGithub(page, 'small')
  await page.goto('/')
})

test('outside pointer press closes the dropdown, keeping the query (AC 9)', async ({ page }) => {
  await searchAndAwaitResults(page)
  const input = githubCombobox(page)
  await expect(input).toHaveAttribute('aria-expanded', 'true')

  // Press on the page heading — outside both the component root and the
  // portalled popup. mousedown drives the pointerdown dismissal path.
  await page.getByRole('heading', { level: 1 }).click()

  await expect(input).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(input).toHaveValue('react')
})

import { test, expect } from '@playwright/test'

// Trivial smoke spec proving the Playwright harness boots the app.
// Real feature specs (including the axe scan) land in Story 3.2.
test('placeholder page loads', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'github-autocomplete' })).toBeVisible()
})

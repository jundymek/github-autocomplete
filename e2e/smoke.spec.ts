import { test, expect } from '@playwright/test'

// Trivial smoke spec proving the Playwright harness boots the demo page.
// Real feature specs (new-tab opening, focus management, axe scan) land in
// Story 3.2.
test('demo page loads with both instances', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { level: 1, name: /one autocomplete, any data/i }),
  ).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Search GitHub' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Search countries' })).toBeVisible()
})

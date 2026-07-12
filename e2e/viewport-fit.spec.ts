import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

import { githubCombobox, listbox, options } from './helpers/autocomplete'
import { mockGithub } from './helpers/mockGithub'

// Story 3.10: in a short window the popup must fit the viewport — the list
// shrinks and scrolls internally instead of being clipped by the viewport
// edge (the popup is position:fixed, so page scroll can never reveal it).
// Kept thin: the flip-above geometry is covered at the RTL level
// (Autocomplete.position.test.tsx); the browser asserts the real fit.

const SHORT_VIEWPORT = { width: 1280, height: 400 }

test.beforeEach(async ({ context, page }) => {
  // Axe must scan the settled popup, not a frame mid entry-animation (see
  // a11y.spec.ts) — the component disables the animation under reduced motion.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize(SHORT_VIEWPORT)
  // Selecting an option opens the item's html_url in a new tab — stub the
  // github.com host so the suite stays fully network-isolated (AR-12).
  await context.route(/^https:\/\/github\.com\//, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>stub</title>' }),
  )
  await mockGithub(page, 'big')
  await page.goto('/')
})

test('short viewport: the open popup fits fully inside the viewport (AC 1, 2)', async ({
  page,
}) => {
  const input = githubCombobox(page)
  await input.click()
  await input.fill('react')
  await expect(options(page)).toHaveCount(50)

  const popup = page.locator('[class*="pop"]').filter({ has: listbox(page) })
  const popupBox = await popup.boundingBox()
  expect(popupBox).not.toBeNull()
  if (popupBox) {
    expect(popupBox.y).toBeGreaterThanOrEqual(0)
    expect(popupBox.y + popupBox.height).toBeLessThanOrEqual(SHORT_VIEWPORT.height)
    expect(popupBox.x).toBeGreaterThanOrEqual(0)
    expect(popupBox.x + popupBox.width).toBeLessThanOrEqual(SHORT_VIEWPORT.width)
  }

  // The footer (popup chrome) is visible — the list absorbed the shrinkage.
  const foot = popup.locator('[class*="foot"]')
  await expect(foot).toBeVisible()
  await expect(foot).toContainText(/50 of 800/)
  const footBox = await foot.boundingBox()
  expect(footBox).not.toBeNull()
  if (footBox) {
    expect(footBox.y + footBox.height).toBeLessThanOrEqual(SHORT_VIEWPORT.height)
  }
})

test('short viewport: the last option is reachable inside the scrollable list and clickable (AC 2)', async ({
  page,
  context,
}) => {
  const input = githubCombobox(page)
  await input.click()
  await input.fill('react')
  await expect(options(page)).toHaveCount(50)

  const last = options(page).last()
  // .click() auto-scrolls the option into view inside the internal list —
  // impossible if the row were cut off by the viewport with no scroll path.
  const [opened] = await Promise.all([context.waitForEvent('page'), last.click()])
  await opened.waitForLoadState('domcontentloaded')
  expect(opened.url()).toMatch(/^https:\/\/github\.com\//)
})

test('short viewport: open popup has no critical/serious axe violations (AC 5)', async ({
  page,
}) => {
  const input = githubCombobox(page)
  await input.click()
  await input.fill('react')
  await expect(options(page)).toHaveCount(50)

  const { violations } = await new AxeBuilder({ page }).analyze()
  const blocking = violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  )
  expect(blocking).toEqual([])
})

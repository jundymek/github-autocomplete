import { expect, test } from '@playwright/test'

import { githubCombobox, listbox, options } from './helpers/autocomplete'
import { mockGithub } from './helpers/mockGithub'

// FR-7 / AR-7: the dropdown renders through a React portal to document.body, so
// it escapes an `overflow: hidden` ancestor and stays fully visible. The demo's
// `?clip=1` host wraps a real GitHub instance in such a container.
test('dropdown escapes an overflow:hidden host and is fully visible (AC 6)', async ({ page }) => {
  await mockGithub(page, 'small')
  await page.goto('/?clip=1')

  const host = page.getByTestId('clip-host')
  const hostBox = await host.boundingBox()
  expect(hostBox).not.toBeNull()

  const input = githubCombobox(page)
  await input.click()
  await input.fill('react')
  await expect(options(page)).toHaveCount(4)

  // The popup lives under document.body (portal), NOT inside the clipping host.
  const popupInsideHost = await host.locator('[role="listbox"]').count()
  expect(popupInsideHost).toBe(0)

  // The last option renders BELOW the clipping host's bottom edge — impossible
  // if the popup were clipped by the 120px-tall overflow:hidden wrapper.
  const lastOption = options(page).last()
  await expect(lastOption).toBeVisible()
  const lastBox = await lastOption.boundingBox()
  expect(lastBox).not.toBeNull()
  if (lastBox && hostBox) {
    expect(lastBox.y).toBeGreaterThan(hostBox.y + hostBox.height)
  }

  // The WHOLE popup is within the viewport on every edge (top, bottom, left,
  // right) — fully visible, not merely un-clipped vertically.
  const popup = page.locator('[class*="pop"]').filter({ has: page.getByRole('listbox') })
  const popupBox = await popup.boundingBox()
  const viewport = page.viewportSize()
  expect(popupBox).not.toBeNull()
  expect(viewport).not.toBeNull()
  if (popupBox && viewport) {
    expect(popupBox.x).toBeGreaterThanOrEqual(0)
    expect(popupBox.y).toBeGreaterThanOrEqual(0)
    expect(popupBox.x + popupBox.width).toBeLessThanOrEqual(viewport.width)
    expect(popupBox.y + popupBox.height).toBeLessThanOrEqual(viewport.height)
  }
})

test('with a 50+50 payload the list is height-bounded and internally scrollable (AC 6)', async ({
  page,
}) => {
  await mockGithub(page, 'big')
  await page.goto('/?clip=1')

  const input = githubCombobox(page)
  await input.click()
  await input.fill('react')

  // Capped at MAX_RESULTS (50) — no pagination controls.
  await expect(options(page)).toHaveCount(50)
  await expect(page.getByRole('button', { name: /next|more|page/i })).toHaveCount(0)

  // The listbox is height-bounded (its content overflows) and scrolls inside.
  const metrics = await listbox(page).evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }))
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight)
})

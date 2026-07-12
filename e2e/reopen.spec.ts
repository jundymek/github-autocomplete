import { expect, test } from '@playwright/test'

import { EXPECTED_SORTED_NAMES } from './fixtures/github'
import { githubCombobox, options, searchAndAwaitResults } from './helpers/autocomplete'
import { mockGithub } from './helpers/mockGithub'

// Story 1.5: reopen-on-focus shows existing results with NO new request. The
// no-refetch guarantee is browser-real and proved far more convincingly by
// counting intercepted requests than by RTL. We count via the route helper.
test('refocus reopens the same results and fires no new GitHub request (AC 10)', async ({
  page,
}) => {
  const mock = await mockGithub(page, 'small')
  await page.goto('/')

  await searchAndAwaitResults(page)
  const input = githubCombobox(page)

  // One qualifying query fired exactly two requests (users + repos).
  const afterSearch = mock.count()
  expect(afterSearch).toBe(2)

  // Close with Escape (query retained), then blur so refocus is a real event.
  await input.press('Escape')
  await expect(input).toHaveAttribute('aria-expanded', 'false')
  await input.blur()

  // Refocus reopens the SAME options...
  await input.focus()
  await expect(input).toHaveAttribute('aria-expanded', 'true')
  await expect(options(page)).toHaveCount(EXPECTED_SORTED_NAMES.length)

  // ...and fired no new request across the close→refocus cycle.
  expect(mock.count()).toBe(afterSearch)

  // Story 3.9: keyboard reopen. Escape keeps focus on the input, so no focus
  // event can ever reopen — ArrowDown must. Same listbox, zero new requests.
  await input.press('Escape')
  await expect(input).toHaveAttribute('aria-expanded', 'false')

  await input.press('ArrowDown')
  await expect(input).toHaveAttribute('aria-expanded', 'true')
  await expect(options(page)).toHaveCount(EXPECTED_SORTED_NAMES.length)
  // APG: ArrowDown reopens with the first option highlighted.
  await expect(options(page).first()).toHaveAttribute('aria-selected', 'true')
  expect(mock.count()).toBe(afterSearch)
})

test('focusing a fresh, never-searched input opens nothing (AC 10)', async ({ page }) => {
  const mock = await mockGithub(page, 'small')
  await page.goto('/')

  const input = githubCombobox(page)
  await input.focus()

  await expect(input).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  expect(mock.count()).toBe(0)
})

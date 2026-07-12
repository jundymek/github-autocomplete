import { expect, test } from '@playwright/test'

import {
  EXPECTED_SORTED_NAMES,
  FIRST_OPTION_URL,
  MATCHES_PROFILE_HINT,
  ORG_LOGIN,
  PROFILE_MATCH_LOGIN,
  SECOND_OPTION_URL,
  SMALL_QUERY,
} from './fixtures/github'
import { githubCombobox, listbox, options, searchAndAwaitResults } from './helpers/autocomplete'
import { mockGithub } from './helpers/mockGithub'

// Browser-real search → sort → new-tab opening, plus the Story 1.6 user
// match-context rendering. Logic (debounce/threshold/cancellation) is NOT
// re-tested here — it lives in the Vitest/RTL layer (kept thin, SM-C1).
test.beforeEach(async ({ context, page }) => {
  // Never hit the real network: the search endpoints are mocked, and any
  // new-tab navigation to an item's html_url is stubbed so the assertion reads
  // the requested URL without loading (or being redirected by) github.com.
  await context.route(/^https:\/\/github\.com\//, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>stub</title>' }),
  )
  await mockGithub(page, 'small')
  await page.goto('/')
})

test('typed query renders mocked users + repos merged in A→Z order (AC 2)', async ({ page }) => {
  await searchAndAwaitResults(page)

  const rows = options(page)
  await expect(rows).toHaveCount(EXPECTED_SORTED_NAMES.length)
  for (let i = 0; i < EXPECTED_SORTED_NAMES.length; i++) {
    await expect(rows.nth(i)).toContainText(EXPECTED_SORTED_NAMES[i])
  }
})

test('ArrowDown×2 + Enter opens a new tab with the highlighted URL; demo keeps state (AC 3)', async ({
  page,
  context,
}) => {
  await searchAndAwaitResults(page)
  const input = githubCombobox(page)

  await input.press('ArrowDown')
  await input.press('ArrowDown')

  const [popup] = await Promise.all([context.waitForEvent('page'), input.press('Enter')])
  await popup.waitForLoadState('domcontentloaded')
  expect(popup.url()).toBe(SECOND_OPTION_URL)

  // Host page is not navigated and keeps its query.
  expect(page.url()).toBe(new URL('/', page.url()).toString())
  await expect(input).toHaveValue('react')

  // Accept collapses the combobox (Story 3.7): the popup is not left expanded
  // behind the new tab.
  await expect(input).toHaveAttribute('aria-expanded', 'false')
  await expect(listbox(page)).toHaveCount(0)
})

test('mouse click opens the same URL identically (AC 3)', async ({ page, context }) => {
  await searchAndAwaitResults(page)

  // First option is the profile-match user (gaearon).
  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    options(page).first().click(),
  ])
  await popup.waitForLoadState('domcontentloaded')
  expect(popup.url()).toBe(FIRST_OPTION_URL)

  // Click accept collapses the combobox too (Story 3.7).
  await expect(githubCombobox(page)).toHaveAttribute('aria-expanded', 'false')
  await expect(listbox(page)).toHaveCount(0)
})

test('user rows reveal match context; organizations are labeled org (AC 11)', async ({ page }) => {
  await searchAndAwaitResults(page)

  // A user matched only via profile (its login has no "react") surfaces the
  // match reason as secondary text — the "matches profile" hint — AND, because
  // the query is not in the visible login, that row carries NO <mark>.
  const profileRow = options(page).filter({ hasText: PROFILE_MATCH_LOGIN })
  await expect(profileRow).toContainText(MATCHES_PROFILE_HINT)
  await expect(profileRow.locator('mark')).toHaveCount(0)

  // The organization row reads "org" in the KIND column (not "user") and, since
  // its login DOES contain the query, echoes it as a highlighted <mark> tied to
  // that row — proving the highlight tracks the actual match, not any row.
  const orgRow = options(page).filter({ hasText: ORG_LOGIN })
  await expect(orgRow).toContainText(/org/i)
  await expect(orgRow).not.toContainText(/\buser\b/i)
  await expect(orgRow.locator('mark')).toHaveText(new RegExp(SMALL_QUERY, 'i'))
})

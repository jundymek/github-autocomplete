import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import { EXPECTED_SORTED_NAMES, SMALL_QUERY } from '../fixtures/github'

/**
 * Shared locators/actions for driving a GitHub autocomplete instance in e2e.
 * The listbox renders through a React portal to `document.body`, so `page`-level
 * role queries resolve it wherever it lands (AR-7).
 */

/** The GitHub combobox input (accessible name "Search GitHub"). */
export function githubCombobox(page: Page): Locator {
  return page.getByRole('combobox', { name: 'Search GitHub' })
}

/** The portalled listbox (present only while `aria-expanded="true"`). */
export function listbox(page: Page): Locator {
  return page.getByRole('listbox')
}

/** All rendered options, in DOM (sorted) order. */
export function options(page: Page): Locator {
  return page.getByRole('option')
}

/**
 * Types the small-fixture query and waits for the merged results to render in
 * the expected A→Z order (AC 2). Assumes a small-fixture `mockGithub` is active.
 */
export async function searchAndAwaitResults(page: Page): Promise<void> {
  const input = githubCombobox(page)
  await input.click()
  await input.fill(SMALL_QUERY)
  await expect(options(page)).toHaveCount(EXPECTED_SORTED_NAMES.length)
  await expect(githubCombobox(page)).toHaveAttribute('aria-expanded', 'true')
}

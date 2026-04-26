import { test, expect } from '@playwright/test'
import { ALL_POSTS, SHOPIFY_POST, EMPTY_POST, LOCKED_POST, CONFLICT_POST } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.route('/api/posts', route =>
    route.fulfill({ json: ALL_POSTS }),
  )
})

test('grid renders a cell for each post', async ({ page }) => {
  await page.goto('/grid')
  // 5 posts → 5 cells (aspect-[4/5] divs inside the grid)
  const cells = page.locator('[class*="aspect-\\[4\\/5\\]"]')
  await expect(cells).toHaveCount(ALL_POSTS.length)
})

test('empty cell shows "leeg" label', async ({ page }) => {
  await page.goto('/grid')
  await expect(page.getByText('leeg')).toBeVisible()
})

test('draft post shows "concept" badge', async ({ page }) => {
  await page.goto('/grid')
  const badges = page.getByText('concept')
  await expect(badges.first()).toBeVisible()
})

test('locked post shows lock icon', async ({ page }) => {
  await page.goto('/grid')
  await expect(page.getByText('🔒')).toBeVisible()
})

test('locked post shows scheduled date', async ({ page }) => {
  await page.goto('/grid')
  // scheduledAt is 2026-05-01T10:00:00.000Z
  // nl-NL format: "do 1 mei 10:00" (or similar)
  const dateText = page.locator('text=/mei/i')
  await expect(dateText.first()).toBeVisible()
})

test('conflict post shows "!" badge', async ({ page }) => {
  await page.goto('/grid')
  await expect(page.getByText('!')).toBeVisible()
})

test('tapping a draft post navigates to editor', async ({ page }) => {
  await page.route(`/api/posts/${SHOPIFY_POST.id}`, route =>
    route.fulfill({ json: SHOPIFY_POST }),
  )
  await page.goto('/grid')

  // Click the first draft (concept badge)
  await page.getByText('concept').first().click()
  await expect(page).toHaveURL(new RegExp(`/grid/${SHOPIFY_POST.id}`))
})

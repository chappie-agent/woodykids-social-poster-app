import { test, expect, Page } from '@playwright/test'

const FUTURE = '2031-01-01T10:00:00Z'

async function mockApi(page: Page) {
  let dbHasPost = true

  await page.route('**/api/posts', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(dbHasPost ? [{
        id: 'planned-1', state: 'locked', position: null,
        source: { kind: 'shopify', productId: 'p1', productTitle: 'Test', images: ['https://x/y.jpg', 'https://x/z.jpg'], selectedImageIndices: [1] },
        cropData: { x:0, y:0, scale:1 },
        caption: { opener:{variants:['o'],selected:0}, middle:{variants:['m'],selected:0}, closer:{variants:['c'],selected:0}, hashtags: [] },
        scheduledAt: FUTURE, isPerson: false, zernioPostId: 'z-1',
      }] : []),
    })
  })

  await page.route('**/api/posts/planned-1/unlock', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    dbHasPost = false
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'planned-1', state: 'locked', position: null,
        source: { kind: 'shopify', productId: 'p1', productTitle: 'Test', images: ['https://x/y.jpg', 'https://x/z.jpg'], selectedImageIndices: [1] },
        cropData: { x:0, y:0, scale:1 },
        caption: { opener:{variants:['o'],selected:0}, middle:{variants:['m'],selected:0}, closer:{variants:['c'],selected:0}, hashtags: [] },
        scheduledAt: null, isPerson: false,
      }),
    })
  })
}

test('unlock een planned post — wordt concept zonder scheduledAt', async ({ page }) => {
  await mockApi(page)
  await page.goto('/grid')

  // Klik unlock op de planned tegel
  await page.locator('[data-cell-id="planned-1"] >> button[aria-label="Unlock om te editen"]').click()

  // Toast + de cel mag nu een concept-badge tonen
  await expect(page.locator('text=Unlocked').first()).toBeVisible({ timeout: 5_000 })
  await expect(page.locator('[data-cell-id="planned-1"] >> text=concept')).toBeVisible()
})

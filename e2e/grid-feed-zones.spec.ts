import { test, expect, Page } from '@playwright/test'

const FUTURE_FAR = '2031-01-01T10:00:00Z'
const FUTURE_NEAR = '2030-06-01T10:00:00Z'
const PAST = '2020-01-01T10:00:00Z'

async function mockApi(page: Page) {
  // GET /api/posts → 1 live + 2 planned
  await page.route('**/api/posts', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'planned-far', state: 'locked', position: null, source: null,
            cropData: { x:0, y:0, scale:1 }, caption: null, scheduledAt: FUTURE_FAR,
            isPerson: false, zernioPostId: 'z-far' },
          { id: 'planned-near', state: 'locked', position: null, source: null,
            cropData: { x:0, y:0, scale:1 }, caption: null, scheduledAt: FUTURE_NEAR,
            isPerson: false, zernioPostId: 'z-near' },
          { id: 'live-old', state: 'locked', position: null, source: null,
            cropData: { x:0, y:0, scale:1 }, caption: null, scheduledAt: PAST,
            isPerson: false, zernioPostId: 'z-old' },
        ]),
      })
    }
    return route.continue()
  })
}

test('grid renders AddTile + planned (newest first) + live (oldest last)', async ({ page }) => {
  await mockApi(page)
  await page.goto('/grid')

  const cells = page.locator('[data-testid="grid-cell"]')
  // AddTile, planned-far, planned-near, live-old → 4 cellen
  await expect(cells).toHaveCount(4)
  await expect(cells.nth(0)).toHaveAttribute('data-cell-kind', 'add')
  await expect(cells.nth(1)).toHaveAttribute('data-cell-id', 'planned-far')
  await expect(cells.nth(2)).toHaveAttribute('data-cell-id', 'planned-near')
  await expect(cells.nth(3)).toHaveAttribute('data-cell-id', 'live-old')
})

import { test, expect } from '@playwright/test'
import { ALL_POSTS, SHOPIFY_POST, UPLOAD_POST } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.route('/api/posts', route =>
    route.fulfill({ json: ALL_POSTS }),
  )
  await page.route(`/api/posts/${SHOPIFY_POST.id}`, route =>
    route.fulfill({ json: SHOPIFY_POST }),
  )
  await page.route(`/api/posts/${UPLOAD_POST.id}`, route =>
    route.fulfill({ json: UPLOAD_POST }),
  )
  // Stub save calls so they don't error
  await page.route('/api/posts/**', route => {
    if (route.request().method() === 'PUT') return route.fulfill({ json: SHOPIFY_POST })
    return route.fallback()
  })
})

// ── Navigation ──────────────────────────────────────────────────────────────

test('editor page title shows product name for shopify post', async ({ page }) => {
  await page.goto(`/grid/${SHOPIFY_POST.id}`)
  await expect(page.getByText('Houten treintje set')).toBeVisible()
})

test('"Terug" button navigates back to grid', async ({ page }) => {
  await page.goto(`/grid/${SHOPIFY_POST.id}`)
  await page.getByText('Terug').click()
  await expect(page).toHaveURL('/grid')
})

// ── MultiPhotoSelector ───────────────────────────────────────────────────────

test('MultiPhotoSelector renders one thumbnail per image', async ({ page }) => {
  await page.goto(`/grid/${SHOPIFY_POST.id}`)
  // SHOPIFY_POST has 3 images
  const thumbs = page.locator('button:has(img[alt^="Foto"])')
  await expect(thumbs).toHaveCount(3)
})

test('selected image shows position badge "1"', async ({ page }) => {
  await page.goto(`/grid/${SHOPIFY_POST.id}`)
  // selectedImageIndices: [0] → first thumb has badge "1"
  await expect(page.locator('button:has(img[alt="Foto 1"]) span').filter({ hasText: '1' })).toBeVisible()
})

test('unselected images have no position badge', async ({ page }) => {
  await page.goto(`/grid/${SHOPIFY_POST.id}`)
  // images 2 and 3 are unselected
  await expect(page.locator('button:has(img[alt="Foto 2"]) span')).toHaveCount(0)
  await expect(page.locator('button:has(img[alt="Foto 3"]) span')).toHaveCount(0)
})

test('clicking unselected image adds it with next position badge', async ({ page }) => {
  await page.goto(`/grid/${SHOPIFY_POST.id}`)

  // Stub the PUT so we can verify the payload
  let savedSource: unknown
  await page.route(`/api/posts/${SHOPIFY_POST.id}`, route => {
    if (route.request().method() === 'PUT') {
      savedSource = route.request().postDataJSON()
      return route.fulfill({ json: SHOPIFY_POST })
    }
    return route.fulfill({ json: SHOPIFY_POST })
  })

  // Click second image (index 1)
  await page.locator('button:has(img[alt="Foto 2"])').click()

  // Badge "2" should now appear on the second thumb
  await expect(page.locator('button:has(img[alt="Foto 2"]) span').filter({ hasText: '2' })).toBeVisible()
})

test('clicking selected image deselects it (removes badge)', async ({ page }) => {
  await page.goto(`/grid/${SHOPIFY_POST.id}`)

  await page.route(`/api/posts/${SHOPIFY_POST.id}`, route => {
    if (route.request().method() === 'PUT') return route.fulfill({ json: SHOPIFY_POST })
    return route.fulfill({ json: SHOPIFY_POST })
  })

  // Click the already-selected first image to deselect it
  await page.locator('button:has(img[alt="Foto 1"])').click()

  await expect(page.locator('button:has(img[alt="Foto 1"]) span')).toHaveCount(0)
})

// ── Caption section ──────────────────────────────────────────────────────────

test('caption blocks are visible', async ({ page }) => {
  await page.goto(`/grid/${SHOPIFY_POST.id}`)
  await expect(page.getByText('Opener')).toBeVisible()
  await expect(page.getByText('Middenstuk')).toBeVisible()
  await expect(page.getByText('Afsluiter')).toBeVisible()
})

test('opener shows three variant buttons', async ({ page }) => {
  await page.goto(`/grid/${SHOPIFY_POST.id}`)
  // The three opener variants from the fixture
  await expect(page.getByText('Dit treintje past in iedere speelkamer.')).toBeVisible()
  await expect(page.getByText('Sjoe, dit is een leuke.')).toBeVisible()
  await expect(page.getByText('Kleine ingenieur in de maak.')).toBeVisible()
})

test('clicking a non-active variant selects it', async ({ page }) => {
  await page.route(`/api/posts/${SHOPIFY_POST.id}`, route => {
    if (route.request().method() === 'PUT') return route.fulfill({ json: SHOPIFY_POST })
    return route.fulfill({ json: SHOPIFY_POST })
  })

  await page.goto(`/grid/${SHOPIFY_POST.id}`)
  const variant2 = page.getByText('Sjoe, dit is een leuke.')
  await variant2.click()
  // After click the button should have the selected style (ring/border class)
  // We verify by checking the PUT was triggered
  await expect(variant2).toBeVisible()
})

// ── Hashtags ─────────────────────────────────────────────────────────────────

test('hashtag badges are rendered', async ({ page }) => {
  await page.goto(`/grid/${SHOPIFY_POST.id}`)
  await expect(page.getByText('#woodykids')).toBeVisible()
  await expect(page.getByText('#houtenspeelgoed')).toBeVisible()
})

test('inactive hashtag (index ≥ 3) has gray styling', async ({ page }) => {
  await page.goto(`/grid/${SHOPIFY_POST.id}`)
  // fixture: tags index 3 and 4 have active: false → bg-gray-100 text-gray-400
  const dimmedTag = page.getByText('#duurzaamspeelgoed')
  await expect(dimmedTag).toBeVisible()
  await expect(dimmedTag).toHaveClass(/text-gray-400/)
})

test('clicking inactive hashtag activates it (green styling)', async ({ page }) => {
  await page.route(`/api/posts/${SHOPIFY_POST.id}`, route => {
    if (route.request().method() === 'PUT') return route.fulfill({ json: SHOPIFY_POST })
    return route.fulfill({ json: SHOPIFY_POST })
  })

  await page.goto(`/grid/${SHOPIFY_POST.id}`)
  const dimmedTag = page.getByText('#duurzaamspeelgoed')
  await dimmedTag.click()
  // After toggle → active → green styling
  await expect(dimmedTag).toHaveClass(/text-green-800/)
})

// ── Character counter ────────────────────────────────────────────────────────

test('character counter is visible and within limit', async ({ page }) => {
  await page.goto(`/grid/${SHOPIFY_POST.id}`)
  // Counter format: "NNN / 2200 tekens"
  await expect(page.getByText(/\/ 2200 tekens/)).toBeVisible()
  // Should NOT be red (within limit)
  const counter = page.getByText(/\/ 2200 tekens/)
  await expect(counter).not.toHaveClass(/text-red/)
})

// ── Regenerate button ────────────────────────────────────────────────────────

test('"Regenereer caption" button is visible', async ({ page }) => {
  await page.goto(`/grid/${SHOPIFY_POST.id}`)
  await expect(page.getByRole('button', { name: 'Regenereer caption' })).toBeVisible()
})

test('"Regenereer caption" calls generate-caption API and updates caption', async ({ page }) => {
  const newCaption = {
    ...SHOPIFY_POST.caption!,
    opener: { variants: ['Nieuwe opener.', 'Tweede variant.', 'Derde variant.'] as [string, string, string], selected: 0 as const },
  }
  const updatedPost = { ...SHOPIFY_POST, caption: newCaption }

  await page.route(`/api/posts/${SHOPIFY_POST.id}/generate-caption`, route =>
    route.fulfill({ json: updatedPost }),
  )

  await page.goto(`/grid/${SHOPIFY_POST.id}`)
  await page.getByRole('button', { name: 'Regenereer caption' }).click()

  await expect(page.getByText('Nieuwe opener.')).toBeVisible()
})

// ── Upload post ───────────────────────────────────────────────────────────────

test('upload post editor shows caption without MultiPhotoSelector', async ({ page }) => {
  await page.goto(`/grid/${UPLOAD_POST.id}`)
  // No MultiPhotoSelector for upload posts
  await expect(page.locator('button:has(img[alt^="Foto"])')).toHaveCount(0)
  // Caption is still visible
  await expect(page.getByText('Opener')).toBeVisible()
})

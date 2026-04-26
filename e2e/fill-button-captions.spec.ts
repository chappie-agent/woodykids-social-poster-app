/**
 * E2E test: FillButton genereert captions op de achtergrond na het aanvullen van posts
 */

import { test, expect } from '@playwright/test'
import { ALL_POSTS, EMPTY_POST, SHOPIFY_POST } from './fixtures'

const NEW_POST_FROM_GENERATE = {
  id: EMPTY_POST.id,
  state: 'draft' as const,
  position: EMPTY_POST.position,
  isPerson: false,
  source: {
    kind: 'shopify' as const,
    productId: 'prod-new-1',
    productTitle: 'Nieuw product',
    images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600'],
    selectedImageIndices: [0],
  },
  cropData: { x: 0, y: 0, scale: 1 },
  caption: null,
  scheduledAt: null,
}

const GENERATED_CAPTION = {
  opener: { variants: ['FillButton opener.', 'Variant 2.', 'Variant 3.'] as [string, string, string], selected: 0 as const },
  middle: { variants: ['FillButton middenstuk.', 'Variant 2.', 'Variant 3.'] as [string, string, string], selected: 0 as const },
  closer: { variants: ['FillButton afsluiter.', 'Variant 2.', 'Variant 3.'] as [string, string, string], selected: 0 as const },
  hashtags: [{ text: '#woodykids', active: true }],
}

test('FillButton genereert captions op de achtergrond na aanvullen', async ({ page }) => {
  // Begin met 1 lege post en 4 drafts/locked — FillButton is zichtbaar
  const postsWithEmpty = ALL_POSTS // bevat EMPTY_POST

  await page.route('/api/posts', route => route.fulfill({ json: postsWithEmpty }))

  // generate route geeft 1 nieuwe post zonder caption terug
  await page.route('/api/posts/generate', route =>
    route.fulfill({ json: [NEW_POST_FROM_GENERATE] })
  )

  // PUT om post op te slaan
  await page.route(`/api/posts/${EMPTY_POST.id}`, route => {
    if (route.request().method() === 'PUT') {
      return route.fulfill({ json: { ...NEW_POST_FROM_GENERATE, state: 'draft' } })
    }
    return route.fulfill({ json: { ...NEW_POST_FROM_GENERATE, caption: GENERATED_CAPTION } })
  })

  // generate-caption — verifieer dat hij aangeroepen wordt
  let captionGenerated = false
  let captionSource: unknown = null
  await page.route(`/api/posts/${EMPTY_POST.id}/generate-caption`, async route => {
    captionGenerated = true
    captionSource = (route.request().postDataJSON() as Record<string, unknown>)?.source
    await route.fulfill({ json: { ...NEW_POST_FROM_GENERATE, caption: GENERATED_CAPTION } })
  })

  await page.goto('/grid')
  await page.waitForSelector('text=concept', { timeout: 8000 })

  // Klik FillButton
  await page.getByRole('button', { name: /Vul aan/ }).click()

  // Wacht tot toast verschijnt
  await expect(page.getByText(/posts gegenereerd/)).toBeVisible({ timeout: 10_000 })

  // Geef achtergrond request tijd
  await page.waitForTimeout(2000)

  // Verifieer dat generate-caption automatisch is aangeroepen
  expect(captionGenerated).toBe(true)
  expect((captionSource as Record<string, unknown>)?.kind).toBe('shopify')

  // Open de editor — caption moet al klaar zijn
  await page.getByRole('button', { name: /Nieuw product/ }).first().click()
  await page.waitForURL(`**/grid/${EMPTY_POST.id}`, { timeout: 8000 })

  await expect(page.getByText('FillButton opener.')).toBeVisible({ timeout: 8000 })
  await expect(page.getByText('FillButton middenstuk.')).toBeVisible()
})

/**
 * E2E test: captions worden automatisch op de achtergrond gegenereerd
 * wanneer de grid laadt, zodat ze al klaar zijn als de editor opent.
 */

import { test, expect } from '@playwright/test'
import { ALL_POSTS, SHOPIFY_POST } from './fixtures'

const GENERATED_CAPTION = {
  opener: { variants: ['Achtergrond opener.', 'Variant 2.', 'Variant 3.'] as [string, string, string], selected: 0 as const },
  middle: { variants: ['Achtergrond middenstuk.', 'Variant 2.', 'Variant 3.'] as [string, string, string], selected: 0 as const },
  closer: { variants: ['Achtergrond afsluiter.', 'Variant 2.', 'Variant 3.'] as [string, string, string], selected: 0 as const },
  hashtags: [
    { text: '#woodykids', active: true },
    { text: '#houtenspeelgoed', active: true },
    { text: '#naturelspelen', active: true },
    { text: '#duurzaamspeelgoed', active: false },
    { text: '#kidstoys', active: false },
  ],
}

test('caption wordt automatisch gegenereerd op de achtergrond bij laden grid', async ({ page }) => {
  // Post zonder caption
  const postWithoutCaption = { ...SHOPIFY_POST, caption: null }
  const allPostsWithoutCaption = [postWithoutCaption, ...ALL_POSTS.slice(1)]

  await page.route('/api/posts', route => route.fulfill({ json: allPostsWithoutCaption }))
  await page.route(`/api/posts/${SHOPIFY_POST.id}`, route =>
    route.fulfill({ json: { ...SHOPIFY_POST, caption: GENERATED_CAPTION } })
  )

  // Leg bij welke requests generate-caption wordt aangeroepen
  let generateCaptionCalled = false
  let receivedSource: unknown = null
  await page.route(`/api/posts/${SHOPIFY_POST.id}/generate-caption`, async route => {
    generateCaptionCalled = true
    receivedSource = (route.request().postDataJSON() as Record<string, unknown>)?.source
    await route.fulfill({ json: { ...SHOPIFY_POST, caption: GENERATED_CAPTION } })
  })

  // Navigeer naar grid — dit triggert de achtergrond generatie
  await page.goto('/grid')
  await page.waitForSelector('text=concept', { timeout: 8000 })

  // Wacht tot generate-caption in de achtergrond is aangeroepen
  await page.waitForFunction(() => (window as Window & { __captionGenerated?: boolean }).__captionGenerated === true, {}, { timeout: 10_000 }).catch(() => {})

  // Genoeg tijd geven voor de achtergrond request
  await page.waitForTimeout(3000)

  // Verifieer dat generate-caption automatisch is aangeroepen
  expect(generateCaptionCalled).toBe(true)
  expect((receivedSource as Record<string, unknown>)?.kind).toBe('shopify')

  // Open de editor — caption moet er al zijn (geen "Regenereer" nodig)
  await page.getByRole('button', { name: /Houten treintje set/ }).first().click()
  await page.waitForURL(`**/grid/${SHOPIFY_POST.id}`, { timeout: 8000 })

  await expect(page.getByText('Achtergrond opener.')).toBeVisible({ timeout: 8000 })
  await expect(page.getByText('Achtergrond middenstuk.')).toBeVisible()
  await expect(page.getByText('Achtergrond afsluiter.')).toBeVisible()
})

test('posts met al een caption worden niet opnieuw gegenereerd', async ({ page }) => {
  // Alle posts hebben al een caption
  await page.route('/api/posts', route => route.fulfill({ json: ALL_POSTS }))

  let generateCaptionCallCount = 0
  await page.route('**/generate-caption', async route => {
    generateCaptionCallCount++
    await route.fulfill({ json: { caption: GENERATED_CAPTION } })
  })

  await page.goto('/grid')
  await page.waitForSelector('text=concept', { timeout: 8000 })
  await page.waitForTimeout(2000)

  // Geen enkele generate-caption call verwacht
  expect(generateCaptionCallCount).toBe(0)
})

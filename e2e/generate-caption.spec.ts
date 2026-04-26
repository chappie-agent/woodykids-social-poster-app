/**
 * E2E test: "Regenereer caption" knop werkt ook als de post alleen in de Zustand store zit
 * (niet in Supabase) — de source wordt meegestuurd in de request body.
 */

import { test, expect } from '@playwright/test'
import { ALL_POSTS, SHOPIFY_POST } from './fixtures'

const GENERATED_CAPTION = {
  opener: { variants: ['Echte Claude opener.', 'Tweede variant.', 'Derde variant.'] as [string, string, string], selected: 0 as const },
  middle: { variants: ['Middenstuk van Claude.', 'Variant 2.', 'Variant 3.'] as [string, string, string], selected: 0 as const },
  closer: { variants: ['Afsluiter van Claude.', 'Variant 2.', 'Variant 3.'] as [string, string, string], selected: 0 as const },
  hashtags: [
    { text: '#woodykids', active: true },
    { text: '#houtenspeelgoed', active: true },
    { text: '#naturelspelen', active: true },
    { text: '#duurzaamspeelgoed', active: false },
    { text: '#kidstoys', active: false },
  ],
}

test.beforeEach(async ({ page }) => {
  await page.route('/api/posts', route => route.fulfill({ json: ALL_POSTS }))
  await page.route(`/api/posts/${SHOPIFY_POST.id}`, route => route.fulfill({ json: SHOPIFY_POST }))
  await page.route('/api/posts/**', route => {
    if (route.request().method() === 'PUT') return route.fulfill({ json: SHOPIFY_POST })
    return route.fallback()
  })
})

test('generate-caption stuurt source mee en toont echte caption', async ({ page }) => {
  // Intercept generate-caption en verifieer dat source wordt meegestuurd
  let receivedBody: Record<string, unknown> = {}
  await page.route(`/api/posts/${SHOPIFY_POST.id}/generate-caption`, async route => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    receivedBody = body
    await route.fulfill({
      json: { ...SHOPIFY_POST, caption: GENERATED_CAPTION },
    })
  })

  // Navigeer naar editor via grid (vult Zustand store)
  await page.goto('/grid')
  await page.waitForSelector('text=concept', { timeout: 8000 })
  await page.getByRole('button', { name: /Houten treintje set/ }).first().click()
  await page.waitForURL(`**/grid/${SHOPIFY_POST.id}`, { timeout: 8000 })

  // Klik "Regenereer caption"
  await page.getByRole('button', { name: 'Regenereer caption' }).click()

  // Wacht op echte caption tekst
  await expect(page.getByText('Echte Claude opener.')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Middenstuk van Claude.')).toBeVisible()
  await expect(page.getByText('Afsluiter van Claude.')).toBeVisible()

  // Verifieer dat source werd meegestuurd in de request
  expect(receivedBody).toHaveProperty('source')
  expect((receivedBody.source as Record<string, unknown>).kind).toBe('shopify')
})

test('generate-caption werkt ook als post geen caption heeft (null)', async ({ page }) => {
  const postWithoutCaption = { ...SHOPIFY_POST, caption: null }
  const postWithCaption = { ...SHOPIFY_POST, caption: GENERATED_CAPTION }

  await page.route('/api/posts', route => route.fulfill({ json: [postWithoutCaption, ...ALL_POSTS.slice(1)] }))

  // Polling stopt zodra GET een caption teruggeeft
  await page.route(`/api/posts/${SHOPIFY_POST.id}`, route => route.fulfill({ json: postWithCaption }))

  await page.route(`/api/posts/${SHOPIFY_POST.id}/generate-caption`, route =>
    route.fulfill({ json: postWithCaption })
  )

  await page.goto('/grid')
  await page.waitForSelector('text=concept', { timeout: 8000 })
  await page.getByRole('button', { name: /Houten treintje set/ }).first().click()
  await page.waitForURL(`**/grid/${SHOPIFY_POST.id}`, { timeout: 8000 })

  // Polling pikt de caption op via GET — wacht tot caption zichtbaar is
  await expect(page.getByText('Echte Claude opener.')).toBeVisible({ timeout: 10_000 })
})

test('generate-caption toont foutmelding als API mislukt', async ({ page }) => {
  await page.route(`/api/posts/${SHOPIFY_POST.id}/generate-caption`, route =>
    route.fulfill({ status: 500, json: { error: 'AI generatie mislukt' } })
  )

  await page.goto('/grid')
  await page.waitForSelector('text=concept', { timeout: 8000 })
  await page.getByRole('button', { name: /Houten treintje set/ }).first().click()
  await page.waitForURL(`**/grid/${SHOPIFY_POST.id}`, { timeout: 8000 })

  await page.getByRole('button', { name: 'Regenereer caption' }).click()

  await expect(page.getByText('Caption generatie mislukt. Probeer opnieuw.')).toBeVisible({ timeout: 5000 })
})

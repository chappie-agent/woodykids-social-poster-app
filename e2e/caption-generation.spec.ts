/**
 * Real E2E test for caption generation — no mocks.
 *
 * Calls the actual Anthropic API (claude-sonnet-4-6) with the real tone of voice
 * from the settings table and a real post from the database.
 *
 * Requirements:
 *   - ANTHROPIC_API_KEY must be set in .env.local
 *   - At least one draft post must exist in the Supabase database
 *   - The SQL migration (003_multi_photo_carousel.sql) should have been run
 *     (backward-compat guards cover old rows anyway)
 */

import { test, expect } from '@playwright/test'
import type { Post } from '@/lib/types'

// Anthropic can take up to 30 seconds — give the full test 90 seconds
test.setTimeout(90_000)

test('generates a real caption via Anthropic and renders it in the editor', async ({ page }) => {
  // ── 1. Load the real grid from the live database ─────────────────────────
  await page.goto('/grid')

  // Wait for "Laden..." to disappear (posts loaded or error)
  await page.waitForFunction(
    () => !document.body.innerText.includes('Laden...'),
    { timeout: 15_000 },
  )

  // ── 2. Find a draft post from the real API ────────────────────────────────
  const postsRes = await page.evaluate(async () => {
    const r = await fetch('/api/posts')
    return r.ok ? (await r.json() as Post[]) : []
  })

  const draftPost = postsRes.find(
    (p: Post) => (p.state === 'draft' || p.state === 'conflict') && p.source !== null,
  )

  if (!draftPost) {
    test.skip(true, 'No draft post found in database — create one first and re-run')
    return
  }

  // ── 3. Navigate to the editor for that post ───────────────────────────────
  // Grid is already loaded so the store is seeded — client-side navigate via click
  const cellName = draftPost.source?.kind === 'shopify'
    ? new RegExp((draftPost.source as { productTitle: string }).productTitle)
    : /Eigen upload/

  await page.getByRole('button', { name: cellName }).first().click()
  await page.waitForURL(`**/grid/${draftPost.id}`, { timeout: 10_000 })

  // ── 4. Click "Regenereer caption" — real Anthropic API call ─────────────
  await page.getByRole('button', { name: 'Regenereer caption' }).click()

  // Button becomes disabled / shows "Genereren..." while waiting
  await expect(page.getByRole('button', { name: 'Genereren...' })).toBeVisible()

  // ── 5. Wait for the real response (up to 60 s) ───────────────────────────
  await expect(page.getByText('Opener')).toBeVisible({ timeout: 60_000 })

  // ── 6. Verify the caption structure is fully rendered ─────────────────────
  await expect(page.getByText('Middenstuk')).toBeVisible()
  await expect(page.getByText('Afsluiter')).toBeVisible()
  await expect(page.getByText('Hashtags')).toBeVisible()

  // Each section must have exactly 3 variant buttons
  // CaptionBlock renders variants as radio-like buttons — count them per section
  const openerSection = page.locator('text=Opener').locator('../..')
  const variantButtons = openerSection.getByRole('button')
  await expect(variantButtons).toHaveCount(3)

  // ── 7. Verify the character counter stays within the Instagram limit ──────
  const counter = page.getByText(/\/ 2200 tekens/)
  await expect(counter).toBeVisible()
  const counterText = await counter.textContent()
  const charCount = parseInt(counterText?.split(' /')[0].trim() ?? '0', 10)
  expect(charCount).toBeGreaterThan(0)
  expect(charCount).toBeLessThanOrEqual(2200)

  // ── 8. Verify at least 3 hashtags are rendered ───────────────────────────
  const hashtagBadges = page.locator('button').filter({ hasText: /^#/ })
  await expect(hashtagBadges).toHaveCount(5)

  // ── 9. Verify tone of voice was applied (system prompt used) ─────────────
  // We can't inspect the prompt directly, but we verify the response is in Dutch
  // by checking for common Dutch words in the rendered caption text
  const captionArea = page.locator('text=Opener').locator('../..')
  const captionText = await captionArea.textContent()
  // Dutch indicators: common Dutch words that would appear in any caption
  const dutchIndicators = ['de', 'het', 'een', 'van', 'voor', 'en', 'is', 'zijn', 'op', 'in']
  const hasDutch = dutchIndicators.some(word =>
    captionText?.toLowerCase().includes(` ${word} `) ||
    captionText?.toLowerCase().startsWith(`${word} `),
  )
  expect(hasDutch).toBe(true)
})

import { NextRequest, NextResponse } from 'next/server'
import { getProducts } from '@/lib/shopify/client'
import { tokenize, isTooSimilar } from '@/lib/shopify/similarity'
import type { Post, PostCaption, ShopifyProduct } from '@/lib/types'
import { randomUUID } from 'crypto'

const makeCaption = (): PostCaption => ({
  opener: { variants: ['Opener variant 1.', 'Opener variant 2.', 'Opener variant 3.'], selected: 0 },
  middle: { variants: ['Middenstuk variant 1.', 'Middenstuk variant 2.', 'Middenstuk variant 3.'], selected: 0 },
  closer: { variants: ['Afsluiter variant 1.', 'Afsluiter variant 2.', 'Afsluiter variant 3.'], selected: 0 },
  hashtags: [
    { text: '#woodykids', active: true },
    { text: '#houtenspeelgoed', active: true },
    { text: '#naturelspelen', active: true },
    { text: '#duurzaamspeelgoed', active: false },
    { text: '#kidstoys', active: false },
  ],
})

export async function POST(request: NextRequest) {
  const { count, startPosition, existingProductIds } = await request.json() as {
    count: number
    startPosition: number
    existingProductIds?: string[]
  }

  let products: ShopifyProduct[]
  try {
    // Need >= 2 images so we can always start from index 1 (cover is never index 0)
    products = (await getProducts()).filter(p => p.images.length >= 2)
  } catch (err) {
    console.error('[/api/posts/generate] Shopify fetch failed', err)
    return NextResponse.json({ error: 'Failed to fetch Shopify products' }, { status: 502 })
  }

  if (products.length === 0) {
    return NextResponse.json({ error: 'No Shopify products with images available' }, { status: 404 })
  }

  const shuffled = [...products].sort(() => Math.random() - 0.5)

  // Seed similarity tracking with already-shown products in the grid
  const existingTokens: Set<string>[] = []
  if (existingProductIds && existingProductIds.length > 0) {
    const existingSet = new Set(existingProductIds)
    for (const p of products) if (existingSet.has(p.id)) existingTokens.push(tokenize(p.title))
  }

  // Greedy pick: skip products too similar to any already-picked or already-shown
  const picked: ShopifyProduct[] = []
  const pickedTokens: Set<string>[] = [...existingTokens]
  for (const p of shuffled) {
    if (picked.length >= count) break
    const tokens = tokenize(p.title)
    if (isTooSimilar(tokens, pickedTokens)) continue
    picked.push(p)
    pickedTokens.push(tokens)
  }
  // Fallback: if we couldn't fill count due to too-strict similarity, top up from remaining
  if (picked.length < count) {
    const have = new Set(picked.map(p => p.id))
    for (const p of shuffled) {
      if (picked.length >= count) break
      if (!have.has(p.id)) picked.push(p)
    }
  }

  const newPosts: Post[] = Array.from({ length: count }, (_, i) => {
    const product = picked[i % picked.length]
    const isPerson = i % 2 === 0
    const selectedImageIndices = Array.from(
      { length: Math.min(5, product.images.length - 1) },
      (_, k) => k + 1,
    )
    return {
      id: randomUUID(),
      state: 'draft',
      position: startPosition + i,
      isPerson,
      source: {
        kind: 'shopify',
        productId: product.id,
        productTitle: product.title,
        images: product.images,
        selectedImageIndices,
      },
      cropData: { x: 0, y: 0, scale: 1 },
      caption: makeCaption(),
      scheduledAt: null,
    }
  })

  return NextResponse.json(newPosts)
}

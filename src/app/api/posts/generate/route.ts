import { NextRequest, NextResponse } from 'next/server'
import { getProducts } from '@/lib/shopify/client'
import { tokenize, isTooSimilar } from '@/lib/shopify/similarity'
import type { Post, ShopifyProduct } from '@/lib/types'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  const { count, existingProductIds } = await request.json() as {
    count: number
    existingProductIds?: string[]
  }

  let products: ShopifyProduct[]
  try {
    products = (await getProducts()).filter(p => p.images.length >= 2)
  } catch (err) {
    console.error('[/api/posts/generate] Shopify fetch failed', err)
    return NextResponse.json({ error: 'Failed to fetch Shopify products' }, { status: 502 })
  }

  if (products.length === 0) {
    return NextResponse.json({ error: 'No Shopify products with images available' }, { status: 404 })
  }

  const shuffled = [...products].sort(() => Math.random() - 0.5)

  const existingTokens: Set<string>[] = []
  if (existingProductIds && existingProductIds.length > 0) {
    const existingSet = new Set(existingProductIds)
    for (const p of products) if (existingSet.has(p.id)) existingTokens.push(tokenize(p.title))
  }

  const picked: ShopifyProduct[] = []
  const pickedTokens: Set<string>[] = [...existingTokens]
  for (const p of shuffled) {
    if (picked.length >= count) break
    const tokens = tokenize(p.title)
    if (isTooSimilar(tokens, pickedTokens)) continue
    picked.push(p)
    pickedTokens.push(tokens)
  }
  if (picked.length < count) {
    const have = new Set(picked.map(p => p.id))
    for (const p of shuffled) {
      if (picked.length >= count) break
      if (!have.has(p.id)) picked.push(p)
    }
  }

  // Concepten: geen state, geen position — leven puur in de browser-store.
  const newPosts: Post[] = Array.from({ length: count }, (_, i) => {
    const product = picked[i % picked.length]
    const isPerson = i % 2 === 0
    const selectedImageIndices = Array.from(
      { length: Math.min(5, product.images.length - 1) },
      (_, k) => k + 1,
    )
    return {
      id: randomUUID(),
      state: 'locked', // Niet relevant voor concepten; UI toont op basis van scheduledAt=null.
      position: null,
      isPerson,
      source: {
        kind: 'shopify',
        productId: product.id,
        productTitle: product.title,
        images: product.images,
        selectedImageIndices,
      },
      cropData: { x: 0, y: 0, scale: 1 },
      caption: null,
      scheduledAt: null,
    }
  })

  return NextResponse.json(newPosts)
}

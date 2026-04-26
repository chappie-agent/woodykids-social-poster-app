import { NextRequest, NextResponse } from 'next/server'
import { getProducts } from '@/lib/shopify/client'
import { tokenize, isTooSimilar } from '@/lib/shopify/similarity'
import type { Post, PostCaption, ShopifyProduct } from '@/lib/types'

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
  const { id, position, excludeProductIds, isPerson } = await request.json() as {
    id: string
    position: number
    excludeProductIds: string[]
    isPerson?: boolean
  }

  let products: ShopifyProduct[]
  try {
    // Need >= 2 images so cover is never index 0
    products = (await getProducts()).filter(p => p.images.length >= 2)
  } catch (err) {
    console.error('[/api/posts/repick] Shopify fetch failed', err)
    return NextResponse.json({ error: 'Failed to fetch Shopify products' }, { status: 502 })
  }

  const exclude = new Set(excludeProductIds ?? [])
  const existingTokens = products
    .filter(p => exclude.has(p.id))
    .map(p => tokenize(p.title))

  const eligible = products.filter(p => !exclude.has(p.id))
  if (eligible.length === 0) {
    return NextResponse.json({ error: 'No alternative products available' }, { status: 404 })
  }

  // Prefer non-similar; if none qualify, fall back to any non-excluded product
  const dissimilar = eligible.filter(p => !isTooSimilar(tokenize(p.title), existingTokens))
  const candidates = dissimilar.length > 0 ? dissimilar : eligible

  const product = candidates[Math.floor(Math.random() * candidates.length)]
  const selectedImageIndices = Array.from(
    { length: Math.min(5, product.images.length - 1) },
    (_, k) => k + 1,
  )

  const post: Post = {
    id,
    state: 'draft',
    position,
    isPerson: Boolean(isPerson),
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

  return NextResponse.json(post)
}

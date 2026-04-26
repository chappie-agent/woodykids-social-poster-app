import { NextRequest, NextResponse } from 'next/server'
import { getProducts } from '@/lib/shopify/client'
import type { Post, PostCaption } from '@/lib/types'
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
  const { count, startPosition } = await request.json() as { count: number; startPosition: number }

  let products
  try {
    products = (await getProducts()).filter(p => p.images.length > 0)
  } catch (err) {
    console.error('[/api/posts/generate] Shopify fetch failed', err)
    return NextResponse.json({ error: 'Failed to fetch Shopify products' }, { status: 502 })
  }

  if (products.length === 0) {
    return NextResponse.json({ error: 'No Shopify products with images available' }, { status: 404 })
  }

  const pool = [...products].sort(() => Math.random() - 0.5)

  const newPosts: Post[] = Array.from({ length: count }, (_, i) => {
    const product = pool[i % pool.length]
    const isPerson = i % 2 === 0
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
        selectedImageIndices: [Math.min(1, product.images.length - 1)],
      },
      cropData: { x: 0, y: 0, scale: 1 },
      caption: makeCaption(),
      scheduledAt: null,
    }
  })

  return NextResponse.json(newPosts)
}

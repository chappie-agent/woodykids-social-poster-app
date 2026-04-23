import { NextRequest, NextResponse } from 'next/server'
import { fakeProducts } from '@/lib/fixtures/products'
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

  const newPosts: Post[] = Array.from({ length: count }, (_, i) => {
    const product = fakeProducts[i % fakeProducts.length]
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
        selectedImageIndex: Math.min(1, product.images.length - 1),
      },
      cropData: { x: 0, y: 0, scale: 1 },
      caption: makeCaption(),
      scheduledAt: null,
    }
  })

  return NextResponse.json(newPosts)
}

import { NextRequest, NextResponse } from 'next/server'
import { fakeProducts } from '@/lib/fixtures/products'
import type { Post } from '@/lib/types'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  const { productId, position } = await request.json() as { productId: string; position: number }
  const product = fakeProducts.find(p => p.id === productId) ?? fakeProducts[0]

  const post: Post = {
    id: randomUUID(),
    state: 'draft',
    position,
    isPerson: false,
    source: {
      kind: 'shopify',
      productId: product.id,
      productTitle: product.title,
      images: product.images,
      selectedImageIndex: Math.min(1, product.images.length - 1),
    },
    cropData: { x: 0, y: 0, scale: 1 },
    caption: null,
    scheduledAt: null,
  }

  return NextResponse.json(post)
}

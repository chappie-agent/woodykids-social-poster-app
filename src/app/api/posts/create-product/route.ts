// src/app/api/posts/create-product/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProducts } from '@/lib/shopify/client'
import type { Post, PostState, PostSource, CropData, PostCaption, PostSourceShopify } from '@/lib/types'

function mapPost(row: Record<string, unknown>): Post {
  return {
    id: row.id as string,
    state: row.state as PostState,
    position: row.position as number,
    source: (row.source as PostSource) ?? null,
    cropData: (row.crop_data as CropData) ?? { x: 0, y: 0, scale: 1 },
    caption: (row.caption as PostCaption) ?? null,
    scheduledAt: (row.scheduled_at as string) ?? null,
    isPerson: Boolean(row.is_person),
  }
}

export async function POST(request: NextRequest) {
  const { productId, position } = await request.json() as { productId: string; position: number }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const products = await getProducts()
  const product = products.find(p => p.id === productId)
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const source: PostSourceShopify = {
    kind: 'shopify',
    productId: product.id,
    productTitle: product.title,
    images: product.images,
    variants: product.variants,
    selectedImageIndices: [1],
  }

  const { data, error } = await supabase
    .from('posts')
    .update({
      state: 'draft',
      source,
      crop_data: { x: 0, y: 0, scale: 1 },
      caption: null,
      scheduled_at: null,
      is_person: false,
      created_by: user?.id ?? null,
    })
    .eq('position', position)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(mapPost(data))
}

import { NextResponse } from 'next/server'
import { getProducts } from '@/lib/shopify/client'
import { requireUser } from '@/lib/supabase/require-user'

export async function GET() {
  const { response } = await requireUser()
  if (response) return response

  try {
    const products = await getProducts()
    return NextResponse.json(products)
  } catch (err) {
    console.error('[/api/products]', err)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

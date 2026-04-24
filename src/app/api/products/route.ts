import { NextResponse } from 'next/server'
import { getProducts } from '@/lib/shopify/client'

export async function GET() {
  try {
    const products = await getProducts()
    return NextResponse.json(products)
  } catch (err) {
    console.error('[/api/products]', err)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

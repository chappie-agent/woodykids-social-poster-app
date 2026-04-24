import { NextResponse } from 'next/server'
import { getProducts } from '@/lib/shopify/client'

export async function GET() {
  const products = await getProducts()
  return NextResponse.json(products)
}

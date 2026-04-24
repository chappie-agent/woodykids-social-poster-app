import { NextResponse } from 'next/server'
import { getCollections } from '@/lib/shopify/client'

export async function GET() {
  const collections = await getCollections()
  return NextResponse.json(collections)
}

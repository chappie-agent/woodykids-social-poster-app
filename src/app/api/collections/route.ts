import { NextResponse } from 'next/server'
import { getCollections } from '@/lib/shopify/client'

export async function GET() {
  try {
    const collections = await getCollections()
    return NextResponse.json(collections)
  } catch (err) {
    console.error('[/api/collections]', err)
    return NextResponse.json({ error: 'Failed to fetch collections' }, { status: 500 })
  }
}

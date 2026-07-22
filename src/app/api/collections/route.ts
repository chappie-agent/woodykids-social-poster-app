import { NextResponse } from 'next/server'
import { getCollections } from '@/lib/shopify/client'
import { requireUser } from '@/lib/supabase/require-user'

export async function GET() {
  const { response } = await requireUser()
  if (response) return response

  try {
    const collections = await getCollections()
    return NextResponse.json(collections)
  } catch (err) {
    console.error('[/api/collections]', err)
    return NextResponse.json({ error: 'Failed to fetch collections' }, { status: 500 })
  }
}

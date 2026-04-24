// src/app/api/grid/order/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(request: NextRequest) {
  const { ids } = await request.json() as { ids: string[] }
  const supabase = await createClient()

  const results = await Promise.all(
    ids.map((id, position) =>
      supabase.from('posts').update({ position }).eq('id', id)
    )
  )

  const failed = results.find(r => r.error)
  if (failed) return NextResponse.json({ error: failed.error!.message }, { status: 500 })
  return NextResponse.json({ saved: true })
}

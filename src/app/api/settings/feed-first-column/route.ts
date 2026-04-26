// src/app/api/settings/feed-first-column/route.ts
//
// Bepaalt op welke kolom (1, 2 of 3) de nieuwste post in de grid begint.
// Wordt gebruikt om de feed visueel uit te lijnen met je echte
// Instagram-account zodat de bottom-rij overeenkomt qua positie.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED = [1, 2, 3] as const

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('settings')
    .select('feed_first_post_column')
    .eq('id', 1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ column: data?.feed_first_post_column ?? 2 })
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { column?: number }
  const col = body.column
  if (typeof col !== 'number' || !ALLOWED.includes(col as typeof ALLOWED[number])) {
    return NextResponse.json({ error: 'column moet 1, 2 of 3 zijn' }, { status: 400 })
  }

  const supabase = await createClient()
  // Default-rij wordt door migratie gegarandeerd. Plain UPDATE volstaat.
  const { error } = await supabase
    .from('settings')
    .update({ feed_first_post_column: col, updated_at: new Date().toISOString() })
    .eq('id', 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ column: col })
}

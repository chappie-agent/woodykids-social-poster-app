// src/app/api/settings/tone-of-voice/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('settings')
    .select('tone_of_voice')
    .eq('id', 1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Geen rij → leeg veld; UI laat user gewoon iets typen + opslaan.
  return NextResponse.json({ content: data?.tone_of_voice ?? '' })
}

export async function PUT(request: NextRequest) {
  const { content } = await request.json() as { content: string }
  const supabase = await createClient()

  // Upsert zodat de eerste save ook werkt als er nog geen rij is.
  const { error } = await supabase
    .from('settings')
    .upsert(
      { id: 1, tone_of_voice: content, updated_at: new Date().toISOString() },
      { onConflict: 'id' },
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ content })
}

// src/app/api/settings/tone-of-voice/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('settings')
    .select('tone_of_voice')
    .eq('id', 1)
    .single()

  if (error) return NextResponse.json({ content: '' })
  return NextResponse.json({ content: data.tone_of_voice })
}

export async function PUT(request: NextRequest) {
  const { content } = await request.json() as { content: string }
  const supabase = await createClient()

  const { error } = await supabase
    .from('settings')
    .update({ tone_of_voice: content, updated_at: new Date().toISOString() })
    .eq('id', 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ content })
}

import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { defaultToneOfVoice } from '@/lib/fixtures/settings'

// In-memory for MVP; real implementation reads/writes Supabase DB
let current = defaultToneOfVoice.content

export async function GET() {
  return NextResponse.json({ content: current })
}

export async function PUT(request: NextRequest) {
  const { content } = await request.json() as { content: string }
  current = content
  return NextResponse.json({ content })
}

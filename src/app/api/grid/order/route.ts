import { NextRequest, NextResponse } from 'next/server'

export async function PUT(request: NextRequest) {
  const { ids } = await request.json() as { ids: string[] }
  // Real implementation: update positions in Supabase DB
  console.log('[stub] Grid order saved:', ids)
  return NextResponse.json({ saved: true })
}

import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  // Real implementation: upload to Supabase Storage, return public URL
  // MVP: return a placeholder URL
  const mediaUrl = `https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600`
  console.log(`[stub] Media upload for post ${id}`)
  return NextResponse.json({ mediaUrl })
}

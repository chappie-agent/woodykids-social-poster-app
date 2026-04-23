import { NextRequest, NextResponse } from 'next/server'
import type { Post } from '@/lib/types'

// In MVP: acknowledge the update and echo back the patch.
// Real implementation: update Supabase DB.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const patch = await request.json() as Partial<Post>
  return NextResponse.json({ id, ...patch })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return NextResponse.json({ deleted: id })
}

// src/app/api/posts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Post, PostState, PostSource, CropData, PostCaption } from '@/lib/types'

function mapPost(row: Record<string, unknown>): Post {
  return {
    id: row.id as string,
    state: row.state as PostState,
    position: row.position as number,
    source: (row.source as PostSource) ?? null,
    cropData: (row.crop_data as CropData) ?? { x: 0, y: 0, scale: 1 },
    caption: (row.caption as PostCaption) ?? null,
    scheduledAt: (row.scheduled_at as string) ?? null,
    isPerson: Boolean(row.is_person),
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const patch = await request.json() as Partial<Post>
  const supabase = await createClient()

  const dbPatch: Record<string, unknown> = {}
  if (patch.state !== undefined) dbPatch.state = patch.state
  if (patch.position !== undefined) dbPatch.position = patch.position
  if (patch.source !== undefined) dbPatch.source = patch.source
  if (patch.cropData !== undefined) dbPatch.crop_data = patch.cropData
  if (patch.caption !== undefined) dbPatch.caption = patch.caption
  if (patch.scheduledAt !== undefined) dbPatch.scheduled_at = patch.scheduledAt
  if (patch.isPerson !== undefined) dbPatch.is_person = patch.isPerson

  const { data, error } = await supabase
    .from('posts')
    .update(dbPatch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(mapPost(data))
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { error } = await supabase.from('posts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: id })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Post, PostState, PostSource, CropData, PostCaption, PostSourceUpload } from '@/lib/types'

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

export async function POST(request: NextRequest) {
  const { mediaUrl, mediaType, userPrompt, position } = await request.json() as {
    mediaUrl: string
    mediaType: 'image' | 'video'
    userPrompt: string
    position: number
  }

  if (!['image', 'video'].includes(mediaType)) {
    return NextResponse.json({ error: 'Invalid mediaType' }, { status: 400 })
  }

  const source: PostSourceUpload = { kind: 'upload', mediaUrl, mediaType, userPrompt }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('posts')
    .update({
      state: 'draft',
      source,
      crop_data: { x: 0, y: 0, scale: 1 },
      caption: null,
      scheduled_at: null,
      is_person: false,
      created_by: user?.id ?? null,
    })
    .eq('position', position)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(mapPost(data))
}

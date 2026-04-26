import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scheduleZernioPost } from '@/lib/zernio/client'
import { assembleCaption } from '@/lib/zernio/format'
import type { Post, PostState, PostSource, CropData, PostCaption } from '@/lib/types'

type PublishBody = {
  scheduledAt: string
  post?: Post
}

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  let body: PublishBody
  try {
    body = await request.json() as PublishBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { scheduledAt, post: clientPost } = body

  if (!scheduledAt || isNaN(Date.parse(scheduledAt))) {
    return NextResponse.json({ error: 'Ongeldige scheduledAt waarde' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: postRows, error: postError } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)

  if (postError) return NextResponse.json({ error: postError.message }, { status: 500 })
  let postRow = postRows?.[0]

  // Posts are created client-side by /api/posts/generate and only persisted on publish.
  // If the row isn't in the DB yet, insert it from the client-supplied snapshot.
  if (!postRow) {
    if (!clientPost) {
      return NextResponse.json({ error: 'Post not found or access denied' }, { status: 404 })
    }
    const insertRow = {
      id,
      state: clientPost.state,
      position: clientPost.position,
      source: clientPost.source,
      crop_data: clientPost.cropData,
      caption: clientPost.caption,
      scheduled_at: clientPost.scheduledAt,
      is_person: clientPost.isPerson,
    }
    const { data: inserted, error: insertError } = await supabase
      .from('posts')
      .insert(insertRow)
      .select()
    if (insertError) {
      console.error('[publish] Insert error:', insertError.message)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
    if (!inserted || inserted.length === 0) {
      return NextResponse.json({ error: 'Post kon niet worden opgeslagen' }, { status: 500 })
    }
    postRow = inserted[0]
  }

  const caption = postRow.caption as PostCaption | null
  if (!caption) {
    return NextResponse.json({ error: 'Geen caption beschikbaar' }, { status: 400 })
  }

  const source = postRow.source as PostSource | null
  let mediaUrls: string[] | undefined
  if (source?.kind === 'shopify') {
    const legacyIndex = (source as unknown as { selectedImageIndex?: number }).selectedImageIndex
    const indices = source.selectedImageIndices ?? (legacyIndex !== undefined ? [legacyIndex] : [0])
    const urls = indices.map(i => source.images[i]).filter((url): url is string => typeof url === 'string')
    if (urls.length) mediaUrls = urls
  } else if (source?.kind === 'upload') {
    const legacyUrl = (source as unknown as { mediaUrl?: string }).mediaUrl
    const urls = source.mediaUrls ?? (legacyUrl ? [legacyUrl] : [])
    if (urls.length) mediaUrls = urls
  }

  const content = assembleCaption(caption)

  try {
    await scheduleZernioPost({ content, scheduledFor: scheduledAt, mediaUrls })
  } catch (err) {
    console.error('[publish] Zernio error:', err)
    return NextResponse.json({ error: 'Inplannen bij Zernio mislukt' }, { status: 500 })
  }

  const { data, error: updateError } = await supabase
    .from('posts')
    .update({ state: 'locked', scheduled_at: scheduledAt })
    .eq('id', id)
    .select()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Post not found or access denied' }, { status: 404 })
  }
  return NextResponse.json(mapPost(data[0]))
}

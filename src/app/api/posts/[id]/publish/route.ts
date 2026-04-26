import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scheduleZernioPost } from '@/lib/zernio/client'
import { assembleCaption } from '@/lib/zernio/format'
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  let scheduledAt: string
  try {
    const body = await request.json() as { scheduledAt: string }
    scheduledAt = body.scheduledAt
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!scheduledAt || isNaN(Date.parse(scheduledAt))) {
    return NextResponse.json({ error: 'Ongeldige scheduledAt waarde' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: postRow, error: postError } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .single()

  if (postError) return NextResponse.json({ error: postError.message }, { status: 500 })

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
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json(mapPost(data))
}

// src/app/api/posts/[id]/unlock/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cancelZernioPost } from '@/lib/zernio/client'
import type { Post, PostState, PostSource, CropData, PostCaption } from '@/lib/types'

function mapPost(row: Record<string, unknown>): Post {
  return {
    id: row.id as string,
    state: row.state as PostState,
    position: (row.position as number | null) ?? null,
    source: (row.source as PostSource) ?? null,
    cropData: (row.crop_data as CropData) ?? { x: 0, y: 0, scale: 1 },
    caption: (row.caption as PostCaption) ?? null,
    scheduledAt: (row.scheduled_at as string) ?? null,
    isPerson: Boolean(row.is_person),
    zernioPostId: (row.zernio_post_id as string) ?? undefined,
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: rows, error: fetchError } = await supabase.from('posts').select('*').eq('id', id)
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!rows || rows.length === 0) return NextResponse.json({ error: 'Post niet gevonden' }, { status: 404 })

  const row = rows[0]
  const scheduledAt = row.scheduled_at as string | null
  if (scheduledAt && Date.parse(scheduledAt) < Date.now()) {
    return NextResponse.json({ error: 'Live posts kun je niet unlocken' }, { status: 409 })
  }

  const zernioPostId = row.zernio_post_id as string | null
  if (zernioPostId) {
    try {
      await cancelZernioPost(zernioPostId)
    } catch (err) {
      console.error('[unlock] Zernio cancel error:', err)
      return NextResponse.json({ error: 'Zernio cancel mislukt — DB ongewijzigd' }, { status: 502 })
    }
  }

  const post = mapPost(row)
  // Snapshot teruggeven zodat de client 'm als concept in de store kan zetten.
  const concept: Post = { ...post, scheduledAt: null, zernioPostId: undefined }

  const { error: deleteError } = await supabase.from('posts').delete().eq('id', id)
  if (deleteError) {
    console.error('[unlock] DB delete error:', deleteError.message)
    return NextResponse.json({ error: 'DB delete mislukt — Zernio is wel gecanceld' }, { status: 500 })
  }

  return NextResponse.json(concept)
}

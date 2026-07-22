import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scheduleZernioPost } from '@/lib/zernio/client'
import { assembleCaption } from '@/lib/zernio/format'
import { cropImageFromUrl } from '@/lib/image/crop'
import type { Post, PostState, PostSource, CropData, PostCaption } from '@/lib/types'

const PUBLISH_MEDIA_BUCKET = 'post-media'

type PublishBody = {
  scheduledAt: string
  post: Post
}

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
  if (!clientPost) {
    return NextResponse.json({ error: 'Post snapshot ontbreekt' }, { status: 400 })
  }
  if (!clientPost.caption) {
    return NextResponse.json({ error: 'Geen caption beschikbaar' }, { status: 400 })
  }

  // Bouw originele media-URLs op uit de client-snapshot.
  const source = clientPost.source
  let originalMediaUrls: string[] = []
  if (source?.kind === 'shopify') {
    const indices = source.selectedImageIndices ?? [0]
    originalMediaUrls = indices.map(i => source.images[i]).filter((url): url is string => typeof url === 'string')
  } else if (source?.kind === 'upload') {
    originalMediaUrls = source.mediaUrls?.filter(Boolean) ?? []
  }

  const content = assembleCaption(clientPost.caption)
  const supabase = await createClient()

  // 1. Crop alle images naar 4:5 (Instagram-vereiste) en upload naar Supabase
  //    storage — Zernio krijgt vervolgens publieke URLs van de gecropte versies.
  let mediaUrls: string[] | undefined
  if (originalMediaUrls.length > 0) {
    try {
      const cropped = await Promise.all(
        originalMediaUrls.map(async (originalUrl, idx) => {
          const buffer = await cropImageFromUrl(originalUrl, clientPost.cropData)
          const path = `cropped/${id}/${Date.now()}-${idx}.jpg`
          const { error: uploadErr } = await supabase.storage
            .from(PUBLISH_MEDIA_BUCKET)
            .upload(path, buffer, { contentType: 'image/jpeg', upsert: true })
          if (uploadErr) throw new Error(`Upload gecropte image: ${uploadErr.message}`)
          return supabase.storage.from(PUBLISH_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl
        }),
      )
      mediaUrls = cropped
    } catch (err) {
      console.error('[publish] Image crop/upload error:', err)
      const msg = err instanceof Error ? err.message : 'Onbekende fout'
      return NextResponse.json({ error: `Foto's voorbereiden mislukt: ${msg}` }, { status: 500 })
    }
  }

  // 2. Zernio met de gecropte URLs — als dit faalt komt er niks in de DB.
  let zernioPostId: string
  try {
    zernioPostId = await scheduleZernioPost({ content, scheduledFor: scheduledAt, mediaUrls })
  } catch (err) {
    console.error('[publish] Zernio error:', err)
    // Probeer Zernio's eigen error-bericht door te geven (bevat vaak nuttige
    // info zoals aspect-ratio of caption-length issues uit Instagram).
    let userMessage = 'Inplannen bij Zernio mislukt'
    if (err instanceof Error) {
      const match = err.message.match(/Zernio \d+: (\{.*\})/)
      if (match) {
        try {
          const parsed = JSON.parse(match[1]) as { error?: string }
          if (parsed.error) userMessage = parsed.error
        } catch {/* fall through */}
      }
    }
    return NextResponse.json({ error: userMessage }, { status: 500 })
  }

  // 3. Pas bij Zernio-success: INSERT in Supabase met state='locked'.
  const insertRow = {
    id,
    state: 'locked' as const,
    position: null,
    source: clientPost.source,
    crop_data: clientPost.cropData,
    caption: clientPost.caption,
    scheduled_at: scheduledAt,
    is_person: clientPost.isPerson,
    zernio_post_id: zernioPostId,
  }

  const { data, error } = await supabase.from('posts').insert(insertRow).select()
  if (error) {
    // Best effort: rollback Zernio. We loggen de fout maar geven 'm niet door — quota verspilling
    // is erger dan een verloren error message.
    console.error('[publish] Supabase insert error:', error.message)
    return NextResponse.json({ error: 'Opslaan in DB mislukt — Zernio post is wel ingepland' }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Post kon niet worden opgeslagen' }, { status: 500 })
  }

  return NextResponse.json(mapPost(data[0]))
}

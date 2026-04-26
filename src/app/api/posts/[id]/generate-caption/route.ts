// src/app/api/posts/[id]/generate-caption/route.ts
import { NextRequest, NextResponse } from 'next/server'
import type Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAnthropicClient } from '@/lib/anthropic/client'
import { buildSystemPrompt, buildUserContent, buildUploadUserContent, parseCaptionResponse } from '@/lib/anthropic/caption'
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
  const supabase = await createClient()

  // Client kan de source meesturen — dan hoeven we de DB niet te raadplegen
  const body = await request.json().catch(() => ({})) as { source?: PostSource }
  let source: PostSource | null = body.source ?? null

  // Haal post op uit DB als source niet meegestuurd is
  if (!source) {
    const { data: postRows, error: postError } = await supabase
      .from('posts')
      .select('source')
      .eq('id', id)

    if (postError) {
      console.error('[generate-caption] Post fetch error:', postError.message)
      return NextResponse.json({ error: postError.message }, { status: 500 })
    }
    if (!postRows || postRows.length === 0) {
      return NextResponse.json({ error: 'Post not found or access denied' }, { status: 404 })
    }
    source = postRows[0].source as PostSource | null
  }

  if (!source || (source.kind !== 'shopify' && source.kind !== 'upload')) {
    return NextResponse.json({ error: 'Unsupported post source' }, { status: 400 })
  }

  // Haal tone of voice op
  const { data: settingsRows } = await supabase
    .from('settings')
    .select('tone_of_voice')
    .eq('id', 1)
  const toneOfVoice = settingsRows?.[0]?.tone_of_voice ?? ''

  // Roep Claude aan
  let responseText: string
  try {
    const anthropic = createAnthropicClient()
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: buildSystemPrompt(toneOfVoice),
      messages: [
        {
          role: 'user',
          content: (source.kind === 'shopify'
            ? buildUserContent(source)
            : buildUploadUserContent(source)
          ) as Anthropic.ContentBlockParam[],
        },
      ],
    })
    const block = response.content[0]
    if (block.type !== 'text') {
      console.warn('[generate-caption] Unexpected non-text block from Claude:', block.type)
    }
    responseText = block.type === 'text' ? block.text : ''
  } catch (err) {
    console.error('[generate-caption] Anthropic error:', err)
    return NextResponse.json({ error: 'AI generatie mislukt' }, { status: 500 })
  }

  // Parseer caption
  let caption: PostCaption
  try {
    caption = parseCaptionResponse(responseText)
  } catch (err) {
    console.error('[generate-caption] Parse error:', err, 'Raw:', responseText)
    return NextResponse.json({ error: 'Ongeldige AI-response' }, { status: 500 })
  }

  // Sla op in DB — best effort (post hoeft niet in DB te bestaan)
  const { data, error: updateError } = await supabase
    .from('posts')
    .update({ caption })
    .eq('id', id)
    .select()

  if (updateError) {
    console.error('[generate-caption] Update error:', updateError.message)
  }

  // Geef de caption altijd terug, ook als opslaan mislukt
  if (data && data.length > 0) {
    return NextResponse.json(mapPost(data[0]))
  }

  // Post bestaat niet in DB: stuur caption terug zodat de client hem lokaal kan tonen
  return NextResponse.json({ id, caption } as Partial<Post>)
}

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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  // Haal post op
  const { data: postRow, error: postError } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .single()

  if (postError) return NextResponse.json({ error: postError.message }, { status: 500 })

  const source = postRow.source as PostSource | null
  if (!source || (source.kind !== 'shopify' && source.kind !== 'upload')) {
    return NextResponse.json({ error: 'Unsupported post source' }, { status: 400 })
  }

  // Haal tone of voice op
  const { data: settings, error: settingsError } = await supabase
    .from('settings')
    .select('tone_of_voice')
    .eq('id', 1)
    .single()

  if (settingsError) {
    console.warn('[generate-caption] Settings fetch failed, using empty tone:', settingsError.message)
  }
  const toneOfVoice = settings?.tone_of_voice ?? ''

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

  // Parseer en sla op
  let caption: PostCaption
  try {
    caption = parseCaptionResponse(responseText)
  } catch (err) {
    console.error('[generate-caption] Parse error:', err, 'Raw:', responseText)
    return NextResponse.json({ error: 'Ongeldige AI-response' }, { status: 500 })
  }

  const { data, error: updateError } = await supabase
    .from('posts')
    .update({ caption })
    .eq('id', id)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json(mapPost(data))
}

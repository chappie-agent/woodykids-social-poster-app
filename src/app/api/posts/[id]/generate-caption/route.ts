// src/app/api/posts/[id]/generate-caption/route.ts
import { NextRequest, NextResponse } from 'next/server'
import type Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAnthropicClient } from '@/lib/anthropic/client'
import { buildSystemPrompt, buildUserContent, buildUploadUserContent, parseCaptionResponse } from '@/lib/anthropic/caption'
import type { PostSource, PostCaption } from '@/lib/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const body = await request.json().catch(() => ({})) as { source?: PostSource }
  const source = body.source ?? null

  if (!source || (source.kind !== 'shopify' && source.kind !== 'upload')) {
    return NextResponse.json({ error: 'Source ontbreekt of is ongeldig' }, { status: 400 })
  }

  // Tone of voice ophalen — best effort, leeg bij fout.
  let toneOfVoice = ''
  try {
    const supabase = await createClient()
    const { data } = await supabase.from('settings').select('tone_of_voice').eq('id', 1)
    toneOfVoice = data?.[0]?.tone_of_voice ?? ''
  } catch (err) {
    console.warn('[generate-caption] kon tone of voice niet laden:', err)
  }

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
    responseText = block.type === 'text' ? block.text : ''
  } catch (err) {
    console.error('[generate-caption] Anthropic error:', err)
    return NextResponse.json({ error: 'AI generatie mislukt' }, { status: 500 })
  }

  let caption: PostCaption
  try {
    caption = parseCaptionResponse(responseText)
  } catch (err) {
    console.error('[generate-caption] Parse error:', err, 'Raw:', responseText)
    return NextResponse.json({ error: 'Ongeldige AI-response' }, { status: 500 })
  }

  return NextResponse.json({ id, caption })
}

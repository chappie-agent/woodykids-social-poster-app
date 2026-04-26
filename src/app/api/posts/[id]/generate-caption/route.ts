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
  const buildContent = (withImage: boolean): Anthropic.ContentBlockParam[] => {
    const blocks = source.kind === 'shopify' ? buildUserContent(source) : buildUploadUserContent(source)
    return (withImage ? blocks : blocks.filter(b => b.type !== 'image')) as Anthropic.ContentBlockParam[]
  }
  const callAnthropic = async (withImage: boolean) => {
    const anthropic = createAnthropicClient()
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: buildSystemPrompt(toneOfVoice),
      messages: [{ role: 'user', content: buildContent(withImage) }],
    })
    const block = response.content[0]
    return block.type === 'text' ? block.text : ''
  }

  try {
    try {
      responseText = await callAnthropic(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      // Anthropic kan soms de image-URL niet downloaden (timeout / 4xx). Retry zonder image.
      if (/Unable to download the file|timed out while trying to download/i.test(msg)) {
        console.warn('[generate-caption] image fetch failed, retrying without image:', msg)
        responseText = await callAnthropic(false)
      } else {
        throw err
      }
    }
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

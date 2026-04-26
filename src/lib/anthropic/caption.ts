import type { PostCaption, PostSourceShopify, PostSourceUpload } from '@/lib/types'

type ContentBlock =
  | { type: 'image'; source: { type: 'url'; url: string } }
  | { type: 'text'; text: string }

type ClaudeOutput = {
  opener: { variants: [string, string, string] }
  middle: { variants: [string, string, string] }
  closer: { variants: [string, string, string] }
  hashtags: string[]
}

export function buildSystemPrompt(toneOfVoice: string): string {
  return `Je bent een social media copywriter voor WoodyKids, een Nederlandse kinderspeelgoedwinkel.
Schrijf altijd in het Nederlands.
Houd de totale caption (opener + middenstuk + afsluiter + hashtags samen) onder de 2.200 tekens.
Volg deze richtlijnen strikt op:

${toneOfVoice}

Geef je output ALTIJD als geldig JSON in exact dit formaat, zonder extra tekst:
{"opener":{"variants":["...","...","..."]},"middle":{"variants":["...","...","..."]},"closer":{"variants":["...","...","..."]},"hashtags":["...","...","...","...","..."]}`
}

export function buildUserContent(source: PostSourceShopify): ContentBlock[] {
  const content: ContentBlock[] = []

  const selectedImage = source.images[source.selectedImageIndices[0]] ?? source.images[0]
  if (selectedImage) {
    content.push({
      type: 'image',
      source: { type: 'url', url: selectedImage },
    })
  }

  const variantLines = source.variants
    ?.map(v => `${v.title} — €${v.price}`)
    .join(', ')

  content.push({
    type: 'text',
    text: [
      `Product: ${source.productTitle}`,
      variantLines ? `Varianten: ${variantLines}` : null,
      '',
      'Schrijf een Instagram-caption in drie losse secties (opener, middenstuk, afsluiter).',
      'Elke sectie heeft drie varianten die in toon licht van elkaar verschillen.',
      'Genereer ook vijf Nederlandse hashtags.',
    ]
      .filter(line => line !== null)
      .join('\n'),
  })

  return content
}

export function buildUploadUserContent(source: PostSourceUpload): ContentBlock[] {
  const content: ContentBlock[] = []

  if (source.mediaType === 'image') {
    content.push({
      type: 'image',
      source: { type: 'url', url: source.mediaUrls[0] },
    })
  }

  content.push({
    type: 'text',
    text: [
      'Schrijf een Instagram-caption in drie losse secties (opener, middenstuk, afsluiter).',
      'Elke sectie heeft drie varianten die in toon licht van elkaar verschillen.',
      'Genereer ook vijf Nederlandse hashtags.',
      '',
      `Eigen post: ${source.userPrompt}`,
    ].join('\n'),
  })

  return content
}

export function parseCaptionResponse(text: string): PostCaption {
  let parsed: ClaudeOutput
  try {
    parsed = JSON.parse(text) as ClaudeOutput
  } catch {
    throw new Error('Ongeldige JSON')
  }

  if (
    !Array.isArray(parsed.opener?.variants) ||
    !Array.isArray(parsed.middle?.variants) ||
    !Array.isArray(parsed.closer?.variants) ||
    !Array.isArray(parsed.hashtags)
  ) {
    throw new Error('Onverwachte structuur in Claude-response')
  }

  return {
    opener: { variants: parsed.opener.variants, selected: 0 },
    middle: { variants: parsed.middle.variants, selected: 0 },
    closer: { variants: parsed.closer.variants, selected: 0 },
    hashtags: parsed.hashtags.map((tag, i) => ({ text: tag, active: i < 3 })),
  }
}

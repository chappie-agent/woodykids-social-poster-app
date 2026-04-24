import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, buildUserContent, buildUploadUserContent, parseCaptionResponse } from '@/lib/anthropic/caption'
import type { PostSourceShopify, PostSourceUpload } from '@/lib/types'

const shopifySource: PostSourceShopify = {
  kind: 'shopify',
  productId: '1',
  productTitle: 'Houten treintje',
  images: ['https://cdn.shopify.com/img.jpg'],
  variants: [{ id: '1', title: 'Naturel / S', price: '24.95' }],
  selectedImageIndex: 0,
}

const validClaudeJson = JSON.stringify({
  opener: { variants: ['O1', 'O2', 'O3'] },
  middle: { variants: ['M1', 'M2', 'M3'] },
  closer: { variants: ['C1', 'C2', 'C3'] },
  hashtags: ['#hout', '#speelgoed', '#kids', '#natuur', '#woody'],
})

describe('buildSystemPrompt', () => {
  it('bevat de tone of voice letterlijk', () => {
    const prompt = buildSystemPrompt('Spreek als een BFF. Geen em-dashes.')
    expect(prompt).toContain('Spreek als een BFF. Geen em-dashes.')
  })

  it('bevat JSON-formaat instructie met alle velden', () => {
    const prompt = buildSystemPrompt('')
    expect(prompt).toContain('"opener"')
    expect(prompt).toContain('"middle"')
    expect(prompt).toContain('"closer"')
    expect(prompt).toContain('"hashtags"')
  })
})

describe('buildUserContent', () => {
  it('bevat een image block als er een afbeelding is', () => {
    const content = buildUserContent(shopifySource)
    const imageBlock = content.find(b => b.type === 'image')
    expect(imageBlock).toEqual({
      type: 'image',
      source: { type: 'url', url: 'https://cdn.shopify.com/img.jpg' },
    })
  })

  it('bevat productnaam in het tekstblok', () => {
    const content = buildUserContent(shopifySource)
    const textBlock = content.find(b => b.type === 'text') as { type: 'text'; text: string }
    expect(textBlock.text).toContain('Houten treintje')
  })

  it('bevat variantinfo in het tekstblok', () => {
    const content = buildUserContent(shopifySource)
    const textBlock = content.find(b => b.type === 'text') as { type: 'text'; text: string }
    expect(textBlock.text).toContain('Naturel / S')
    expect(textBlock.text).toContain('24.95')
  })

  it('slaat image block over als images leeg is', () => {
    const content = buildUserContent({ ...shopifySource, images: [] })
    expect(content.every(b => b.type !== 'image')).toBe(true)
  })

  it('slaat variantinfo over als variants ontbreekt', () => {
    const content = buildUserContent({ ...shopifySource, variants: undefined })
    const textBlock = content.find(b => b.type === 'text') as { type: 'text'; text: string }
    expect(textBlock.text).not.toContain('Varianten:')
  })
})

describe('parseCaptionResponse', () => {
  it('parsed correcte JSON naar PostCaption', () => {
    const caption = parseCaptionResponse(validClaudeJson)
    expect(caption.opener.variants).toEqual(['O1', 'O2', 'O3'])
    expect(caption.opener.selected).toBe(0)
    expect(caption.middle.variants).toEqual(['M1', 'M2', 'M3'])
    expect(caption.closer.variants).toEqual(['C1', 'C2', 'C3'])
  })

  it('eerste 3 hashtags actief, laatste 2 inactief', () => {
    const caption = parseCaptionResponse(validClaudeJson)
    expect(caption.hashtags).toHaveLength(5)
    expect(caption.hashtags[0]).toEqual({ text: '#hout', active: true })
    expect(caption.hashtags[2]).toEqual({ text: '#kids', active: true })
    expect(caption.hashtags[3]).toEqual({ text: '#natuur', active: false })
    expect(caption.hashtags[4]).toEqual({ text: '#woody', active: false })
  })

  it('geeft fout bij ongeldige JSON', () => {
    expect(() => parseCaptionResponse('dit-is-geen-json')).toThrow('Ongeldige JSON')
  })

  it('geeft fout als opener ontbreekt', () => {
    expect(() => parseCaptionResponse('{"middle":{"variants":["a","b","c"]}}')).toThrow()
  })

  it('geeft fout als hashtags geen array is', () => {
    const bad = JSON.stringify({
      opener: { variants: ['a', 'b', 'c'] },
      middle: { variants: ['a', 'b', 'c'] },
      closer: { variants: ['a', 'b', 'c'] },
      hashtags: 'niet-een-array',
    })
    expect(() => parseCaptionResponse(bad)).toThrow()
  })
})

describe('buildUploadUserContent', () => {
  const imageSource: PostSourceUpload = {
    kind: 'upload',
    mediaUrl: 'https://storage.supabase.co/image.jpg',
    mediaType: 'image',
    userPrompt: 'Pasen sale, 20% korting',
  }

  const videoSource: PostSourceUpload = {
    kind: 'upload',
    mediaUrl: 'https://storage.supabase.co/video.mp4',
    mediaType: 'video',
    userPrompt: 'Zomercollectie 2026',
  }

  it('returns image block + text block for image uploads', () => {
    const blocks = buildUploadUserContent(imageSource)
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toEqual({
      type: 'image',
      source: { type: 'url', url: 'https://storage.supabase.co/image.jpg' },
    })
    expect(blocks[1].type).toBe('text')
  })

  it('includes userPrompt in text block for image uploads', () => {
    const blocks = buildUploadUserContent(imageSource)
    const textBlock = blocks.find(b => b.type === 'text') as { type: 'text'; text: string }
    expect(textBlock.text).toContain('Pasen sale, 20% korting')
  })

  it('returns only a text block for video uploads (no vision)', () => {
    const blocks = buildUploadUserContent(videoSource)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('text')
  })

  it('text block contains caption instruction and hashtag request', () => {
    const blocks = buildUploadUserContent(videoSource)
    const textBlock = blocks[0] as { type: 'text'; text: string }
    expect(textBlock.text).toContain('Instagram-caption')
    expect(textBlock.text).toContain('Nederlandse hashtags')
    expect(textBlock.text).toContain('Zomercollectie 2026')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/anthropic/client', () => ({ createAnthropicClient: vi.fn() }))
vi.mock('@/lib/anthropic/caption', () => ({
  buildSystemPrompt: vi.fn(() => 'system prompt'),
  buildUserContent: vi.fn(() => [{ type: 'text', text: 'shopify content' }]),
  buildUploadUserContent: vi.fn(() => [{ type: 'text', text: 'upload content' }]),
  parseCaptionResponse: vi.fn(() => ({
    opener: { variants: ['A', 'B', 'C'], selected: 0 },
    middle: { variants: ['D', 'E', 'F'], selected: 0 },
    closer: { variants: ['G', 'H', 'I'], selected: 0 },
    hashtags: [
      { text: '#a', active: true }, { text: '#b', active: true }, { text: '#c', active: true },
      { text: '#d', active: false }, { text: '#e', active: false },
    ],
  })),
}))

const mockAnthropicResponse = {
  content: [{ type: 'text', text: '{"opener":{"variants":["A","B","C"]},"middle":{"variants":["D","E","F"]},"closer":{"variants":["G","H","I"]},"hashtags":["#a","#b","#c","#d","#e"]}' }],
}

function makeSupabaseMock(sourceRow: Record<string, unknown>) {
  const updatedRow = { ...sourceRow, caption: { opener: {}, middle: {}, closer: {}, hashtags: [] } }
  let callCount = 0
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount === 1) return { data: sourceRow, error: null }
        if (callCount === 2) return { data: { tone_of_voice: '' }, error: null }
        return { data: updatedRow, error: null }
      }),
    }),
  }
}

function makeRequest() {
  return new NextRequest('http://localhost/api/posts/post-1/generate-caption', { method: 'POST' })
}

describe('POST /api/posts/[id]/generate-caption', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls buildUserContent for shopify posts', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    const { createAnthropicClient } = await import('@/lib/anthropic/client')
    const { buildUserContent, buildUploadUserContent } = await import('@/lib/anthropic/caption')

    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock({
      id: 'post-1', state: 'draft', position: 0, is_person: false, crop_data: { x: 0, y: 0, scale: 1 },
      caption: null, scheduled_at: null,
      source: { kind: 'shopify', productId: 'p1', productTitle: 'Test', images: ['https://img.jpg'], selectedImageIndex: 0 },
    }) as never)
    vi.mocked(createAnthropicClient).mockReturnValue({
      messages: { create: vi.fn().mockResolvedValue(mockAnthropicResponse) },
    } as never)

    const { POST } = await import('../route')
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'post-1' }) })

    expect(res.status).toBe(200)
    expect(vi.mocked(buildUserContent)).toHaveBeenCalled()
    expect(vi.mocked(buildUploadUserContent)).not.toHaveBeenCalled()
  })

  it('calls buildUploadUserContent for upload posts', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    const { createAnthropicClient } = await import('@/lib/anthropic/client')
    const { buildUserContent, buildUploadUserContent } = await import('@/lib/anthropic/caption')

    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock({
      id: 'post-1', state: 'draft', position: 0, is_person: false, crop_data: { x: 0, y: 0, scale: 1 },
      caption: null, scheduled_at: null,
      source: { kind: 'upload', mediaUrl: 'https://storage.supabase.co/img.jpg', mediaType: 'image', userPrompt: 'Pasen' },
    }) as never)
    vi.mocked(createAnthropicClient).mockReturnValue({
      messages: { create: vi.fn().mockResolvedValue(mockAnthropicResponse) },
    } as never)

    const { POST } = await import('../route')
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'post-1' }) })

    expect(res.status).toBe(200)
    expect(vi.mocked(buildUploadUserContent)).toHaveBeenCalled()
    expect(vi.mocked(buildUserContent)).not.toHaveBeenCalled()
  })

  it('returns 400 for unknown source kind', async () => {
    const { createClient } = await import('@/lib/supabase/server')

    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock({
      id: 'post-1', state: 'draft', position: 0, is_person: false, crop_data: { x: 0, y: 0, scale: 1 },
      caption: null, scheduled_at: null,
      source: null,
    }) as never)

    const { POST } = await import('../route')
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'post-1' }) })

    expect(res.status).toBe(400)
  })

  it('returns 400 for non-null unknown source kind', async () => {
    const { createClient } = await import('@/lib/supabase/server')

    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock({
      id: 'post-1', state: 'draft', position: 0, is_person: false, crop_data: { x: 0, y: 0, scale: 1 },
      caption: null, scheduled_at: null,
      source: { kind: 'manual' },
    }) as never)

    const { POST } = await import('../route')
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'post-1' }) })

    expect(res.status).toBe(400)
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

const mockPostRow = {
  id: 'post-1',
  state: 'draft',
  position: 3,
  source: {
    kind: 'upload',
    mediaUrl: 'https://storage.supabase.co/image.jpg',
    mediaType: 'image',
    userPrompt: 'Pasen sale',
  },
  crop_data: { x: 0, y: 0, scale: 1 },
  caption: null,
  scheduled_at: null,
  is_person: false,
}

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/posts/create-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeSupabaseMock(row: Record<string, unknown>, dbError: { message: string } | null = null) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: dbError ? null : row, error: dbError }),
    }),
  }
}

describe('POST /api/posts/create-upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('saves upload post to Supabase and returns mapped post', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock(mockPostRow) as never)

    const { POST } = await import('../route')
    const res = await POST(makeRequest({
      mediaUrl: 'https://storage.supabase.co/image.jpg',
      mediaType: 'image',
      userPrompt: 'Pasen sale',
      position: 3,
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.source.kind).toBe('upload')
    expect(body.source.mediaUrl).toBe('https://storage.supabase.co/image.jpg')
    expect(body.source.mediaType).toBe('image')
    expect(body.source.userPrompt).toBe('Pasen sale')
    expect(body.state).toBe('draft')
    expect(body.caption).toBeNull()
  })

  it('returns 500 when Supabase fails', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock(mockPostRow, { message: 'DB error' }) as never,
    )

    const { POST } = await import('../route')
    const res = await POST(makeRequest({
      mediaUrl: 'https://storage.supabase.co/image.jpg',
      mediaType: 'image',
      userPrompt: 'Pasen sale',
      position: 3,
    }))

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('DB error')
  })
})

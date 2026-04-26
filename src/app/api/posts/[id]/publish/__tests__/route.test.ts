import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/zernio/client', () => ({ scheduleZernioPost: vi.fn() }))
vi.mock('@/lib/zernio/format', () => ({ assembleCaption: vi.fn(() => 'assembled caption') }))

const mockCaption = {
  opener: { variants: ['A', 'B', 'C'], selected: 0 },
  middle: { variants: ['D', 'E', 'F'], selected: 0 },
  closer: { variants: ['G', 'H', 'I'], selected: 0 },
  hashtags: [{ text: '#test', active: true }],
}

const mockPostRow = {
  id: 'post-1',
  state: 'draft',
  position: 0,
  source: {
    kind: 'shopify',
    productId: 'prod-1',
    productTitle: 'Test',
    images: ['https://cdn.shopify.com/image.jpg'],
    selectedImageIndices: [0],
  },
  crop_data: { x: 0, y: 0, scale: 1 },
  caption: mockCaption,
  scheduled_at: null,
  is_person: false,
}

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/posts/post-1/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeSupabaseMock(firstRow: Record<string, unknown>, secondRow: Record<string, unknown>) {
  let callCount = 0
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(async () => {
        callCount++
        return callCount === 1
          ? { data: firstRow, error: null }
          : { data: secondRow, error: null }
      }),
    }),
  }
}

describe('POST /api/posts/[id]/publish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('schedules the post and returns it with state locked', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    const { scheduleZernioPost } = await import('@/lib/zernio/client')

    const updatedRow = { ...mockPostRow, state: 'locked', scheduled_at: '2026-04-24T10:00:00' }
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock(mockPostRow, updatedRow) as never,
    )
    vi.mocked(scheduleZernioPost).mockResolvedValue(undefined)

    const { POST } = await import('../route')
    const res = await POST(
      makeRequest({ scheduledAt: '2026-04-24T10:00:00' }),
      { params: Promise.resolve({ id: 'post-1' }) },
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.state).toBe('locked')
    expect(body.scheduledAt).toBe('2026-04-24T10:00:00')
  })

  it('returns 400 when caption is null', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...mockPostRow, caption: null },
          error: null,
        }),
      }),
    } as never)

    const { POST } = await import('../route')
    const res = await POST(
      makeRequest({ scheduledAt: '2026-04-24T10:00:00' }),
      { params: Promise.resolve({ id: 'post-1' }) },
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Geen caption beschikbaar')
  })

  it('returns 500 and does NOT update Supabase when Zernio fails', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    const { scheduleZernioPost } = await import('@/lib/zernio/client')

    const updateMock = vi.fn().mockReturnThis()
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        update: updateMock,
        single: vi.fn().mockResolvedValue({ data: mockPostRow, error: null }),
      }),
    } as never)
    vi.mocked(scheduleZernioPost).mockRejectedValue(new Error('Zernio 500: Server Error'))

    const { POST } = await import('../route')
    const res = await POST(
      makeRequest({ scheduledAt: '2026-04-24T10:00:00' }),
      { params: Promise.resolve({ id: 'post-1' }) },
    )

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Inplannen bij Zernio mislukt')
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('extracts mediaUrl as imageUrl for upload posts', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    const { scheduleZernioPost } = await import('@/lib/zernio/client')

    const uploadPostRow = {
      id: 'post-1',
      state: 'draft',
      position: 0,
      source: {
        kind: 'upload',
        mediaUrls: ['https://storage.supabase.co/image.jpg'],
        mediaType: 'image',
        userPrompt: 'Pasen',
      },
      crop_data: { x: 0, y: 0, scale: 1 },
      caption: mockCaption,
      scheduled_at: null,
      is_person: false,
    }
    const updatedRow = { ...uploadPostRow, state: 'locked', scheduled_at: '2026-04-24T10:00:00' }

    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock(uploadPostRow, updatedRow) as never)
    vi.mocked(scheduleZernioPost).mockResolvedValue(undefined)

    const { POST } = await import('../route')
    const res = await POST(
      makeRequest({ scheduledAt: '2026-04-24T10:00:00' }),
      { params: Promise.resolve({ id: 'post-1' }) },
    )

    expect(res.status).toBe(200)
    expect(vi.mocked(scheduleZernioPost)).toHaveBeenCalledWith(
      expect.objectContaining({ imageUrl: 'https://storage.supabase.co/image.jpg' }),
    )
  })
})

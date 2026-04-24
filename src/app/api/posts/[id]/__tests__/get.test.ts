import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/posts/[id]/route'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

function makeMockSupabase(result: { data: unknown; error: unknown }) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  }
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/posts/[id]', () => {
  it('retourneert de post als camelCase object', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeMockSupabase({
        data: {
          id: 'abc-123',
          state: 'draft',
          position: 2,
          source: null,
          crop_data: { x: 0.1, y: 0, scale: 1.2 },
          caption: null,
          scheduled_at: null,
          is_person: false,
        },
        error: null,
      }) as any,
    )

    const res = await GET(
      {} as any,
      { params: Promise.resolve({ id: 'abc-123' }) },
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.id).toBe('abc-123')
    expect(json.cropData).toEqual({ x: 0.1, y: 0, scale: 1.2 })
    expect(json.isPerson).toBe(false)
    expect(json.caption).toBeNull()
  })

  it('retourneert 500 bij Supabase-fout', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeMockSupabase({ data: null, error: { message: 'not found' } }) as any,
    )

    const res = await GET(
      {} as any,
      { params: Promise.resolve({ id: 'xyz' }) },
    )
    expect(res.status).toBe(500)
  })
})

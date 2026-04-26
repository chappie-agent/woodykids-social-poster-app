import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { scheduleZernioPost, cancelZernioPost } from '@/lib/zernio/client'

const ORIG_ENV = { ...process.env }

beforeEach(() => {
  process.env.ZERNIO_API_KEY = 'test-key'
  process.env.ZERNIO_INSTAGRAM_ACCOUNT_ID = 'ig-123'
  vi.restoreAllMocks()
})

afterEach(() => {
  process.env = { ...ORIG_ENV }
})

describe('scheduleZernioPost', () => {
  it('returns the Zernio post _id from the response', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ post: { _id: 'zernio-abc' } }), { status: 200 })
    )

    const id = await scheduleZernioPost({
      content: 'hi', scheduledFor: '2030-01-01T00:00:00Z', mediaUrls: ['https://x/y.jpg'],
    })

    expect(id).toBe('zernio-abc')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://zernio.com/api/v1/posts',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('throws on non-2xx response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('boom', { status: 500 }))
    await expect(scheduleZernioPost({ content: 'x', scheduledFor: '2030-01-01T00:00:00Z' }))
      .rejects.toThrow(/Zernio 500/)
  })
})

describe('cancelZernioPost', () => {
  it('issues DELETE to /v1/posts with postId query param', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    )

    await cancelZernioPost('zernio-abc')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://zernio.com/api/v1/posts?postId=zernio-abc',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      })
    )
  })

  it('throws on non-2xx response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('nope', { status: 404 }))
    await expect(cancelZernioPost('zernio-abc')).rejects.toThrow(/Zernio 404/)
  })
})

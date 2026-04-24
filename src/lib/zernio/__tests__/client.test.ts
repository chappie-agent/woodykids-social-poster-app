import { describe, it, expect, vi, beforeEach } from 'vitest'
import { scheduleZernioPost } from '../client'

beforeEach(() => {
  vi.unstubAllGlobals()
  process.env.ZERNIO_API_KEY = 'test-key'
  process.env.ZERNIO_INSTAGRAM_ACCOUNT_ID = 'ig-123'
  process.env.ZERNIO_FACEBOOK_ACCOUNT_ID = 'fb-456'
})

describe('scheduleZernioPost', () => {
  it('POSTs to Zernio with correct headers and body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)

    await scheduleZernioPost({
      content: 'Test caption',
      scheduledFor: '2026-04-24T10:00:00',
      imageUrl: 'https://cdn.shopify.com/image.jpg',
    })

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://zernio.com/api/v1/posts')
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-key')
    const body = JSON.parse(init.body as string)
    expect(body.accountIds).toEqual(['ig-123', 'fb-456'])
    expect(body.content).toBe('Test caption')
    expect(body.scheduledFor).toBe('2026-04-24T10:00:00')
    expect(body.media).toEqual([{ url: 'https://cdn.shopify.com/image.jpg' }])
  })

  it('omits media field when imageUrl is undefined', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)

    await scheduleZernioPost({ content: 'Test', scheduledFor: '2026-04-24T10:00:00' })

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string)
    expect(body.media).toBeUndefined()
  })

  it('throws when Zernio returns a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => 'Unprocessable',
    }))

    await expect(
      scheduleZernioPost({ content: 'Test', scheduledFor: '2026-04-24T10:00:00' }),
    ).rejects.toThrow('Zernio 422')
  })

  it('throws when ZERNIO_API_KEY is missing', async () => {
    delete process.env.ZERNIO_API_KEY

    await expect(
      scheduleZernioPost({ content: 'Test', scheduledFor: '2026-04-24T10:00:00' }),
    ).rejects.toThrow('ZERNIO_API_KEY')
  })

  it('throws when ZERNIO_INSTAGRAM_ACCOUNT_ID is missing', async () => {
    delete process.env.ZERNIO_INSTAGRAM_ACCOUNT_ID

    await expect(
      scheduleZernioPost({ content: 'Test', scheduledFor: '2026-04-24T10:00:00' }),
    ).rejects.toThrow('ZERNIO_INSTAGRAM_ACCOUNT_ID')
  })
})

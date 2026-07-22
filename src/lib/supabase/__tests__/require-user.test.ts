import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

const ORIG = process.env.E2E_TEST

beforeEach(() => {
  delete process.env.E2E_TEST // test het echte auth-pad, niet de bypass
  vi.clearAllMocks()
})
afterEach(() => {
  if (ORIG === undefined) delete process.env.E2E_TEST
  else process.env.E2E_TEST = ORIG
})

function mockClient(user: unknown) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } }
}

describe('requireUser', () => {
  it('geeft 401 zonder sessie', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(mockClient(null) as never)
    const { requireUser } = await import('@/lib/supabase/require-user')
    const { user, response } = await requireUser()
    expect(user).toBeNull()
    expect(response?.status).toBe(401)
  })

  it('geeft 401 bij niet-@woodykids.com adres', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(mockClient({ email: 'x@gmail.com' }) as never)
    const { requireUser } = await import('@/lib/supabase/require-user')
    const { response } = await requireUser()
    expect(response?.status).toBe(401)
  })

  it('laat een geldige @woodykids.com gebruiker door', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(mockClient({ email: 'chris@woodykids.com' }) as never)
    const { requireUser } = await import('@/lib/supabase/require-user')
    const { user, response } = await requireUser()
    expect(response).toBeNull()
    expect(user?.email).toBe('chris@woodykids.com')
  })

  it('laat een gemengd-hoofdlettergebruik @woodykids.com adres door', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(mockClient({ email: 'Chris@WoodyKids.com' }) as never)
    const { requireUser } = await import('@/lib/supabase/require-user')
    const { response } = await requireUser()
    expect(response).toBeNull()
  })

  it('bypasst auth wanneer E2E_TEST=true', async () => {
    process.env.E2E_TEST = 'true'
    const { requireUser } = await import('@/lib/supabase/require-user')
    const { response } = await requireUser()
    expect(response).toBeNull()
  })
})

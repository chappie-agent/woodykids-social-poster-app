# Zernio Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stub `/api/posts/[id]/publish` route with a real Zernio API integration that schedules posts to Instagram and Facebook, only marking them `locked` after Zernio confirms.

**Architecture:** The publish route is atomic — it fetches the post, assembles the caption, calls Zernio, and only if Zernio succeeds does it write `state: locked` to Supabase. The editor removes its optimistic PUT and instead updates the store from the route's response. Two pure modules handle caption assembly and the Zernio HTTP call.

**Tech Stack:** Next.js 16 App Router, native `fetch`, Supabase, TypeScript, Vitest.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/zernio/format.ts` | Create | Pure function: `PostCaption → string` |
| `src/lib/zernio/client.ts` | Create | HTTP call to Zernio `POST /v1/posts` |
| `src/lib/zernio/__tests__/format.test.ts` | Create | Unit tests for caption assembly |
| `src/lib/zernio/__tests__/client.test.ts` | Create | Unit tests for Zernio client |
| `src/app/api/posts/[id]/publish/route.ts` | Modify | Replace stub with real integration |
| `src/app/api/posts/[id]/publish/__tests__/route.test.ts` | Create | Integration tests for publish route |
| `src/app/grid/[postId]/page.tsx` | Modify | Replace `handleSchedule` with atomic version |

---

## Context for implementers

### Relevant types (`src/lib/types.ts`)

```typescript
export type CaptionBlock = {
  variants: [string, string, string]
  selected: 0 | 1 | 2
}

export type Hashtag = {
  text: string
  active: boolean
}

export type PostCaption = {
  opener: CaptionBlock
  middle: CaptionBlock
  closer: CaptionBlock
  hashtags: Hashtag[]
}

export type PostSourceShopify = {
  kind: 'shopify'
  productId: string
  productTitle: string
  images: string[]
  variants?: ShopifyVariant[]
  selectedImageIndex: number
}

export type Post = {
  id: string
  state: PostState   // 'empty' | 'draft' | 'conflict' | 'locked'
  position: number
  source: PostSource | null
  cropData: CropData
  caption: PostCaption | null
  scheduledAt: string | null
  isPerson: boolean
}
```

### mapPost helper (already exists in other routes — repeat it in the publish route)

```typescript
function mapPost(row: Record<string, unknown>): Post {
  return {
    id: row.id as string,
    state: row.state as PostState,
    position: row.position as number,
    source: (row.source as PostSource) ?? null,
    cropData: (row.crop_data as CropData) ?? { x: 0, y: 0, scale: 1 },
    caption: (row.caption as PostCaption) ?? null,
    scheduledAt: (row.scheduled_at as string) ?? null,
    isPerson: Boolean(row.is_person),
  }
}
```

### Supabase mock pattern (used in other tests in this project)

```typescript
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
```

### Env vars (already set in `.env.local`)

```
ZERNIO_API_KEY=sk_38d4...
ZERNIO_INSTAGRAM_ACCOUNT_ID=69ca53...
ZERNIO_FACEBOOK_ACCOUNT_ID=69ca54...
```

### Run tests

```bash
npm test -- --run
```

---

## Task 1: Caption assembly

**Files:**
- Create: `src/lib/zernio/format.ts`
- Create: `src/lib/zernio/__tests__/format.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/zernio/__tests__/format.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { assembleCaption } from '../format'
import type { PostCaption } from '@/lib/types'

const caption: PostCaption = {
  opener: { variants: ['Hallo wereld', 'Goedemorgen', 'Welkom'], selected: 0 },
  middle: { variants: ['Dit is het middenstuk', 'Meer info hier', 'Bekijk het'], selected: 1 },
  closer: { variants: ['Bestel nu!', 'Shop hier!', 'Ontdek meer!'], selected: 2 },
  hashtags: [
    { text: '#kids', active: true },
    { text: '#speelgoed', active: true },
    { text: '#woodykids', active: true },
    { text: '#nl', active: false },
    { text: '#baby', active: false },
  ],
}

describe('assembleCaption', () => {
  it('joins selected variants and active hashtags with double newlines', () => {
    expect(assembleCaption(caption)).toBe(
      'Hallo wereld\n\nMeer info hier\n\nOntdek meer!\n\n#kids #speelgoed #woodykids',
    )
  })

  it('uses the selected index for each block', () => {
    const c: PostCaption = {
      ...caption,
      opener: { variants: ['A', 'B', 'C'], selected: 2 },
    }
    const result = assembleCaption(c)
    expect(result.startsWith('C\n\n')).toBe(true)
  })

  it('omits inactive hashtags', () => {
    const result = assembleCaption(caption)
    expect(result).not.toContain('#nl')
    expect(result).not.toContain('#baby')
  })

  it('omits hashtag line when all hashtags are inactive', () => {
    const c: PostCaption = {
      ...caption,
      hashtags: caption.hashtags.map(h => ({ ...h, active: false })),
    }
    expect(assembleCaption(c)).toBe('Hallo wereld\n\nMeer info hier\n\nOntdek meer!')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --run src/lib/zernio/__tests__/format.test.ts
```

Expected: FAIL — `Cannot find module '../format'`

- [ ] **Step 3: Implement `assembleCaption`**

Create `src/lib/zernio/format.ts`:

```typescript
import type { PostCaption } from '@/lib/types'

export function assembleCaption(caption: PostCaption): string {
  const opener = caption.opener.variants[caption.opener.selected]
  const middle = caption.middle.variants[caption.middle.selected]
  const closer = caption.closer.variants[caption.closer.selected]
  const hashtags = caption.hashtags
    .filter(h => h.active)
    .map(h => h.text)
    .join(' ')

  const parts = [opener, middle, closer]
  if (hashtags) parts.push(hashtags)
  return parts.join('\n\n')
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --run src/lib/zernio/__tests__/format.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/zernio/format.ts src/lib/zernio/__tests__/format.test.ts
git commit -m "feat: add caption assembly for Zernio publishing"
```

---

## Task 2: Zernio HTTP client

**Files:**
- Create: `src/lib/zernio/client.ts`
- Create: `src/lib/zernio/__tests__/client.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/zernio/__tests__/client.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --run src/lib/zernio/__tests__/client.test.ts
```

Expected: FAIL — `Cannot find module '../client'`

- [ ] **Step 3: Implement the Zernio client**

Create `src/lib/zernio/client.ts`:

```typescript
type ZernioPostInput = {
  content: string
  scheduledFor: string
  imageUrl?: string
}

export async function scheduleZernioPost(input: ZernioPostInput): Promise<void> {
  const apiKey = process.env.ZERNIO_API_KEY
  if (!apiKey) throw new Error('ZERNIO_API_KEY is not set')

  const instagramId = process.env.ZERNIO_INSTAGRAM_ACCOUNT_ID
  if (!instagramId) throw new Error('ZERNIO_INSTAGRAM_ACCOUNT_ID is not set')

  const facebookId = process.env.ZERNIO_FACEBOOK_ACCOUNT_ID
  if (!facebookId) throw new Error('ZERNIO_FACEBOOK_ACCOUNT_ID is not set')

  const body: Record<string, unknown> = {
    accountIds: [instagramId, facebookId],
    content: input.content,
    scheduledFor: input.scheduledFor,
  }

  if (input.imageUrl) {
    body.media = [{ url: input.imageUrl }]
  }

  const res = await fetch('https://zernio.com/api/v1/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Zernio ${res.status}: ${text}`)
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --run src/lib/zernio/__tests__/client.test.ts
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/zernio/client.ts src/lib/zernio/__tests__/client.test.ts
git commit -m "feat: add Zernio HTTP client"
```

---

## Task 3: Atomic publish route

**Files:**
- Modify: `src/app/api/posts/[id]/publish/route.ts`
- Create: `src/app/api/posts/[id]/publish/__tests__/route.test.ts`

The current file is a stub that just logs and returns `{ queued: true }`. Replace it entirely.

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/posts/[id]/publish/__tests__/route.test.ts`:

```typescript
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
    selectedImageIndex: 0,
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

function makeSupabaseMock(
  postRow: Record<string, unknown>,
  updatedRow: Record<string, unknown>,
) {
  let callCount = 0
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount === 1) return { data: postRow, error: null }
        return { data: updatedRow, error: null }
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
    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock(mockPostRow, updatedRow) as never)
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
    const nullCaptionRow = { ...mockPostRow, caption: null }
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: nullCaptionRow, error: null }),
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

  it('returns 500 and does not update Supabase when Zernio fails', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    const { scheduleZernioPost } = await import('@/lib/zernio/client')

    const supabaseMock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPostRow, error: null }),
      }),
    }
    vi.mocked(createClient).mockResolvedValue(supabaseMock as never)
    vi.mocked(scheduleZernioPost).mockRejectedValue(new Error('Zernio 500: Internal Server Error'))

    const { POST } = await import('../route')
    const res = await POST(
      makeRequest({ scheduledAt: '2026-04-24T10:00:00' }),
      { params: Promise.resolve({ id: 'post-1' }) },
    )

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Inplannen bij Zernio mislukt')
    // update must not have been called
    expect(supabaseMock.from().update).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --run "src/app/api/posts/\[id\]/publish/__tests__/route.test.ts"
```

Expected: FAIL (tests import the stub route which doesn't return the right shape)

- [ ] **Step 3: Replace the stub with the real implementation**

Overwrite `src/app/api/posts/[id]/publish/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scheduleZernioPost } from '@/lib/zernio/client'
import { assembleCaption } from '@/lib/zernio/format'
import type { Post, PostState, PostSource, CropData, PostCaption } from '@/lib/types'

function mapPost(row: Record<string, unknown>): Post {
  return {
    id: row.id as string,
    state: row.state as PostState,
    position: row.position as number,
    source: (row.source as PostSource) ?? null,
    cropData: (row.crop_data as CropData) ?? { x: 0, y: 0, scale: 1 },
    caption: (row.caption as PostCaption) ?? null,
    scheduledAt: (row.scheduled_at as string) ?? null,
    isPerson: Boolean(row.is_person),
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { scheduledAt } = await request.json() as { scheduledAt: string }
  const supabase = await createClient()

  const { data: postRow, error: postError } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .single()

  if (postError) return NextResponse.json({ error: postError.message }, { status: 500 })

  const caption = postRow.caption as PostCaption | null
  if (!caption) {
    return NextResponse.json({ error: 'Geen caption beschikbaar' }, { status: 400 })
  }

  const source = postRow.source as PostSource | null
  let imageUrl: string | undefined
  if (source?.kind === 'shopify') {
    imageUrl = source.images[source.selectedImageIndex] ?? source.images[0]
  }

  const content = assembleCaption(caption)

  try {
    await scheduleZernioPost({ content, scheduledFor: scheduledAt, imageUrl })
  } catch (err) {
    console.error('[publish] Zernio error:', err)
    return NextResponse.json({ error: 'Inplannen bij Zernio mislukt' }, { status: 500 })
  }

  const { data, error: updateError } = await supabase
    .from('posts')
    .update({ state: 'locked', scheduled_at: scheduledAt })
    .eq('id', id)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json(mapPost(data))
}
```

- [ ] **Step 4: Run all tests to confirm they pass**

```bash
npm test -- --run
```

Expected: all tests PASS (including the 3 new publish route tests)

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/posts/[id]/publish/route.ts" "src/app/api/posts/[id]/publish/__tests__/route.test.ts"
git commit -m "feat: implement Zernio publish route (atomic, rolls back on failure)"
```

---

## Task 4: Update editor `handleSchedule`

**Files:**
- Modify: `src/app/grid/[postId]/page.tsx` (lines 102–118)

No new tests — the route's behaviour is already tested. This is a UI wiring change.

The current `handleSchedule` optimistically locks the post and calls two fetches. Replace it with a single atomic call.

- [ ] **Step 1: Replace `handleSchedule` in `src/app/grid/[postId]/page.tsx`**

Find and replace the entire `handleSchedule` function (currently lines 102–118):

**Old code:**
```typescript
async function handleSchedule(isoDateTime: string) {
  setSaving(true)
  updatePost(postId, { state: 'locked', scheduledAt: isoDateTime })
  await fetch(`/api/posts/${postId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: 'locked', scheduledAt: isoDateTime }),
  })
  await fetch(`/api/posts/${postId}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scheduledAt: isoDateTime }),
  })
  setSaving(false)
  toast.success('Ingepland voor Zernio 🎉')
  router.push('/grid')
}
```

**New code:**
```typescript
async function handleSchedule(isoDateTime: string) {
  setSaving(true)
  try {
    const res = await fetch(`/api/posts/${postId}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduledAt: isoDateTime }),
    })
    if (!res.ok) throw new Error('publish failed')
    const updated: Post = await res.json()
    updatePost(postId, updated)
    toast.success('Ingepland voor Zernio 🎉')
    router.push('/grid')
  } catch {
    setGenerateError('Inplannen mislukt. Probeer opnieuw.')
  } finally {
    setSaving(false)
  }
}
```

- [ ] **Step 2: Run all tests to confirm nothing broke**

```bash
npm test -- --run
```

Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add "src/app/grid/[postId]/page.tsx"
git commit -m "feat: make handleSchedule atomic — update store from publish route response"
```

# Upload Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users upload their own photos and videos as Instagram posts, with automatic caption generation via Claude.

**Architecture:** Client uploads the file directly to Supabase Storage (bucket `post-media`), then calls `create-upload` to persist the post, then fires caption generation. The generate-caption route is extended with a branch for uploads (vision for images, text-only for video). The publish route is extended to pass `mediaUrl` to Zernio. Two new UI components (SourcePicker, UploadPicker) replace the direct empty-cell → ProductPicker wiring in PostGrid.

**Tech Stack:** Next.js 16 App Router, Supabase Storage, `@supabase/supabase-js` browser client, Claude claude-sonnet-4-6, TypeScript, Vitest.

---

## Prerequisites (manual steps before implementation)

1. Create bucket `post-media` in Supabase dashboard (Storage → New bucket → name: `post-media`, Public: ON)
2. Run all existing tests to confirm baseline: `npm test -- --run` → should be 63 passing

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/anthropic/caption.ts` | Modify | Add `buildUploadUserContent` |
| `src/lib/anthropic/__tests__/caption.test.ts` | Modify | Tests for `buildUploadUserContent` |
| `src/app/api/posts/create-upload/route.ts` | Modify | Replace stub with real Supabase insert |
| `src/app/api/posts/create-upload/__tests__/route.test.ts` | Create | Tests for create-upload route |
| `src/app/api/posts/[id]/generate-caption/route.ts` | Modify | Replace shopify-only guard with source branch |
| `src/app/api/posts/[id]/generate-caption/__tests__/route.test.ts` | Create | Tests for upload caption paths |
| `src/app/api/posts/[id]/publish/route.ts` | Modify | Add upload `imageUrl` branch |
| `src/components/editor/SourcePicker.tsx` | Create | Choice sheet: product or upload |
| `src/components/editor/UploadPicker.tsx` | Create | File picker + userPrompt + Supabase upload |
| `src/components/grid/PostGrid.tsx` | Modify | Wire SourcePicker → ProductPicker or UploadPicker |

---

## Context for implementers

### Types (`src/lib/types.ts`)

```typescript
export type PostSourceUpload = {
  kind: 'upload'
  mediaUrl: string
  mediaType: 'image' | 'video'
  userPrompt: string
}

export type PostSourceShopify = {
  kind: 'shopify'
  productId: string
  productTitle: string
  images: string[]
  variants?: ShopifyVariant[]
  selectedImageIndex: number
}

export type PostSource = PostSourceShopify | PostSourceUpload
```

### Supabase browser client (`src/lib/supabase/client.ts`)

```typescript
import { createBrowserClient } from '@supabase/ssr'
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

### mapPost helper (repeat in each route that needs it)

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

### Supabase mock pattern (used in all route tests)

```typescript
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
```

### Run tests

```bash
npm test -- --run
```

---

## Task 1: `buildUploadUserContent` in caption.ts

**Files:**
- Modify: `src/lib/anthropic/caption.ts`
- Modify: `src/lib/anthropic/__tests__/caption.test.ts`

- [ ] **Step 1: Add failing tests to the existing test file**

Open `src/lib/anthropic/__tests__/caption.test.ts` and append a new `describe` block after the existing tests:

```typescript
import type { PostSourceUpload } from '@/lib/types'
// (add this import at the top of the file alongside existing imports)
import { buildSystemPrompt, buildUserContent, buildUploadUserContent, parseCaptionResponse } from '../caption'

// Add this describe block at the bottom of the file:
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
```

Also update the existing import line at the top of `caption.test.ts` to include `buildUploadUserContent`:
```typescript
import { buildSystemPrompt, buildUserContent, buildUploadUserContent, parseCaptionResponse } from '../caption'
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --run src/lib/anthropic/__tests__/caption.test.ts
```

Expected: FAIL — `buildUploadUserContent is not a function`

- [ ] **Step 3: Add `buildUploadUserContent` to `src/lib/anthropic/caption.ts`**

Add this import at the top (alongside existing import):
```typescript
import type { PostCaption, PostSourceShopify, PostSourceUpload } from '@/lib/types'
```

Add this function at the end of the file, after `parseCaptionResponse`:

```typescript
export function buildUploadUserContent(source: PostSourceUpload): ContentBlock[] {
  const content: ContentBlock[] = []

  if (source.mediaType === 'image') {
    content.push({
      type: 'image',
      source: { type: 'url', url: source.mediaUrl },
    })
  }

  content.push({
    type: 'text',
    text: [
      `Eigen post: ${source.userPrompt}`,
      '',
      'Schrijf een Instagram-caption in drie losse secties (opener, middenstuk, afsluiter).',
      'Elke sectie heeft drie varianten die in toon licht van elkaar verschillen.',
      'Genereer ook vijf Nederlandse hashtags.',
    ].join('\n'),
  })

  return content
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --run src/lib/anthropic/__tests__/caption.test.ts
```

Expected: all tests PASS (existing 12 + 4 new = 16 total)

- [ ] **Step 5: Commit**

```bash
git add src/lib/anthropic/caption.ts src/lib/anthropic/__tests__/caption.test.ts
git commit -m "feat: add buildUploadUserContent for upload caption generation"
```

---

## Task 2: `create-upload` route (replace stub with Supabase insert)

**Files:**
- Modify: `src/app/api/posts/create-upload/route.ts`
- Create: `src/app/api/posts/create-upload/__tests__/route.test.ts`

The current stub at `src/app/api/posts/create-upload/route.ts` creates an in-memory Post but never saves to Supabase. Replace it entirely.

- [ ] **Step 1: Create the test file**

Create `src/app/api/posts/create-upload/__tests__/route.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --run "src/app/api/posts/create-upload/__tests__/route.test.ts"
```

Expected: FAIL (stub returns in-memory Post without Supabase, first test will fail on `source.kind`)

- [ ] **Step 3: Replace the stub**

Overwrite `src/app/api/posts/create-upload/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Post, PostState, PostSource, CropData, PostCaption, PostSourceUpload } from '@/lib/types'

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

export async function POST(request: NextRequest) {
  const { mediaUrl, mediaType, userPrompt, position } = await request.json() as {
    mediaUrl: string
    mediaType: 'image' | 'video'
    userPrompt: string
    position: number
  }

  const source: PostSourceUpload = { kind: 'upload', mediaUrl, mediaType, userPrompt }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('posts')
    .update({
      state: 'draft',
      source,
      crop_data: { x: 0, y: 0, scale: 1 },
      caption: null,
      scheduled_at: null,
      is_person: false,
      created_by: user?.id ?? null,
    })
    .eq('position', position)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(mapPost(data))
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --run "src/app/api/posts/create-upload/__tests__/route.test.ts"
```

Expected: 2 tests PASS

- [ ] **Step 5: Run all tests**

```bash
npm test -- --run
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/posts/create-upload/route.ts "src/app/api/posts/create-upload/__tests__/route.test.ts"
git commit -m "feat: implement create-upload route with Supabase persistence"
```

---

## Task 3: Extend generate-caption route for uploads

**Files:**
- Modify: `src/app/api/posts/[id]/generate-caption/route.ts`
- Create: `src/app/api/posts/[id]/generate-caption/__tests__/route.test.ts`

The current route returns 400 for any non-Shopify source. Replace the guard with a branch that calls `buildUploadUserContent` for upload posts.

- [ ] **Step 1: Create the test file**

Create `src/app/api/posts/[id]/generate-caption/__tests__/route.test.ts`:

```typescript
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
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --run "src/app/api/posts/\[id\]/generate-caption/__tests__/route.test.ts"
```

Expected: FAIL (upload test hits the existing `kind !== 'shopify'` guard → 400)

- [ ] **Step 3: Modify `src/app/api/posts/[id]/generate-caption/route.ts`**

Make three changes:

**Change 1 — update imports** (top of file):
```typescript
// Old:
import { buildSystemPrompt, buildUserContent, parseCaptionResponse } from '@/lib/anthropic/caption'
import type { Post, PostState, PostSource, CropData, PostCaption, PostSourceShopify } from '@/lib/types'

// New:
import { buildSystemPrompt, buildUserContent, buildUploadUserContent, parseCaptionResponse } from '@/lib/anthropic/caption'
import type { Post, PostState, PostSource, CropData, PostCaption } from '@/lib/types'
```

**Change 2 — replace the guard** (lines 38–41):
```typescript
// Old:
const source = postRow.source as PostSourceShopify | null
if (source?.kind !== 'shopify') {
  return NextResponse.json({ error: 'Only Shopify posts supported' }, { status: 400 })
}

// New:
const source = postRow.source as PostSource | null
if (!source || (source.kind !== 'shopify' && source.kind !== 'upload')) {
  return NextResponse.json({ error: 'Unsupported post source' }, { status: 400 })
}
```

**Change 3 — replace the content builder** (inside the Claude call, the `content:` line):
```typescript
// Old:
content: buildUserContent(source) as Anthropic.ContentBlockParam[],

// New:
content: (source.kind === 'shopify'
  ? buildUserContent(source)
  : buildUploadUserContent(source)
) as Anthropic.ContentBlockParam[],
```

- [ ] **Step 4: Run new tests to confirm they pass**

```bash
npm test -- --run "src/app/api/posts/\[id\]/generate-caption/__tests__/route.test.ts"
```

Expected: 3 tests PASS

- [ ] **Step 5: Run all tests**

```bash
npm test -- --run
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/posts/[id]/generate-caption/route.ts" "src/app/api/posts/[id]/generate-caption/__tests__/route.test.ts"
git commit -m "feat: extend generate-caption route to support upload posts"
```

---

## Task 4: Publish route — add upload imageUrl branch

**Files:**
- Modify: `src/app/api/posts/[id]/publish/route.ts` (lines 52–56)
- Modify: `src/app/api/posts/[id]/publish/__tests__/route.test.ts`

Without this change, upload posts are published to Zernio without a media field, which Instagram rejects.

- [ ] **Step 1: Add a failing test to the existing publish route test file**

Open `src/app/api/posts/[id]/publish/__tests__/route.test.ts` and add this test inside the existing `describe` block, after the existing tests:

```typescript
it('extracts mediaUrl as imageUrl for upload posts', async () => {
  const { createClient } = await import('@/lib/supabase/server')
  const { scheduleZernioPost } = await import('@/lib/zernio/client')

  const uploadPostRow = {
    id: 'post-1',
    state: 'draft',
    position: 0,
    source: {
      kind: 'upload',
      mediaUrl: 'https://storage.supabase.co/image.jpg',
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
```

- [ ] **Step 2: Run tests to confirm the new test fails**

```bash
npm test -- --run "src/app/api/posts/\[id\]/publish/__tests__/route.test.ts"
```

Expected: 3 pass, 1 FAIL (upload post sends `imageUrl: undefined`)

- [ ] **Step 3: Add the upload branch to `src/app/api/posts/[id]/publish/route.ts`**

Find the imageUrl extraction block (currently lines 52–56):
```typescript
// Old:
const source = postRow.source as PostSource | null
let imageUrl: string | undefined
if (source?.kind === 'shopify') {
  imageUrl = source.images[source.selectedImageIndex] ?? source.images[0]
}

// New:
const source = postRow.source as PostSource | null
let imageUrl: string | undefined
if (source?.kind === 'shopify') {
  imageUrl = source.images[source.selectedImageIndex] ?? source.images[0]
} else if (source?.kind === 'upload') {
  imageUrl = source.mediaUrl
}
```

- [ ] **Step 4: Run all tests to confirm all pass**

```bash
npm test -- --run
```

Expected: all PASS (4 publish route tests now passing)

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/posts/[id]/publish/route.ts" "src/app/api/posts/[id]/publish/__tests__/route.test.ts"
git commit -m "feat: pass upload mediaUrl to Zernio when publishing upload posts"
```

---

## Task 5: SourcePicker component

**Files:**
- Create: `src/components/editor/SourcePicker.tsx`

No unit tests — this is a pure presentational component with no logic (two buttons that call props).

- [ ] **Step 1: Create `src/components/editor/SourcePicker.tsx`**

```typescript
'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

type Props = {
  open: boolean
  onClose: () => void
  onChooseProduct: () => void
  onChooseUpload: () => void
}

export function SourcePicker({ open, onClose, onChooseProduct, onChooseUpload }: Props) {
  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="mb-4 shrink-0">
          <SheetTitle className="text-sm text-left">Wat wil je toevoegen?</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => { onClose(); onChooseProduct() }}
            className="w-full text-left px-4 py-4 rounded-xl border border-woody-taupe/30 bg-woody-beige text-sm font-semibold text-woody-brown"
          >
            🛍 Shopify product
          </button>
          <button
            onClick={() => { onClose(); onChooseUpload() }}
            className="w-full text-left px-4 py-4 rounded-xl border border-woody-taupe/30 bg-woody-beige text-sm font-semibold text-woody-brown"
          >
            📷 Eigen foto of video
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Run all tests to confirm no regressions**

```bash
npm test -- --run
```

Expected: all PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/SourcePicker.tsx
git commit -m "feat: add SourcePicker component (product vs upload choice)"
```

---

## Task 6: UploadPicker component

**Files:**
- Create: `src/components/editor/UploadPicker.tsx`

No unit tests — behavior is verified through the underlying routes which are already tested. The component has side effects (Supabase Storage, fetch) that would require extensive mocking.

- [ ] **Step 1: Create `src/components/editor/UploadPicker.tsx`**

```typescript
'use client'

import { useState, useRef } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { createClient } from '@/lib/supabase/client'
import type { Post } from '@/lib/types'

type Props = {
  open: boolean
  position: number
  onClose: () => void
  onCreated: (post: Post) => void
}

export function UploadPicker({ open, position, onClose, onCreated }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [userPrompt, setUserPrompt] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setError(null)
    setPreview(URL.createObjectURL(f))
  }

  function reset() {
    setFile(null)
    setPreview(null)
    setUserPrompt('')
    setError(null)
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleAdd() {
    if (!file) return
    setUploading(true)
    setError(null)

    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() ?? 'bin'
      const path = `${crypto.randomUUID()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('post-media')
        .upload(path, file)
      if (uploadError) throw new Error(uploadError.message)

      const { data: { publicUrl } } = supabase.storage
        .from('post-media')
        .getPublicUrl(path)

      const mediaType: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image'

      const res = await fetch('/api/posts/create-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaUrl: publicUrl, mediaType, userPrompt, position }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const post = await res.json() as Post

      fetch(`/api/posts/${post.id}/generate-caption`, { method: 'POST' }).catch(() => {})

      onCreated(post)
      reset()
      onClose()
    } catch {
      setError('Uploaden mislukt. Probeer opnieuw.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) { reset(); onClose() } }}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8 flex flex-col" style={{ height: '70vh' }}>
        <SheetHeader className="mb-4 shrink-0">
          <SheetTitle className="text-sm text-left">Eigen media toevoegen</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto flex flex-col gap-4">
          {!file ? (
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full aspect-square max-h-48 border-2 border-dashed border-woody-taupe/40 rounded-xl flex items-center justify-center text-sm text-woody-taupe"
            >
              Tik om foto of video te kiezen
            </button>
          ) : (
            <div className="relative">
              {file.type.startsWith('video/') ? (
                <div className="w-full aspect-square max-h-48 bg-woody-beige rounded-xl flex items-center justify-center">
                  <p className="text-xs text-woody-taupe text-center px-4">🎥 {file.name}</p>
                </div>
              ) : (
                <img
                  src={preview!}
                  alt="Preview"
                  className="w-full aspect-square max-h-48 object-cover rounded-xl"
                />
              )}
              <button
                onClick={() => { setFile(null); setPreview(null); if (inputRef.current) inputRef.current.value = '' }}
                className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full"
              >
                Wijzig
              </button>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <textarea
            placeholder="Beschrijf je post, bijv. 'Pasen sale, 20% korting op alles'"
            value={userPrompt}
            onChange={e => setUserPrompt(e.target.value)}
            rows={3}
            className="w-full border border-woody-taupe/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-woody-bordeaux/30 resize-none"
          />

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <button
          onClick={handleAdd}
          disabled={!file || uploading}
          className="mt-4 shrink-0 w-full bg-woody-bordeaux text-woody-cream text-sm font-bold py-3 rounded-xl disabled:opacity-40"
        >
          {uploading ? 'Uploaden...' : 'Toevoegen'}
        </button>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Run all tests to confirm no regressions**

```bash
npm test -- --run
```

Expected: all PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/UploadPicker.tsx
git commit -m "feat: add UploadPicker component (file + userPrompt + Supabase Storage upload)"
```

---

## Task 7: Wire PostGrid with SourcePicker

**Files:**
- Modify: `src/components/grid/PostGrid.tsx`

Replace the direct empty-cell → ProductPicker wiring with a three-way flow via SourcePicker.

- [ ] **Step 1: Update `src/components/grid/PostGrid.tsx`**

The full updated file:

```typescript
'use client'

import { useRef, useState } from 'react'
import {
  DndContext, DragEndEvent, DragStartEvent,
  PointerSensor, useSensor, useSensors,
  closestCenter,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRouter } from 'next/navigation'
import { useGridStore } from '@/lib/store/gridStore'
import { PostCell } from './PostCell'
import { SourcePicker } from '@/components/editor/SourcePicker'
import { ProductPicker } from '@/components/editor/ProductPicker'
import { UploadPicker } from '@/components/editor/UploadPicker'
import type { Post } from '@/lib/types'

function SortableCell({ post }: { post: Post }) {
  const router = useRouter()
  const { draggingId } = useGridStore()
  const isDragging = draggingId === post.id
  const prevDraggingId = useRef<string | null>(null)
  const wasDragged = useRef<boolean>(false)

  if (prevDraggingId.current === post.id && draggingId !== post.id) {
    wasDragged.current = true
  }
  prevDraggingId.current = draggingId

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: post.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 'auto' as const,
    touchAction: 'none' as const,
  }

  function handleTap() {
    if (wasDragged.current) {
      wasDragged.current = false
      return
    }
    router.push(`/grid/${post.id}`)
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <PostCell post={post} isDragging={isDragging} onTap={handleTap} />
    </div>
  )
}

export function PostGrid() {
  const { posts, setOrder, setDragging, updatePost } = useGridStore()
  const [sourcePickerPosition, setSourcePickerPosition] = useState<number | null>(null)
  const [productPickerPosition, setProductPickerPosition] = useState<number | null>(null)
  const [uploadPickerPosition, setUploadPickerPosition] = useState<number | null>(null)

  const sorted = [...posts].sort((a, b) => a.position - b.position)
  const draggable = sorted.filter(p => p.state === 'draft' || p.state === 'conflict')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  function handleDragStart(event: DragStartEvent) {
    setDragging(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragging(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = draggable.findIndex(p => p.id === active.id)
    const newIndex = draggable.findIndex(p => p.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(draggable, oldIndex, newIndex)

    let draftCursor = 0
    const merged = sorted.map(p => {
      if (p.state === 'draft' || p.state === 'conflict') return reordered[draftCursor++]
      return p
    })

    const ids = merged.map(p => p.id)
    setOrder(ids)

    fetch('/api/grid/order', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
  }

  function handleCreated(newPost: Post) {
    updatePost(newPost.id, newPost)
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={draggable.map(p => p.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 gap-[1px] bg-[#2a2a2a]">
            {sorted.map(post =>
              post.state === 'draft' || post.state === 'conflict'
                ? <SortableCell key={post.id} post={post} />
                : (
                  <div key={post.id}>
                    <PostCell
                      post={post}
                      onTap={post.state === 'empty'
                        ? () => setSourcePickerPosition(post.position)
                        : undefined}
                    />
                  </div>
                )
            )}
          </div>
        </SortableContext>
      </DndContext>

      <SourcePicker
        open={sourcePickerPosition !== null}
        onClose={() => setSourcePickerPosition(null)}
        onChooseProduct={() => {
          setProductPickerPosition(sourcePickerPosition)
          setSourcePickerPosition(null)
        }}
        onChooseUpload={() => {
          setUploadPickerPosition(sourcePickerPosition)
          setSourcePickerPosition(null)
        }}
      />

      <ProductPicker
        open={productPickerPosition !== null}
        position={productPickerPosition ?? 0}
        onClose={() => setProductPickerPosition(null)}
        onCreated={(newPost) => {
          handleCreated(newPost)
          setProductPickerPosition(null)
        }}
      />

      <UploadPicker
        open={uploadPickerPosition !== null}
        position={uploadPickerPosition ?? 0}
        onClose={() => setUploadPickerPosition(null)}
        onCreated={(newPost) => {
          handleCreated(newPost)
          setUploadPickerPosition(null)
        }}
      />
    </>
  )
}
```

- [ ] **Step 2: Run all tests to confirm no regressions**

```bash
npm test -- --run
```

Expected: all PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/grid/PostGrid.tsx
git commit -m "feat: wire PostGrid with SourcePicker for product vs upload choice"
```

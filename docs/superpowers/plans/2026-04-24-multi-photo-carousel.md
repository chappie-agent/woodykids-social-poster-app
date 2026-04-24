# Multi-Photo Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single-photo post selection with an ordered multi-photo carousel (max 10) for both Shopify products and own uploads, aligned with Instagram's carousel format.

**Architecture:** Breaking data model change (`selectedImageIndex → selectedImageIndices`, `mediaUrl → mediaUrls`) propagated through types, a SQL migration, caption.ts, four API routes, the Zernio client, two UI components, and the editor page. The first photo in the selection array is always the cover sent to Claude Vision. All other photos are sent to Zernio as carousel slides.

**Tech Stack:** Next.js 16 App Router, Supabase Storage, TypeScript, Vitest.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/types.ts` | Modify | `selectedImageIndices: number[]`, `mediaUrls: string[]` |
| `src/lib/anthropic/caption.ts` | Modify | Cover image from `selectedImageIndices[0]` / `mediaUrls[0]` |
| `src/lib/anthropic/__tests__/caption.test.ts` | Modify | Update fixtures to new field names |
| `supabase/migrations/003_multi_photo_carousel.sql` | Create | Migrate existing JSONB rows to array fields |
| `src/app/api/posts/create-product/route.ts` | Modify | Default `selectedImageIndices: [1]` |
| `src/app/api/posts/create-upload/route.ts` | Modify | Accept `mediaUrls: string[]` |
| `src/app/api/posts/[id]/publish/route.ts` | Modify | Pass all selected URLs to Zernio |
| `src/lib/zernio/client.ts` | Modify | `mediaUrls?: string[]` replaces `imageUrl?: string` |
| `src/components/editor/MultiPhotoSelector.tsx` | Create | Multi-select thumbnail strip with position badges |
| `src/components/editor/PhotoSelector.tsx` | Delete | Replaced by MultiPhotoSelector |
| `src/components/editor/UploadPicker.tsx` | Modify | `<input multiple>`, parallel uploads, thumbnails row |
| `src/app/grid/[postId]/page.tsx` | Modify | Cover URL from array + swap in MultiPhotoSelector |

---

## Task 1: Update types and fix caption.ts

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/anthropic/caption.ts`
- Modify: `src/lib/anthropic/__tests__/caption.test.ts`

Context: `PostSourceShopify.selectedImageIndex: number` becomes `selectedImageIndices: number[]`. `PostSourceUpload.mediaUrl: string` becomes `mediaUrls: string[]`. These are used in caption.ts and its tests — all three files must change together so the test suite compiles and passes.

- [ ] **Step 1: Update `src/lib/types.ts`**

Replace the `PostSourceShopify` and `PostSourceUpload` type definitions:

```typescript
export type PostSourceShopify = {
  kind: 'shopify'
  productId: string
  productTitle: string
  images: string[]
  variants?: ShopifyVariant[]
  selectedImageIndices: number[]   // ordered array, max 10; first element is cover
}

export type PostSourceUpload = {
  kind: 'upload'
  mediaUrls: string[]              // ordered array, max 10; first element is cover
  mediaType: 'image' | 'video'    // type of the first/cover file
  userPrompt: string
}
```

The rest of the file (`ShopifyVariant`, `ShopifyProduct`, `ShopifyCollection`, `CropData`, `CaptionBlock`, `Hashtag`, `PostCaption`, `PostState`, `Post`, `ToneOfVoice`) stays unchanged.

- [ ] **Step 2: Update `buildUserContent` in `src/lib/anthropic/caption.ts`**

Change line 29 from:
```typescript
const selectedImage = source.images[source.selectedImageIndex] ?? source.images[0]
```
to:
```typescript
const selectedImage = source.images[source.selectedImageIndices[0]] ?? source.images[0]
```

- [ ] **Step 3: Update `buildUploadUserContent` in `src/lib/anthropic/caption.ts`**

Change line 63 from:
```typescript
source: { type: 'url', url: source.mediaUrl },
```
to:
```typescript
source: { type: 'url', url: source.mediaUrls[0] },
```

- [ ] **Step 4: Update test fixtures in `src/lib/anthropic/__tests__/caption.test.ts`**

Change the `shopifySource` fixture (line 5–12):
```typescript
const shopifySource: PostSourceShopify = {
  kind: 'shopify',
  productId: '1',
  productTitle: 'Houten treintje',
  images: ['https://cdn.shopify.com/img.jpg'],
  variants: [{ id: '1', title: 'Naturel / S', price: '24.95' }],
  selectedImageIndices: [0],
}
```

Change the `imageSource` fixture (line 114–119):
```typescript
const imageSource: PostSourceUpload = {
  kind: 'upload',
  mediaUrls: ['https://storage.supabase.co/image.jpg'],
  mediaType: 'image',
  userPrompt: 'Pasen sale, 20% korting',
}
```

Change the `videoSource` fixture (line 121–126):
```typescript
const videoSource: PostSourceUpload = {
  kind: 'upload',
  mediaUrls: ['https://storage.supabase.co/video.mp4'],
  mediaType: 'video',
  userPrompt: 'Zomercollectie 2026',
}
```

The test assertions themselves don't change — the expected image URL is `mediaUrls[0]` which is the same value.

- [ ] **Step 5: Run tests**

```bash
npm test -- --run
```

Expected: all tests PASS (the image URL assertions still match because `mediaUrls[0]` equals the old `mediaUrl`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/anthropic/caption.ts src/lib/anthropic/__tests__/caption.test.ts
git commit -m "feat: change selectedImageIndex → selectedImageIndices, mediaUrl → mediaUrls"
```

---

## Task 2: SQL migration

**Files:**
- Create: `supabase/migrations/003_multi_photo_carousel.sql`

Context: Existing posts in the database have JSONB source columns with the old `selectedImageIndex` (integer) and `mediaUrl` (string) fields. The migration converts each to an array without touching rows that already have the new shape. Apply via the Supabase MCP tool.

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/003_multi_photo_carousel.sql`:

```sql
-- Shopify: selectedImageIndex → selectedImageIndices
UPDATE posts
SET source = jsonb_set(
  source - 'selectedImageIndex',
  '{selectedImageIndices}',
  jsonb_build_array(COALESCE((source->>'selectedImageIndex')::int, 0))
)
WHERE source->>'kind' = 'shopify'
  AND source ? 'selectedImageIndex'
  AND NOT source ? 'selectedImageIndices';

-- Upload: mediaUrl → mediaUrls
UPDATE posts
SET source = jsonb_set(
  source - 'mediaUrl',
  '{mediaUrls}',
  jsonb_build_array(source->>'mediaUrl')
)
WHERE source->>'kind' = 'upload'
  AND source ? 'mediaUrl'
  AND NOT source ? 'mediaUrls';
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use the Supabase MCP tool (`apply_migration`) with:
- `name`: `multi_photo_carousel`
- `query`: the full SQL from Step 1

- [ ] **Step 3: Verify the migration**

Use the Supabase MCP tool (`execute_sql`) with:
```sql
SELECT
  id,
  source->>'kind' AS kind,
  source->'selectedImageIndices' AS indices,
  source->'mediaUrls' AS urls
FROM posts
WHERE source IS NOT NULL
LIMIT 10;
```

Expected: Shopify rows show `indices` as a JSON array (e.g. `[0]`), upload rows show `urls` as a JSON array (e.g. `["https://..."]`). No row should have `selectedImageIndex` (singular) or `mediaUrl` (singular) remaining.

- [ ] **Step 4: Run all tests**

```bash
npm test -- --run
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/003_multi_photo_carousel.sql
git commit -m "feat: migrate posts JSONB to selectedImageIndices and mediaUrls arrays"
```

---

## Task 3: Update create-product and create-upload routes

**Files:**
- Modify: `src/app/api/posts/create-product/route.ts`
- Modify: `src/app/api/posts/create-upload/route.ts`

Context: `create-product` currently sets `selectedImageIndex: 0`. The spec says the default cover should be the second photo (index 1) — it tends to be a lifestyle shot. `create-upload` currently accepts `mediaUrl: string`; it must now accept `mediaUrls: string[]`.

- [ ] **Step 1: Update `create-product` route**

In `src/app/api/posts/create-product/route.ts`, change the `source` object (around line 30–37):

```typescript
const source: PostSourceShopify = {
  kind: 'shopify',
  productId: product.id,
  productTitle: product.title,
  images: product.images,
  variants: product.variants,
  selectedImageIndices: [1],
}
```

- [ ] **Step 2: Update `create-upload` route**

Replace the full content of `src/app/api/posts/create-upload/route.ts`:

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
  const { mediaUrls, mediaType, userPrompt, position } = await request.json() as {
    mediaUrls: string[]
    mediaType: 'image' | 'video'
    userPrompt: string
    position: number
  }

  if (!['image', 'video'].includes(mediaType)) {
    return NextResponse.json({ error: 'Invalid mediaType' }, { status: 400 })
  }

  if (!Array.isArray(mediaUrls) || mediaUrls.length === 0) {
    return NextResponse.json({ error: 'mediaUrls must be a non-empty array' }, { status: 400 })
  }

  const source: PostSourceUpload = { kind: 'upload', mediaUrls, mediaType, userPrompt }

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

- [ ] **Step 3: Run all tests**

```bash
npm test -- --run
```

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/posts/create-product/route.ts src/app/api/posts/create-upload/route.ts
git commit -m "feat: update create-product and create-upload routes for photo arrays"
```

---

## Task 4: Update publish route and Zernio client

**Files:**
- Modify: `src/lib/zernio/client.ts`
- Modify: `src/app/api/posts/[id]/publish/route.ts`

Context: Zernio currently receives a single `imageUrl`. For a carousel it must receive an array. The publish route must extract all selected image URLs and pass them to the client.

- [ ] **Step 1: Update `src/lib/zernio/client.ts`**

Replace the full file:

```typescript
type ZernioPostInput = {
  content: string
  scheduledFor: string
  mediaUrls?: string[]
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

  if (input.mediaUrls?.length) {
    body.media = input.mediaUrls.map(url => ({ url }))
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30_000)

  let res: Response
  try {
    res = await fetch('https://zernio.com/api/v1/posts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Zernio ${res.status}: ${text}`)
  }
}
```

- [ ] **Step 2: Update the publish route**

In `src/app/api/posts/[id]/publish/route.ts`, replace the `imageUrl` logic (lines 52–58) with:

```typescript
const source = postRow.source as PostSource | null
let mediaUrls: string[] | undefined
if (source?.kind === 'shopify') {
  const urls = source.selectedImageIndices.map(i => source.images[i]).filter(Boolean) as string[]
  if (urls.length) mediaUrls = urls
} else if (source?.kind === 'upload') {
  if (source.mediaUrls.length) mediaUrls = source.mediaUrls
}
```

And update the `scheduleZernioPost` call (line 62) to:
```typescript
await scheduleZernioPost({ content, scheduledFor: scheduledAt, mediaUrls })
```

The full updated publish route (`src/app/api/posts/[id]/publish/route.ts`):

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
  let scheduledAt: string
  try {
    const body = await request.json() as { scheduledAt: string }
    scheduledAt = body.scheduledAt
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!scheduledAt || isNaN(Date.parse(scheduledAt))) {
    return NextResponse.json({ error: 'Ongeldige scheduledAt waarde' }, { status: 400 })
  }

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
  let mediaUrls: string[] | undefined
  if (source?.kind === 'shopify') {
    const urls = source.selectedImageIndices.map(i => source.images[i]).filter(Boolean) as string[]
    if (urls.length) mediaUrls = urls
  } else if (source?.kind === 'upload') {
    if (source.mediaUrls.length) mediaUrls = source.mediaUrls
  }

  const content = assembleCaption(caption)

  try {
    await scheduleZernioPost({ content, scheduledFor: scheduledAt, mediaUrls })
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

- [ ] **Step 3: Run all tests**

```bash
npm test -- --run
```

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/zernio/client.ts src/app/api/posts/[id]/publish/route.ts
git commit -m "feat: send full media array to Zernio for carousel publishing"
```

---

## Task 5: Create MultiPhotoSelector component

**Files:**
- Create: `src/components/editor/MultiPhotoSelector.tsx`

Context: Replaces `PhotoSelector` (single-select). Tapping an unselected thumbnail appends it; tapping a selected thumbnail removes it and re-numbers the rest. At 10 selected, unselected thumbnails become visually disabled. Selected thumbnails show a 1-based position badge in bordeaux.

- [ ] **Step 1: Create `src/components/editor/MultiPhotoSelector.tsx`**

```typescript
'use client'

const MAX_PHOTOS = 10

type Props = {
  images: string[]
  selectedIndices: number[]
  onChange: (indices: number[]) => void
}

export function MultiPhotoSelector({ images, selectedIndices, onChange }: Props) {
  const atLimit = selectedIndices.length >= MAX_PHOTOS

  function toggle(i: number) {
    const pos = selectedIndices.indexOf(i)
    if (pos === -1) {
      if (atLimit) return
      onChange([...selectedIndices, i])
    } else {
      onChange(selectedIndices.filter(idx => idx !== i))
    }
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex gap-2 px-3 py-2 w-max">
        {images.map((url, i) => {
          const pos = selectedIndices.indexOf(i)
          const isSelected = pos !== -1
          const isDisabled = atLimit && !isSelected
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              className={[
                'relative flex-shrink-0 w-12 h-16 rounded overflow-hidden border-2 transition-all',
                isSelected ? 'border-woody-bordeaux opacity-100' : 'border-transparent opacity-60',
                isDisabled ? 'opacity-30 pointer-events-none' : '',
              ].join(' ')}
            >
              <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
              {isSelected && (
                <span className="absolute top-0.5 right-0.5 bg-woody-bordeaux text-woody-cream text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {pos + 1}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run all tests**

```bash
npm test -- --run
```

Expected: all PASS (new file has no test, but no regressions).

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/MultiPhotoSelector.tsx
git commit -m "feat: add MultiPhotoSelector component with position badges and 10-photo limit"
```

---

## Task 6: Update UploadPicker for multi-file

**Files:**
- Modify: `src/components/editor/UploadPicker.tsx`

Context: Currently accepts a single file. Must accept multiple files (up to 10). Preview changes from a single image to a horizontal thumbnails row. All files are uploaded in parallel to Supabase Storage. If the create-upload API call fails, all uploaded files are cleaned up. `mediaType` is determined by the first file only (for caption generation).

- [ ] **Step 1: Replace `src/components/editor/UploadPicker.tsx`**

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
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [overLimitWarning, setOverLimitWarning] = useState(false)
  const [userPrompt, setUserPrompt] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    if (selected.length === 0) return
    setPreviews(prev => { prev.forEach(p => { if (p) URL.revokeObjectURL(p) }); return [] })
    const capped = selected.slice(0, 10)
    setOverLimitWarning(selected.length > 10)
    setFiles(capped)
    setPreviews(capped.map(f => f.type.startsWith('video/') ? '' : URL.createObjectURL(f)))
    setError(null)
  }

  function reset() {
    setPreviews(prev => { prev.forEach(p => { if (p) URL.revokeObjectURL(p) }); return [] })
    setFiles([])
    setOverLimitWarning(false)
    setUserPrompt('')
    setError(null)
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleAdd() {
    if (files.length === 0) return
    setUploading(true)
    setError(null)

    const supabase = createClient()
    const uploads = files.map(file => {
      const ext = file.name.split('.').pop() ?? 'bin'
      return { file, path: `${crypto.randomUUID()}.${ext}` }
    })

    try {
      const mediaUrls = await Promise.all(uploads.map(async ({ file, path }) => {
        const { error: uploadError } = await supabase.storage
          .from('post-media')
          .upload(path, file)
        if (uploadError) throw new Error(uploadError.message)
        return supabase.storage.from('post-media').getPublicUrl(path).data.publicUrl
      }))

      const mediaType: 'image' | 'video' = files[0].type.startsWith('video/') ? 'video' : 'image'

      const res = await fetch('/api/posts/create-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaUrls, mediaType, userPrompt, position }),
      })
      if (!res.ok) {
        supabase.storage.from('post-media').remove(uploads.map(u => u.path)).catch(() => {})
        throw new Error(`${res.status}`)
      }
      const post = await res.json() as Post

      fetch(`/api/posts/${post.id}/generate-caption`, { method: 'POST' }).catch(() => {})

      onCreated(post)
      reset()
      onClose()
    } catch {
      supabase.storage.from('post-media').remove(uploads.map(u => u.path)).catch(() => {})
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
          {files.length === 0 ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full aspect-square max-h-48 border-2 border-dashed border-woody-taupe/40 rounded-xl flex items-center justify-center text-sm text-woody-taupe"
            >
              {"Tik om foto's of video's te kiezen"}
            </button>
          ) : (
            <div className="relative">
              <div className="w-full overflow-x-auto">
                <div className="flex gap-2 py-2 w-max">
                  {files.map((file, i) => (
                    <div key={i} className="flex-shrink-0 w-20 h-24 rounded-xl overflow-hidden bg-woody-beige">
                      {file.type.startsWith('video/') ? (
                        <div className="w-full h-full flex items-center justify-center px-1">
                          <p className="text-[10px] text-woody-taupe text-center break-all">{file.name}</p>
                        </div>
                      ) : (
                        <img
                          src={previews[i]}
                          alt={`Preview ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={reset}
                className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full"
              >
                Wijzig
              </button>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {overLimitWarning && (
            <p className="text-xs text-woody-taupe">Maximaal 10 bestanden — de rest is weggelaten.</p>
          )}

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
          type="button"
          onClick={handleAdd}
          disabled={files.length === 0 || uploading}
          className="mt-4 shrink-0 w-full bg-woody-bordeaux text-woody-cream text-sm font-bold py-3 rounded-xl disabled:opacity-40"
        >
          {uploading ? 'Uploaden...' : 'Toevoegen'}
        </button>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Run all tests**

```bash
npm test -- --run
```

Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/UploadPicker.tsx
git commit -m "feat: add multi-file upload support to UploadPicker"
```

---

## Task 7: Update editor page and remove PhotoSelector

**Files:**
- Modify: `src/app/grid/[postId]/page.tsx`
- Delete: `src/components/editor/PhotoSelector.tsx`

Context: The editor page must (1) compute the cover URL from the first element of `selectedImageIndices` / `mediaUrls`, (2) swap `<PhotoSelector>` for `<MultiPhotoSelector>`, and (3) update the save handler to write `selectedImageIndices` (array) not `selectedImageIndex`. After the page is updated, `PhotoSelector.tsx` can be deleted.

- [ ] **Step 1: Update imports in `src/app/grid/[postId]/page.tsx`**

Change line 10 from:
```typescript
import { PhotoSelector } from '@/components/editor/PhotoSelector'
```
to:
```typescript
import { MultiPhotoSelector } from '@/components/editor/MultiPhotoSelector'
```

- [ ] **Step 2: Update the cover URL computation**

Change lines 96–98 (the `imageUrl` constant) from:
```typescript
const imageUrl = post.source.kind === 'shopify'
  ? post.source.images[post.source.selectedImageIndex]
  : post.source.mediaUrl
```
to:
```typescript
const imageUrl = post.source.kind === 'shopify'
  ? post.source.images[post.source.selectedImageIndices[0]] ?? post.source.images[0]
  : post.source.mediaUrls[0]
```

- [ ] **Step 3: Replace `<PhotoSelector>` with `<MultiPhotoSelector>`**

Change lines 159–168 from:
```typescript
{isShopify && post.source.kind === 'shopify' && (
  <PhotoSelector
    images={post.source.images}
    selectedIndex={post.source.selectedImageIndex}
    onChange={(selectedImageIndex) => {
      if (post.source?.kind !== 'shopify') return
      save({ source: { ...post.source, selectedImageIndex } })
    }}
  />
)}
```
to:
```typescript
{isShopify && post.source.kind === 'shopify' && (
  <MultiPhotoSelector
    images={post.source.images}
    selectedIndices={post.source.selectedImageIndices}
    onChange={(selectedImageIndices) => {
      if (post.source?.kind !== 'shopify') return
      save({ source: { ...post.source, selectedImageIndices } })
    }}
  />
)}
```

- [ ] **Step 4: Run all tests**

```bash
npm test -- --run
```

Expected: all PASS.

- [ ] **Step 5: Delete `PhotoSelector.tsx`**

```bash
rm src/components/editor/PhotoSelector.tsx
```

- [ ] **Step 6: Run all tests again**

```bash
npm test -- --run
```

Expected: all PASS (no test imported PhotoSelector).

- [ ] **Step 7: Commit**

```bash
git add src/app/grid/[postId]/page.tsx
git rm src/components/editor/PhotoSelector.tsx
git commit -m "feat: swap PhotoSelector for MultiPhotoSelector in editor, update cover URL"
```

---

## Self-review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| `selectedImageIndex → selectedImageIndices: number[]` | Task 1 |
| `mediaUrl → mediaUrls: string[]` | Task 1 |
| SQL migration for existing rows | Task 2 |
| `MultiPhotoSelector` with tap-to-add, tap-to-remove, renumber | Task 5 |
| Max 10 selection; opacity-30 + pointer-events-none at limit | Task 5 |
| Bordeaux border + position badge on selected thumbnails | Task 5 |
| `PhotoSelector` deleted | Task 7 |
| `UploadPicker` with `<input multiple>` | Task 6 |
| Max 10 files (extras ignored with warning) | Task 6 |
| Parallel uploads + cleanup on failure | Task 6 |
| `mediaType` = type of first file | Task 6 |
| `create-product` default `selectedImageIndices: [1]` | Task 3 |
| `create-upload` accepts `mediaUrls: string[]` | Task 3 |
| `generate-caption` cover from `selectedImageIndices[0]` / `mediaUrls[0]` | Task 1 (in `buildUserContent` / `buildUploadUserContent`) |
| `publish` sends all selected URLs to Zernio | Task 4 |
| Zernio client `mediaUrls?: string[]` | Task 4 |
| Editor cover URL from array | Task 7 |
| Upload-posts show no selector in editor (order fixed at upload) | Task 7 (only Shopify gets `MultiPhotoSelector`) |

All requirements covered.

**Placeholder scan:** No TBDs, no "handle edge cases" without code, no "similar to Task N" shortcuts. All code is complete.

**Type consistency:** `selectedImageIndices` used throughout (Tasks 1, 3, 4, 5, 7). `mediaUrls` used throughout (Tasks 1, 3, 4, 6, 7). `MultiPhotoSelector` prop `selectedIndices: number[]` matches all callsites.

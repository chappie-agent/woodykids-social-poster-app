# Grid feed zones, browser-local concepten, unlock-flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the grid into a chronological Instagram-style feed with four zones (add-tile, concepten, geplande, live), drop draft persistence, and add a Zernio-backed unlock flow that refunds quota.

**Architecture:** Concepten worden alleen in de Zustand `gridStore` bewaard (refresh wist). DB bevat alleen locked posts; "live" wordt afgeleid uit `scheduled_at < now()`. Publish gaat eerst naar Zernio en pas bij succes naar Supabase, met opslag van `zernio_post_id`. Unlock cancelt bij Zernio (refundt quota) en wist de DB-rij; de post leeft daarna als concept verder.

**Tech Stack:** Next.js 16 (App Router), React 19, Zustand 5, Supabase, @dnd-kit, Vitest, Playwright. Zernio REST API.

**Belangrijk vooraf:** Dit project gebruikt Next.js 16 — lees `node_modules/next/dist/docs/` voor je nieuwe routes of conventies aanraakt; APIs en file-structuur kunnen afwijken van wat je kent.

---

## File Structure

**Aanmaken:**
- `supabase/migrations/004_grid_feed_zones.sql` — schema cleanup + `zernio_post_id`.
- `src/app/api/posts/[id]/unlock/route.ts` — POST endpoint: cancel bij Zernio + delete row.
- `src/components/grid/AddTile.tsx` — vaste linksboven-tegel, opent SourcePicker.
- `src/lib/grid/sorting.ts` — pure helper `sortPostsForFeed(posts)` voor zone-volgorde.
- `tests/lib/grid/sorting.test.ts` — vitest unit tests voor sortering.
- `tests/lib/zernio/client.test.ts` — vitest unit tests voor schedule (return id) + cancel.
- `e2e/grid-feed-zones.spec.ts` — Playwright e2e voor render-volgorde + add-tile flow.
- `e2e/unlock-flow.spec.ts` — Playwright e2e voor unlock met gemockte Zernio.

**Wijzigen:**
- `src/lib/types.ts` — `PostState` versmallen tot `'locked'`; `Post` krijgt optionele `zernioPostId`.
- `src/lib/zernio/client.ts` — `scheduleZernioPost` retourneert `string` (Zernio post `_id`); nieuwe `cancelZernioPost(id)`.
- `src/lib/store/gridStore.ts` — `detectConflicts` weg, `conflictIds` weg; `setPosts` en `updatePost` gestript.
- `src/app/api/posts/route.ts` — order by `scheduled_at desc`; mappost neemt `zernio_post_id` mee.
- `src/app/api/posts/generate/route.ts` — geen DB-interactie; geen `startPosition` in body.
- `src/app/api/posts/[id]/publish/route.ts` — Zernio first, dan INSERT met `state='locked'` en `zernio_post_id`.
- `src/app/api/posts/[id]/route.ts` — PUT-handler verwijderen; GET en DELETE blijven.
- `src/app/api/posts/[id]/generate-caption/route.ts` — DB-update verwijderen (concepten zitten niet in DB).
- `src/app/grid/page.tsx` — initial fetch laadt alleen DB-posts; geen empty-seeding.
- `src/app/grid/[postId]/page.tsx` — `save()` doet alleen Zustand-update; locked posts in read-only modus met "Unlock"-CTA.
- `src/components/grid/PostGrid.tsx` — gebruik `sortPostsForFeed`; render add-tile op index 0; drag alleen binnen concept-indices.
- `src/components/grid/PostCell.tsx` — varianten voor concept / planned / live; "Unlock"-button op planned.
- `src/components/grid/FillButton.tsx` — "Voeg 9 toe", altijd zichtbaar, voegt 9 concepten toe aan store.
- `src/components/grid/ConflictBanner.tsx` en `ConflictActionSheet.tsx` — gebruiken weghalen uit `grid/page.tsx` (logica is overbodig in nieuwe model).

**Verwijderen of leegmaken (na refactor — gebeurt in de tasks):**
- `ConflictBanner` en `ConflictActionSheet` worden niet meer gerenderd; bestand kan blijven staan tot een latere cleanup.

---

### Task 1: DB-migratie en cleanup van bestaande draft-rijen

**Files:**
- Create: `supabase/migrations/004_grid_feed_zones.sql`

- [ ] **Step 1: Schrijf de migratie**

```sql
-- supabase/migrations/004_grid_feed_zones.sql

-- 1. Verwijder alle niet-locked rijen (concepten leven vanaf nu in de browser).
delete from posts where state <> 'locked';

-- 2. Voeg kolom voor Zernio post-id toe (nullable, want oude rijen kennen 'm niet).
alter table posts add column if not exists zernio_post_id text;

-- 3. Versmal de state-check tot alleen 'locked'.
alter table posts drop constraint if exists posts_state_check;
alter table posts add constraint posts_state_check check (state = 'locked');

-- 4. position is irrelevant voor locked posts (sortering volgt scheduled_at).
--    Maak nullable en drop unique-constraint zodat we 'm niet meer hoeven te zetten.
alter table posts alter column position drop not null;
alter table posts drop constraint if exists posts_position_key;
```

- [ ] **Step 2: Migratie toepassen op het Supabase-project**

Gebruik de Supabase MCP `apply_migration` tool met `project_id="nkrsfxugnxkfcfpjcbme"` en de inhoud uit step 1 (zonder de `-- file header` regel als die problemen geeft).

Verwacht: `success: true`. Controleer met:

```sql
select column_name, is_nullable from information_schema.columns where table_name='posts';
```

Verifieer dat `zernio_post_id` bestaat en `position` nullable is.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/004_grid_feed_zones.sql
git commit -m "feat(db): drop draft persistence, add zernio_post_id column"
```

---

### Task 2: Type-aanpassingen — PostState, zernioPostId

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Lees de huidige types om de exacte structuur te zien**

```bash
cat src/lib/types.ts | head -80
```

- [ ] **Step 2: Pas `PostState` en `Post` aan**

In `src/lib/types.ts`:

- Verwijder `'empty'`, `'draft'`, `'conflict'` uit `PostState`. Resultaat:

```ts
export type PostState = 'locked'
```

- Voeg `zernioPostId?: string` toe aan de `Post` type:

```ts
export type Post = {
  id: string
  state: PostState
  position: number | null
  source: PostSource | null
  cropData: CropData
  caption: PostCaption | null
  scheduledAt: string | null
  isPerson: boolean
  zernioPostId?: string
}
```

(Pas alleen aan wat hierboven staat; rest van het bestand intact laten. `position` wordt nullable omdat DB-rijen 'm niet meer dragen.)

- [ ] **Step 3: Type-check draaien — verwacht een hele lijst errors**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Verwacht: errors over `'draft'`, `'conflict'`, `'empty'` op talloze plekken. Dit is de roadmap voor de volgende taken — niet hier oplossen.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts
git commit -m "refactor(types): narrow PostState to 'locked', add zernioPostId"
```

---

### Task 3: Pure sorteer-helper voor de feed

**Files:**
- Create: `src/lib/grid/sorting.ts`
- Test: `tests/lib/grid/sorting.test.ts`

- [ ] **Step 1: Schrijf de failing test**

`tests/lib/grid/sorting.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { sortPostsForFeed, splitFeedZones } from '@/lib/grid/sorting'
import type { Post } from '@/lib/types'

const concept = (id: string): Post => ({
  id, state: 'locked' as never, position: null, source: null,
  cropData: { x: 0, y: 0, scale: 1 }, caption: null,
  scheduledAt: null, isPerson: false,
})

const planned = (id: string, when: string): Post => ({
  ...concept(id), scheduledAt: when, zernioPostId: 'z-' + id,
})

describe('splitFeedZones', () => {
  it('splits posts into concepts (no scheduledAt) and dated (with scheduledAt)', () => {
    const c1 = concept('c1')
    const p1 = planned('p1', '2030-01-01T10:00:00Z')
    const { concepts, dated } = splitFeedZones([p1, c1])
    expect(concepts).toEqual([c1])
    expect(dated).toEqual([p1])
  })
})

describe('sortPostsForFeed', () => {
  it('returns concepts first, then dated posts sorted by scheduledAt descending', () => {
    const now = new Date('2026-04-26T12:00:00Z')
    const c1 = concept('c1')
    const c2 = concept('c2')
    const future1 = planned('future1', '2030-01-01T00:00:00Z')
    const future2 = planned('future2', '2031-01-01T00:00:00Z')
    const past1 = planned('past1', '2020-01-01T00:00:00Z')

    const sorted = sortPostsForFeed([past1, future1, c1, future2, c2], now)

    expect(sorted.map(p => p.id)).toEqual(['c1', 'c2', 'future2', 'future1', 'past1'])
  })

  it('preserves the input order of concepts (no implicit sort)', () => {
    const c1 = concept('c1')
    const c2 = concept('c2')
    const c3 = concept('c3')
    const sorted = sortPostsForFeed([c2, c1, c3], new Date())
    expect(sorted.map(p => p.id)).toEqual(['c2', 'c1', 'c3'])
  })
})
```

- [ ] **Step 2: Run de test, verifieer dat 'ie faalt**

```bash
npm run test:run -- tests/lib/grid/sorting.test.ts
```

Verwacht: FAIL — module bestaat niet.

- [ ] **Step 3: Implementeer de helper**

`src/lib/grid/sorting.ts`:

```ts
import type { Post } from '@/lib/types'

export function splitFeedZones(posts: Post[]): { concepts: Post[]; dated: Post[] } {
  const concepts: Post[] = []
  const dated: Post[] = []
  for (const p of posts) {
    if (p.scheduledAt) dated.push(p)
    else concepts.push(p)
  }
  return { concepts, dated }
}

export function sortPostsForFeed(posts: Post[], _now: Date = new Date()): Post[] {
  const { concepts, dated } = splitFeedZones(posts)
  const datedSorted = [...dated].sort((a, b) => {
    const at = a.scheduledAt ? Date.parse(a.scheduledAt) : 0
    const bt = b.scheduledAt ? Date.parse(b.scheduledAt) : 0
    return bt - at
  })
  return [...concepts, ...datedSorted]
}

export function isLivePost(post: Post, now: Date = new Date()): boolean {
  if (!post.scheduledAt) return false
  return Date.parse(post.scheduledAt) < now.getTime()
}

export function isPlannedPost(post: Post, now: Date = new Date()): boolean {
  if (!post.scheduledAt) return false
  return Date.parse(post.scheduledAt) >= now.getTime()
}
```

- [ ] **Step 4: Run tests, verifieer pass**

```bash
npm run test:run -- tests/lib/grid/sorting.test.ts
```

Verwacht: alle 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/grid/sorting.ts tests/lib/grid/sorting.test.ts
git commit -m "feat(grid): pure sortPostsForFeed and zone helpers"
```

---

### Task 4: Zernio client — schedule retourneert id, nieuwe cancel

**Files:**
- Modify: `src/lib/zernio/client.ts`
- Test: `tests/lib/zernio/client.test.ts`

- [ ] **Step 1: Schrijf failing tests**

`tests/lib/zernio/client.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests, verifieer dat ze falen**

```bash
npm run test:run -- tests/lib/zernio/client.test.ts
```

Verwacht: tests falen — `cancelZernioPost` bestaat niet, `scheduleZernioPost` retourneert `void`.

- [ ] **Step 3: Vervang `src/lib/zernio/client.ts`**

```ts
type ZernioPostInput = {
  content: string
  scheduledFor: string
  mediaUrls?: string[]
}

function getApiKey(): string {
  const key = process.env.ZERNIO_API_KEY
  if (!key) throw new Error('ZERNIO_API_KEY is not set')
  return key
}

export async function scheduleZernioPost(input: ZernioPostInput): Promise<string> {
  const apiKey = getApiKey()
  const instagramId = process.env.ZERNIO_INSTAGRAM_ACCOUNT_ID
  const facebookId = process.env.ZERNIO_FACEBOOK_ACCOUNT_ID

  const platforms: Array<{ platform: string; accountId: string }> = []
  if (instagramId) platforms.push({ platform: 'instagram', accountId: instagramId })
  if (facebookId) platforms.push({ platform: 'facebook', accountId: facebookId })
  if (platforms.length === 0) throw new Error('No Zernio platform account IDs configured')

  const body: Record<string, unknown> = {
    content: input.content,
    scheduledFor: input.scheduledFor,
    platforms,
  }
  if (input.mediaUrls?.length) {
    body.mediaItems = input.mediaUrls.map(url => ({ type: 'image', url }))
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30_000)

  let res: Response
  try {
    res = await fetch('https://zernio.com/api/v1/posts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
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

  const json = await res.json() as { post?: { _id?: string } }
  const id = json.post?._id
  if (!id) throw new Error('Zernio response did not include post._id')
  return id
}

export async function cancelZernioPost(zernioPostId: string): Promise<void> {
  const apiKey = getApiKey()

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30_000)

  let res: Response
  try {
    res = await fetch(`https://zernio.com/api/v1/posts?postId=${encodeURIComponent(zernioPostId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
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

- [ ] **Step 4: Run tests, verifieer pass**

```bash
npm run test:run -- tests/lib/zernio/client.test.ts
```

Verwacht: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/zernio/client.ts tests/lib/zernio/client.test.ts
git commit -m "feat(zernio): return post _id from schedule, add cancelZernioPost"
```

---

### Task 5: Publish-route herordenen — Zernio first, dan INSERT

**Files:**
- Modify: `src/app/api/posts/[id]/publish/route.ts`

- [ ] **Step 1: Vervang het bestand**

`src/app/api/posts/[id]/publish/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scheduleZernioPost } from '@/lib/zernio/client'
import { assembleCaption } from '@/lib/zernio/format'
import type { Post, PostState, PostSource, CropData, PostCaption } from '@/lib/types'

type PublishBody = {
  scheduledAt: string
  post: Post
}

function mapPost(row: Record<string, unknown>): Post {
  return {
    id: row.id as string,
    state: row.state as PostState,
    position: (row.position as number | null) ?? null,
    source: (row.source as PostSource) ?? null,
    cropData: (row.crop_data as CropData) ?? { x: 0, y: 0, scale: 1 },
    caption: (row.caption as PostCaption) ?? null,
    scheduledAt: (row.scheduled_at as string) ?? null,
    isPerson: Boolean(row.is_person),
    zernioPostId: (row.zernio_post_id as string) ?? undefined,
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  let body: PublishBody
  try {
    body = await request.json() as PublishBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { scheduledAt, post: clientPost } = body
  if (!scheduledAt || isNaN(Date.parse(scheduledAt))) {
    return NextResponse.json({ error: 'Ongeldige scheduledAt waarde' }, { status: 400 })
  }
  if (!clientPost) {
    return NextResponse.json({ error: 'Post snapshot ontbreekt' }, { status: 400 })
  }
  if (!clientPost.caption) {
    return NextResponse.json({ error: 'Geen caption beschikbaar' }, { status: 400 })
  }

  // Bouw media-URLs op uit de client-snapshot.
  const source = clientPost.source
  let mediaUrls: string[] | undefined
  if (source?.kind === 'shopify') {
    const indices = source.selectedImageIndices ?? [0]
    const urls = indices.map(i => source.images[i]).filter((url): url is string => typeof url === 'string')
    if (urls.length) mediaUrls = urls
  } else if (source?.kind === 'upload') {
    if (source.mediaUrls?.length) mediaUrls = source.mediaUrls
  }

  const content = assembleCaption(clientPost.caption)

  // 1. Zernio eerst — als dit faalt komt er niks in de DB.
  let zernioPostId: string
  try {
    zernioPostId = await scheduleZernioPost({ content, scheduledFor: scheduledAt, mediaUrls })
  } catch (err) {
    console.error('[publish] Zernio error:', err)
    return NextResponse.json({ error: 'Inplannen bij Zernio mislukt' }, { status: 500 })
  }

  // 2. Pas bij Zernio-success: INSERT in Supabase met state='locked'.
  const supabase = await createClient()
  const insertRow = {
    id,
    state: 'locked' as const,
    position: null,
    source: clientPost.source,
    crop_data: clientPost.cropData,
    caption: clientPost.caption,
    scheduled_at: scheduledAt,
    is_person: clientPost.isPerson,
    zernio_post_id: zernioPostId,
  }

  const { data, error } = await supabase.from('posts').insert(insertRow).select()
  if (error) {
    // Best effort: rollback Zernio. We loggen de fout maar geven 'm niet door — quota verspilling
    // is erger dan een verloren error message.
    console.error('[publish] Supabase insert error:', error.message)
    return NextResponse.json({ error: 'Opslaan in DB mislukt — Zernio post is wel ingepland' }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Post kon niet worden opgeslagen' }, { status: 500 })
  }

  return NextResponse.json(mapPost(data[0]))
}
```

- [ ] **Step 2: Type-check de wijziging**

```bash
npx tsc --noEmit src/app/api/posts/[id]/publish/route.ts 2>&1 | head -20
```

Verwacht: geen errors specifiek voor dit bestand (overige errors uit Task 2 mag je negeren).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/posts/[id]/publish/route.ts
git commit -m "fix(publish): call Zernio first, INSERT only on success with zernio_post_id"
```

---

### Task 6: Generate-route ontkoppelen van DB

**Files:**
- Modify: `src/app/api/posts/generate/route.ts`

- [ ] **Step 1: Vervang het bestand**

`src/app/api/posts/generate/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getProducts } from '@/lib/shopify/client'
import { tokenize, isTooSimilar } from '@/lib/shopify/similarity'
import type { Post, PostCaption, ShopifyProduct } from '@/lib/types'
import { randomUUID } from 'crypto'

const makeCaption = (): PostCaption => ({
  opener: { variants: ['Opener variant 1.', 'Opener variant 2.', 'Opener variant 3.'], selected: 0 },
  middle: { variants: ['Middenstuk variant 1.', 'Middenstuk variant 2.', 'Middenstuk variant 3.'], selected: 0 },
  closer: { variants: ['Afsluiter variant 1.', 'Afsluiter variant 2.', 'Afsluiter variant 3.'], selected: 0 },
  hashtags: [
    { text: '#woodykids', active: true },
    { text: '#houtenspeelgoed', active: true },
    { text: '#naturelspelen', active: true },
    { text: '#duurzaamspeelgoed', active: false },
    { text: '#kidstoys', active: false },
  ],
})

export async function POST(request: NextRequest) {
  const { count, existingProductIds } = await request.json() as {
    count: number
    existingProductIds?: string[]
  }

  let products: ShopifyProduct[]
  try {
    products = (await getProducts()).filter(p => p.images.length >= 2)
  } catch (err) {
    console.error('[/api/posts/generate] Shopify fetch failed', err)
    return NextResponse.json({ error: 'Failed to fetch Shopify products' }, { status: 502 })
  }

  if (products.length === 0) {
    return NextResponse.json({ error: 'No Shopify products with images available' }, { status: 404 })
  }

  const shuffled = [...products].sort(() => Math.random() - 0.5)

  const existingTokens: Set<string>[] = []
  if (existingProductIds && existingProductIds.length > 0) {
    const existingSet = new Set(existingProductIds)
    for (const p of products) if (existingSet.has(p.id)) existingTokens.push(tokenize(p.title))
  }

  const picked: ShopifyProduct[] = []
  const pickedTokens: Set<string>[] = [...existingTokens]
  for (const p of shuffled) {
    if (picked.length >= count) break
    const tokens = tokenize(p.title)
    if (isTooSimilar(tokens, pickedTokens)) continue
    picked.push(p)
    pickedTokens.push(tokens)
  }
  if (picked.length < count) {
    const have = new Set(picked.map(p => p.id))
    for (const p of shuffled) {
      if (picked.length >= count) break
      if (!have.has(p.id)) picked.push(p)
    }
  }

  // Concepten: geen state, geen position — leven puur in de browser-store.
  const newPosts: Post[] = Array.from({ length: count }, (_, i) => {
    const product = picked[i % picked.length]
    const isPerson = i % 2 === 0
    const selectedImageIndices = Array.from(
      { length: Math.min(5, product.images.length - 1) },
      (_, k) => k + 1,
    )
    return {
      id: randomUUID(),
      state: 'locked', // Niet relevant voor concepten; UI toont op basis van scheduledAt=null.
      position: null,
      isPerson,
      source: {
        kind: 'shopify',
        productId: product.id,
        productTitle: product.title,
        images: product.images,
        selectedImageIndices,
      },
      cropData: { x: 0, y: 0, scale: 1 },
      caption: makeCaption(),
      scheduledAt: null,
    }
  })

  return NextResponse.json(newPosts)
}
```

Opmerking: `state: 'locked'` is hier puur een type-conform placeholder; de UI bepaalt het concept-zijn aan `scheduledAt === null`. Geen Supabase-call.

- [ ] **Step 2: Commit**

```bash
git add src/app/api/posts/generate/route.ts
git commit -m "refactor(generate): return concept objects without DB persistence"
```

---

### Task 7: Posts-list route — sorteer op scheduled_at desc, neem zernio_post_id mee

**Files:**
- Modify: `src/app/api/posts/route.ts`

- [ ] **Step 1: Vervang het bestand**

```ts
// src/app/api/posts/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Post, PostState, PostSource, CropData, PostCaption } from '@/lib/types'

function mapPost(row: Record<string, unknown>): Post {
  return {
    id: row.id as string,
    state: row.state as PostState,
    position: (row.position as number | null) ?? null,
    source: (row.source as PostSource) ?? null,
    cropData: (row.crop_data as CropData) ?? { x: 0, y: 0, scale: 1 },
    caption: (row.caption as PostCaption) ?? null,
    scheduledAt: (row.scheduled_at as string) ?? null,
    isPerson: Boolean(row.is_person),
    zernioPostId: (row.zernio_post_id as string) ?? undefined,
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('scheduled_at', { ascending: false })

  if (error) {
    console.error('[/api/posts] Supabase error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json((data ?? []).map(mapPost))
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/posts/route.ts
git commit -m "refactor(posts): sort by scheduled_at desc, expose zernio_post_id"
```

---

### Task 8: Verwijder PUT en stript GET in posts/[id]/route.ts

**Files:**
- Modify: `src/app/api/posts/[id]/route.ts`

- [ ] **Step 1: Vervang het bestand**

```ts
// src/app/api/posts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Post, PostState, PostSource, CropData, PostCaption } from '@/lib/types'

function mapPost(row: Record<string, unknown>): Post {
  return {
    id: row.id as string,
    state: row.state as PostState,
    position: (row.position as number | null) ?? null,
    source: (row.source as PostSource) ?? null,
    cropData: (row.crop_data as CropData) ?? { x: 0, y: 0, scale: 1 },
    caption: (row.caption as PostCaption) ?? null,
    scheduledAt: (row.scheduled_at as string) ?? null,
    isPerson: Boolean(row.is_person),
    zernioPostId: (row.zernio_post_id as string) ?? undefined,
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase.from('posts').select('*').eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(mapPost(data[0]))
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { error } = await supabase.from('posts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: id })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/posts/[id]/route.ts
git commit -m "refactor(posts): remove PUT — concepten leven in browser, niet in DB"
```

---

### Task 9: Generate-caption route — geen DB-update meer

**Files:**
- Modify: `src/app/api/posts/[id]/generate-caption/route.ts`

- [ ] **Step 1: Vereenvoudig de route — caption komt altijd terug, geen DB write**

Vervang de inhoud van `src/app/api/posts/[id]/generate-caption/route.ts`:

```ts
// src/app/api/posts/[id]/generate-caption/route.ts
import { NextRequest, NextResponse } from 'next/server'
import type Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAnthropicClient } from '@/lib/anthropic/client'
import { buildSystemPrompt, buildUserContent, buildUploadUserContent, parseCaptionResponse } from '@/lib/anthropic/caption'
import type { PostSource, PostCaption } from '@/lib/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const body = await request.json().catch(() => ({})) as { source?: PostSource }
  const source = body.source ?? null

  if (!source || (source.kind !== 'shopify' && source.kind !== 'upload')) {
    return NextResponse.json({ error: 'Source ontbreekt of is ongeldig' }, { status: 400 })
  }

  // Tone of voice ophalen — best effort, leeg bij fout.
  let toneOfVoice = ''
  try {
    const supabase = await createClient()
    const { data } = await supabase.from('settings').select('tone_of_voice').eq('id', 1)
    toneOfVoice = data?.[0]?.tone_of_voice ?? ''
  } catch (err) {
    console.warn('[generate-caption] kon tone of voice niet laden:', err)
  }

  let responseText: string
  try {
    const anthropic = createAnthropicClient()
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: buildSystemPrompt(toneOfVoice),
      messages: [
        {
          role: 'user',
          content: (source.kind === 'shopify'
            ? buildUserContent(source)
            : buildUploadUserContent(source)
          ) as Anthropic.ContentBlockParam[],
        },
      ],
    })
    const block = response.content[0]
    responseText = block.type === 'text' ? block.text : ''
  } catch (err) {
    console.error('[generate-caption] Anthropic error:', err)
    return NextResponse.json({ error: 'AI generatie mislukt' }, { status: 500 })
  }

  let caption: PostCaption
  try {
    caption = parseCaptionResponse(responseText)
  } catch (err) {
    console.error('[generate-caption] Parse error:', err, 'Raw:', responseText)
    return NextResponse.json({ error: 'Ongeldige AI-response' }, { status: 500 })
  }

  return NextResponse.json({ id, caption })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/posts/[id]/generate-caption/route.ts
git commit -m "refactor(generate-caption): drop DB update, return caption only"
```

---

### Task 10: Unlock-endpoint

**Files:**
- Create: `src/app/api/posts/[id]/unlock/route.ts`

- [ ] **Step 1: Maak het bestand**

```ts
// src/app/api/posts/[id]/unlock/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cancelZernioPost } from '@/lib/zernio/client'
import type { Post, PostState, PostSource, CropData, PostCaption } from '@/lib/types'

function mapPost(row: Record<string, unknown>): Post {
  return {
    id: row.id as string,
    state: row.state as PostState,
    position: (row.position as number | null) ?? null,
    source: (row.source as PostSource) ?? null,
    cropData: (row.crop_data as CropData) ?? { x: 0, y: 0, scale: 1 },
    caption: (row.caption as PostCaption) ?? null,
    scheduledAt: (row.scheduled_at as string) ?? null,
    isPerson: Boolean(row.is_person),
    zernioPostId: (row.zernio_post_id as string) ?? undefined,
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: rows, error: fetchError } = await supabase.from('posts').select('*').eq('id', id)
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!rows || rows.length === 0) return NextResponse.json({ error: 'Post niet gevonden' }, { status: 404 })

  const row = rows[0]
  const scheduledAt = row.scheduled_at as string | null
  if (scheduledAt && Date.parse(scheduledAt) < Date.now()) {
    return NextResponse.json({ error: 'Live posts kun je niet unlocken' }, { status: 409 })
  }

  const zernioPostId = row.zernio_post_id as string | null
  if (zernioPostId) {
    try {
      await cancelZernioPost(zernioPostId)
    } catch (err) {
      console.error('[unlock] Zernio cancel error:', err)
      return NextResponse.json({ error: 'Zernio cancel mislukt — DB ongewijzigd' }, { status: 502 })
    }
  }

  const post = mapPost(row)
  // Snapshot teruggeven zodat de client 'm als concept in de store kan zetten.
  const concept: Post = { ...post, scheduledAt: null, zernioPostId: undefined }

  const { error: deleteError } = await supabase.from('posts').delete().eq('id', id)
  if (deleteError) {
    console.error('[unlock] DB delete error:', deleteError.message)
    return NextResponse.json({ error: 'DB delete mislukt — Zernio is wel gecanceld' }, { status: 500 })
  }

  return NextResponse.json(concept)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/posts/[id]/unlock/route.ts
git commit -m "feat(posts): unlock endpoint — cancel bij Zernio + delete DB row"
```

---

### Task 11: gridStore — strip conflicts/empty-logica

**Files:**
- Modify: `src/lib/store/gridStore.ts`

- [ ] **Step 1: Vervang het bestand**

```ts
import { create } from 'zustand'
import type { Post } from '@/lib/types'

type GridStore = {
  posts: Post[]
  draggingId: string | null
  setPosts: (posts: Post[]) => void
  addConcepts: (concepts: Post[]) => void
  removePost: (id: string) => void
  reorderConcepts: (orderedIds: string[]) => void
  setDragging: (id: string | null) => void
  updatePost: (id: string, patch: Partial<Post>) => void
}

export const useGridStore = create<GridStore>((set) => ({
  posts: [],
  draggingId: null,

  setPosts: (posts) => {
    const seen = new Set<string>()
    const unique = posts.filter(p => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })
    set({ posts: unique })
  },

  addConcepts: (concepts) => {
    set(state => {
      const existingIds = new Set(state.posts.map(p => p.id))
      const fresh = concepts.filter(c => !existingIds.has(c.id))
      // Concepten vooraan plaatsen — UI sorteert verder met sortPostsForFeed.
      return { posts: [...fresh, ...state.posts] }
    })
  },

  removePost: (id) => {
    set(state => ({ posts: state.posts.filter(p => p.id !== id) }))
  },

  reorderConcepts: (orderedIds) => {
    set(state => {
      const idIndex = new Map(orderedIds.map((id, i) => [id, i]))
      const concepts = state.posts.filter(p => p.scheduledAt === null)
      const dated = state.posts.filter(p => p.scheduledAt !== null)
      const reordered = [...concepts].sort((a, b) => {
        const ai = idIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER
        const bi = idIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER
        return ai - bi
      })
      return { posts: [...reordered, ...dated] }
    })
  },

  setDragging: (id) => set({ draggingId: id }),

  updatePost: (id, patch) => {
    set(state => ({
      posts: state.posts.map(p => p.id === id ? { ...p, ...patch } : p),
    }))
  },
}))
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/store/gridStore.ts
git commit -m "refactor(store): drop conflicts and empty-state logic, add concept helpers"
```

---

### Task 12: AddTile component

**Files:**
- Create: `src/components/grid/AddTile.tsx`

- [ ] **Step 1: Maak het component**

```tsx
'use client'

import { Plus } from 'lucide-react'

type Props = {
  onTap: () => void
}

export function AddTile({ onTap }: Props) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label="Voeg een post toe"
      className="aspect-[4/5] w-full bg-woody-beige/60 border-[1.5px] border-dashed border-woody-taupe/50 hover:border-woody-bordeaux hover:bg-woody-beige transition-colors flex flex-col items-center justify-center gap-1 cursor-pointer"
    >
      <Plus className="w-6 h-6 text-woody-taupe" strokeWidth={2} />
      <span className="text-[9px] font-bold text-woody-taupe uppercase tracking-wider">Voeg toe</span>
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/grid/AddTile.tsx
git commit -m "feat(grid): AddTile component — opens SourcePicker"
```

---

### Task 13: PostCell — varianten voor concept / planned / live + Unlock-knop

**Files:**
- Modify: `src/components/grid/PostCell.tsx`

- [ ] **Step 1: Vervang het bestand**

```tsx
import type { Post } from '@/lib/types'
import { isLivePost, isPlannedPost } from '@/lib/grid/sorting'

type Props = {
  post: Post
  isDragging?: boolean
  onTap?: () => void
  onRepick?: () => void
  isRepicking?: boolean
  onUnlock?: () => void
  isUnlocking?: boolean
}

function getImageUrl(post: Post): string | null {
  if (!post.source) return null
  if (post.source.kind === 'shopify') {
    const coverIndex = post.source.selectedImageIndices?.[0] ?? 0
    return post.source.images[coverIndex] ?? post.source.images[0]
  }
  return post.source.mediaUrls?.[0] ?? null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function PostCell({ post, isDragging, onTap, onRepick, isRepicking, onUnlock, isUnlocking }: Props) {
  const imageUrl = getImageUrl(post)
  const isConcept = post.scheduledAt === null
  const isLive = isLivePost(post)
  const isPlanned = isPlannedPost(post)

  return (
    <div
      className={[
        'aspect-[4/5] relative overflow-hidden select-none',
        post.isPerson ? 'bg-woody-taupe/50' : 'bg-woody-taupe/70',
        isDragging ? 'opacity-40' : '',
        isConcept ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
        isLive ? 'opacity-95' : '',
      ].join(' ')}
      onClick={isConcept || isPlanned ? onTap : undefined}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt={post.source?.kind === 'shopify' ? post.source.productTitle : 'Eigen upload'}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            transform: `translate(${post.cropData.x * 100}%, ${post.cropData.y * 100}%) scale(${post.cropData.scale})`,
            transformOrigin: 'center',
          }}
          draggable={false}
        />
      )}

      {imageUrl && <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/40" />}

      {/* Re-pick (alleen voor concepten op shopify) */}
      {onRepick && isConcept && post.source?.kind === 'shopify' && (
        <button
          type="button"
          aria-label="Ander product kiezen"
          disabled={isRepicking}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onRepick() }}
          className="absolute top-1 right-1 z-20 w-6 h-6 rounded-full bg-black/55 hover:bg-black/75 text-white flex items-center justify-center shadow-md backdrop-blur-sm cursor-pointer"
        >
          {isRepicking ? (
            <span className="block w-3 h-3 border-[1.5px] border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
              <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M3 21v-5h5" />
            </svg>
          )}
        </button>
      )}

      {/* Concept badge */}
      {isConcept && (
        <div className="absolute top-1 left-1 bg-woody-bordeaux/85 rounded-[3px] px-1 py-0.5 text-[7px] font-bold text-woody-cream">
          concept
        </div>
      )}

      {/* Planned: lock icon + date + unlock-knop */}
      {isPlanned && (
        <>
          <div className="absolute top-1 right-1 text-[11px] leading-none">🔒</div>
          {onUnlock && (
            <button
              type="button"
              aria-label="Unlock om te editen"
              disabled={isUnlocking}
              onClick={(e) => { e.stopPropagation(); onUnlock() }}
              className="absolute top-1 left-1 z-20 bg-woody-cream/95 hover:bg-woody-cream rounded-[3px] px-1.5 py-0.5 text-[8px] font-bold text-woody-bordeaux shadow cursor-pointer disabled:opacity-50"
            >
              {isUnlocking ? '...' : 'Unlock'}
            </button>
          )}
          {post.scheduledAt && (
            <div className="absolute bottom-1 left-1 right-1 bg-woody-cream/90 rounded-[3px] px-1 py-0.5 text-[7px] font-bold text-woody-bordeaux text-center truncate">
              {formatDate(post.scheduledAt)}
            </div>
          )}
        </>
      )}

      {/* Live: gepubliceerd-badge */}
      {isLive && (
        <>
          <div className="absolute top-1 right-1 text-[11px] leading-none">✓</div>
          {post.scheduledAt && (
            <div className="absolute bottom-1 left-1 right-1 bg-black/60 rounded-[3px] px-1 py-0.5 text-[7px] font-bold text-white text-center truncate">
              live · {formatDate(post.scheduledAt)}
            </div>
          )}
        </>
      )}

      {!imageUrl && post.source?.kind === 'shopify' && (
        <div className="absolute bottom-1 left-1 right-1 bg-white/60 rounded-[3px] px-1 py-0.5 text-[7px] font-bold text-center truncate">
          {post.source.productTitle}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/grid/PostCell.tsx
git commit -m "refactor(grid): PostCell variants for concept/planned/live + unlock action"
```

---

### Task 14: PostGrid — sort + zone rendering, drag alleen tussen concepten, AddTile op index 0

**Files:**
- Modify: `src/components/grid/PostGrid.tsx`

- [ ] **Step 1: Vervang het bestand**

```tsx
'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
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
import { AddTile } from './AddTile'
import { SourcePicker } from '@/components/editor/SourcePicker'
import { ProductPicker } from '@/components/editor/ProductPicker'
import { UploadPicker } from '@/components/editor/UploadPicker'
import { sortPostsForFeed, isPlannedPost } from '@/lib/grid/sorting'
import type { Post } from '@/lib/types'

function SortableConceptCell({ post, onRepick, isRepicking }: {
  post: Post; onRepick?: () => void; isRepicking?: boolean
}) {
  const router = useRouter()
  const { draggingId } = useGridStore()
  const isDragging = draggingId === post.id

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: post.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 'auto' as const,
    touchAction: 'none' as const,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <PostCell
        post={post}
        isDragging={isDragging}
        onTap={() => router.push(`/grid/${post.id}`)}
        onRepick={onRepick}
        isRepicking={isRepicking}
      />
    </div>
  )
}

export function PostGrid() {
  const router = useRouter()
  const { posts, reorderConcepts, setDragging, updatePost, removePost } = useGridStore()
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false)
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const [uploadPickerOpen, setUploadPickerOpen] = useState(false)
  const [repickingIds, setRepickingIds] = useState<Set<string>>(new Set())
  const [unlockingIds, setUnlockingIds] = useState<Set<string>>(new Set())

  const handleRepick = useCallback(async (post: Post) => {
    setRepickingIds(prev => new Set(prev).add(post.id))
    try {
      const current = useGridStore.getState().posts
      const excludeProductIds = current
        .map(p => p.source?.kind === 'shopify' ? p.source.productId : null)
        .filter((id): id is string => Boolean(id))

      const res = await fetch('/api/posts/repick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post.id, excludeProductIds, isPerson: post.isPerson }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Repick failed')
      }
      const newPost: Post = await res.json()
      updatePost(post.id, newPost)
      toast.success('Nieuw product gekozen')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Opnieuw kiezen mislukt')
    } finally {
      setRepickingIds(prev => {
        const next = new Set(prev); next.delete(post.id); return next
      })
    }
  }, [updatePost])

  const handleUnlock = useCallback(async (post: Post) => {
    setUnlockingIds(prev => new Set(prev).add(post.id))
    try {
      const res = await fetch(`/api/posts/${post.id}/unlock`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Unlock mislukt')
      }
      const concept: Post = await res.json()
      removePost(post.id)
      useGridStore.getState().setPosts([concept, ...useGridStore.getState().posts])
      toast.success('Unlocked — je kunt nu editen')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unlock mislukt')
    } finally {
      setUnlockingIds(prev => {
        const next = new Set(prev); next.delete(post.id); return next
      })
    }
  }, [removePost])

  const sorted = sortPostsForFeed(posts)
  const conceptIds = sorted.filter(p => p.scheduledAt === null).map(p => p.id)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragStart(event: DragStartEvent) {
    setDragging(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragging(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = conceptIds.indexOf(active.id as string)
    const newIndex = conceptIds.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(conceptIds, oldIndex, newIndex)
    reorderConcepts(reordered)
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={conceptIds} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 gap-[1px] bg-[#2a2a2a]">
            <AddTile onTap={() => setSourcePickerOpen(true)} />
            {sorted.map(post =>
              post.scheduledAt === null ? (
                <SortableConceptCell
                  key={post.id}
                  post={post}
                  onRepick={() => handleRepick(post)}
                  isRepicking={repickingIds.has(post.id)}
                />
              ) : (
                <div key={post.id}>
                  <PostCell
                    post={post}
                    onTap={isPlannedPost(post) ? () => router.push(`/grid/${post.id}`) : undefined}
                    onUnlock={isPlannedPost(post) ? () => handleUnlock(post) : undefined}
                    isUnlocking={unlockingIds.has(post.id)}
                  />
                </div>
              )
            )}
          </div>
        </SortableContext>
      </DndContext>

      <SourcePicker
        open={sourcePickerOpen}
        onClose={() => setSourcePickerOpen(false)}
        onChooseProduct={() => { setSourcePickerOpen(false); setProductPickerOpen(true) }}
        onChooseUpload={() => { setSourcePickerOpen(false); setUploadPickerOpen(true) }}
      />

      <ProductPicker
        open={productPickerOpen}
        position={0}
        onClose={() => setProductPickerOpen(false)}
        onCreated={(newPost) => {
          useGridStore.getState().addConcepts([newPost])
          setProductPickerOpen(false)
        }}
      />

      <UploadPicker
        open={uploadPickerOpen}
        position={0}
        onClose={() => setUploadPickerOpen(false)}
        onCreated={(newPost) => {
          useGridStore.getState().addConcepts([newPost])
          setUploadPickerOpen(false)
        }}
      />
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/grid/PostGrid.tsx
git commit -m "refactor(grid): zone rendering, AddTile, drag scoped to concepts"
```

---

### Task 15: FillButton → "Voeg 9 toe"

**Files:**
- Modify: `src/components/grid/FillButton.tsx`

- [ ] **Step 1: Vervang het bestand**

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useGridStore } from '@/lib/store/gridStore'
import { toast } from 'sonner'
import type { Post } from '@/lib/types'

export function FillButton() {
  const [loading, setLoading] = useState(false)

  async function handleAdd() {
    setLoading(true)
    try {
      const currentPosts = useGridStore.getState().posts
      const existingProductIds = currentPosts
        .map(p => p.source?.kind === 'shopify' ? p.source.productId : null)
        .filter((id): id is string => Boolean(id))

      const res = await fetch('/api/posts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 9, existingProductIds }),
      })
      if (!res.ok) throw new Error('generate failed')
      const newPosts: Post[] = await res.json()

      useGridStore.getState().addConcepts(newPosts)
      toast.success(`✨ ${newPosts.length} concepten toegevoegd`)

      // Achtergrond: caption-generatie per nieuwe post
      for (const post of newPosts) {
        if (!post.source) continue
        fetch(`/api/posts/${post.id}/generate-caption`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: post.source }),
        })
          .then(r => (r.ok ? r.json() : null))
          .then((updated: { caption?: Post['caption'] } | null) => {
            if (updated?.caption) {
              useGridStore.getState().updatePost(post.id, { caption: updated.caption })
            }
          })
          .catch(() => {})
      }
    } catch {
      toast.error('Genereren mislukt, probeer opnieuw')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleAdd}
      disabled={loading}
      size="sm"
      className="bg-woody-cream hover:bg-woody-beige text-woody-bordeaux text-xs font-bold rounded-full px-3 h-7"
    >
      {loading ? '...' : `✨ Voeg 9 toe`}
    </Button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/grid/FillButton.tsx
git commit -m "refactor(grid): FillButton wordt 'Voeg 9 toe', altijd zichtbaar, store-only"
```

---

### Task 16: grid/page.tsx — initial fetch, geen ConflictBanner

**Files:**
- Modify: `src/app/grid/page.tsx`

- [ ] **Step 1: Vervang het bestand**

```tsx
'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Settings } from 'lucide-react'
import { useGridStore } from '@/lib/store/gridStore'
import { PostGrid } from '@/components/grid/PostGrid'
import { FillButton } from '@/components/grid/FillButton'
import type { Post } from '@/lib/types'

export default function GridPage() {
  const { posts, setPosts } = useGridStore()
  const [loading, setLoading] = useState(posts.length === 0)

  useEffect(() => {
    if (posts.length > 0) return
    fetch('/api/posts')
      .then(r => {
        if (!r.ok) throw new Error(`posts API ${r.status}`)
        return r.json()
      })
      .then((fetched: Post[]) => {
        setPosts(fetched)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <main className="min-h-screen bg-woody-beige">
      <header className="sticky top-0 z-20 bg-woody-bordeaux">
        <div className="flex items-center justify-between px-3 py-2">
          <Image src="/woodykids-logo.png" alt="WoodyKids" width={120} height={52} className="object-contain" unoptimized priority loading="eager" />
          <div className="flex items-center gap-2">
            <FillButton />
            <Link href="/settings" className="p-1 text-woody-cream/70 hover:text-woody-cream">
              <Settings size={18} />
            </Link>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-woody-taupe text-sm">
          Laden...
        </div>
      ) : (
        <PostGrid />
      )}
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/grid/page.tsx
git commit -m "refactor(grid): drop conflict banner and empty seeding in initial load"
```

---

### Task 17: Editor — geen PUT meer, planned posts read-only met Unlock-CTA

**Files:**
- Modify: `src/app/grid/[postId]/page.tsx`

- [ ] **Step 1: Vervang het bestand**

```tsx
// src/app/grid/[postId]/page.tsx
'use client'

import { use, useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useGridStore } from '@/lib/store/gridStore'
import { PhotoCrop } from '@/components/editor/PhotoCrop'
import { MultiPhotoSelector } from '@/components/editor/MultiPhotoSelector'
import { CaptionBlock } from '@/components/editor/CaptionBlock'
import { HashtagBadges } from '@/components/editor/HashtagBadges'
import { ScheduleSheet } from '@/components/editor/ScheduleSheet'
import { isPlannedPost, isLivePost } from '@/lib/grid/sorting'
import type { Post, CaptionBlock as CaptionBlockType, Hashtag, CropData, PostCaption } from '@/lib/types'

const INSTAGRAM_CAPTION_LIMIT = 2200

function assembledLength(caption: PostCaption): number {
  const opener = caption.opener.variants[caption.opener.selected] ?? ''
  const middle = caption.middle.variants[caption.middle.selected] ?? ''
  const closer = caption.closer.variants[caption.closer.selected] ?? ''
  const hashtags = caption.hashtags.filter(h => h.active).map(h => h.text).join(' ')
  const parts: string[] = [opener, middle, closer]
  if (hashtags) parts.push(hashtags)
  return parts.join('\n\n').length
}

function EditorContent({ postId }: { postId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { posts, updatePost, removePost, setPosts } = useGridStore()

  const post = posts.find(p => p.id === postId)
  const [scheduleOpen, setScheduleOpen] = useState(searchParams.get('schedule') === 'true')
  const [busy, setBusy] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  useEffect(() => {
    if (!post) router.replace('/grid')
  }, [post, router])

  if (!post || !post.source) return null

  const planned = isPlannedPost(post)
  const live = isLivePost(post)
  const readOnly = planned || live

  const imageUrl = (() => {
    if (post.source.kind === 'shopify') {
      const coverIndex = post.source.selectedImageIndices?.[0] ?? 0
      return post.source.images[coverIndex] ?? post.source.images[0]
    }
    return post.source.mediaUrls?.[0] ?? undefined
  })()

  const isShopify = post.source.kind === 'shopify'
  const title = post.source.kind === 'shopify' ? post.source.productTitle : 'Eigen post'

  function save(patch: Partial<Post>) {
    if (readOnly) return
    updatePost(postId, patch)
  }

  async function handleRegenerate() {
    if (!post || readOnly) return
    setIsGenerating(true)
    setGenerateError(null)
    try {
      const res = await fetch(`/api/posts/${post.id}/generate-caption`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: post.source }),
      })
      if (!res.ok) throw new Error('failed')
      const updated = await res.json() as { caption?: PostCaption }
      if (updated.caption) updatePost(post.id, { caption: updated.caption })
    } catch {
      setGenerateError('Caption generatie mislukt. Probeer opnieuw.')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleSchedule(isoDateTime: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/posts/${postId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: isoDateTime, post }),
      })
      if (!res.ok) throw new Error('publish failed')
      const created: Post = await res.json()
      // Replace concept met locked-versie in de store
      removePost(postId)
      setPosts([created, ...useGridStore.getState().posts])
      toast.success('Ingepland voor Zernio 🎉')
      router.push('/grid')
    } catch {
      toast.error('Inplannen mislukt. Probeer opnieuw.')
    } finally {
      setBusy(false)
    }
  }

  async function handleUnlock() {
    setBusy(true)
    try {
      const res = await fetch(`/api/posts/${postId}/unlock`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Unlock mislukt')
      }
      const concept: Post = await res.json()
      removePost(postId)
      setPosts([concept, ...useGridStore.getState().posts])
      toast.success('Unlocked — je kunt nu editen')
      router.replace(`/grid/${concept.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unlock mislukt')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-woody-cream flex flex-col">
      <header className="flex items-center justify-between px-3 py-2 border-b border-woody-taupe/20 sticky top-0 z-10 bg-woody-bordeaux">
        <button onClick={() => router.push('/grid')} className="flex items-center gap-1 text-woody-cream text-sm font-semibold">
          <ChevronLeft size={18} /> Terug
        </button>
        <span className="text-xs font-semibold text-woody-cream/70 truncate max-w-[140px]">{title}</span>
        {readOnly ? (
          planned ? (
            <button
              onClick={handleUnlock}
              disabled={busy}
              className="text-xs font-bold text-woody-bordeaux bg-woody-cream px-3 py-1.5 rounded-full"
            >
              {busy ? '...' : 'Unlock'}
            </button>
          ) : (
            <span className="text-xs text-woody-cream/60 px-3 py-1.5">live</span>
          )
        ) : (
          <button
            onClick={() => setScheduleOpen(true)}
            disabled={busy}
            className="text-xs font-bold text-woody-bordeaux bg-woody-cream px-3 py-1.5 rounded-full"
          >
            {busy ? '...' : 'Inplannen →'}
          </button>
        )}
      </header>

      {readOnly && (
        <div className="bg-woody-cream/80 px-3 py-2 flex items-center gap-2 text-[11px] text-woody-bordeaux border-b border-woody-taupe/20">
          <Lock size={12} />
          {live
            ? 'Deze post staat live op Instagram en kan niet meer aangepast worden.'
            : 'Deze post is ingepland. Klik Unlock om te editen — Zernio krijgt automatisch een cancel.'}
        </div>
      )}

      <PhotoCrop
        imageUrl={imageUrl}
        cropData={post.cropData}
        onChange={readOnly ? () => {} : (cropData: CropData) => save({ cropData })}
      />

      {isShopify && post.source.kind === 'shopify' && (
        <MultiPhotoSelector
          images={post.source.images}
          selectedIndices={post.source.selectedImageIndices ?? [0]}
          onChange={readOnly ? () => {} : (selectedImageIndices) => {
            if (post.source?.kind !== 'shopify') return
            save({ source: { ...post.source, selectedImageIndices } })
          }}
        />
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {!readOnly && (
          <div className="flex flex-col gap-1">
            <button
              onClick={handleRegenerate}
              disabled={isGenerating}
              className="w-full text-xs font-semibold text-woody-bordeaux border border-woody-bordeaux/40 rounded-lg py-2 disabled:opacity-40"
            >
              {isGenerating ? 'Genereren...' : 'Regenereer caption'}
            </button>
            {generateError && <p className="text-xs text-red-600 text-center">{generateError}</p>}
          </div>
        )}

        {!post.caption ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-24 bg-woody-taupe/20 rounded-xl" />
            <div className="h-24 bg-woody-taupe/20 rounded-xl" />
            <div className="h-24 bg-woody-taupe/20 rounded-xl" />
          </div>
        ) : (
          <>
            <CaptionBlock label="Opener" block={post.caption.opener} disabled={readOnly}
              onChange={(opener: CaptionBlockType) => save({ caption: { ...post.caption!, opener } })} />
            <CaptionBlock label="Middenstuk" block={post.caption.middle} disabled={readOnly}
              onChange={(middle: CaptionBlockType) => save({ caption: { ...post.caption!, middle } })} />
            <CaptionBlock label="Afsluiter" block={post.caption.closer} disabled={readOnly}
              onChange={(closer: CaptionBlockType) => save({ caption: { ...post.caption!, closer } })} />
            <HashtagBadges hashtags={post.caption.hashtags} disabled={readOnly}
              onChange={(hashtags: Hashtag[]) => save({ caption: { ...post.caption!, hashtags } })} />
            {(() => {
              const count = assembledLength(post.caption)
              return (
                <p className={`text-xs text-right pr-1 ${count > INSTAGRAM_CAPTION_LIMIT ? 'text-red-600 font-semibold' : 'text-woody-taupe'}`}>
                  {count} / {INSTAGRAM_CAPTION_LIMIT} tekens
                </p>
              )
            })()}
          </>
        )}
      </div>

      <ScheduleSheet
        open={scheduleOpen && !readOnly}
        onClose={() => setScheduleOpen(false)}
        onConfirm={handleSchedule}
        current={post.scheduledAt}
      />
    </main>
  )
}

export default function EditorPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = use(params)
  return <Suspense><EditorContent postId={postId} /></Suspense>
}
```

Opmerking: `CaptionBlock` en `HashtagBadges` krijgen een nieuwe optionele `disabled`-prop. Pas die in de componenten aan: bij `disabled` geen onClick-handlers koppelen en greyed-out tonen. Concrete details bij stap 2.

- [ ] **Step 2: Voeg `disabled` toe aan `CaptionBlock` en `HashtagBadges`**

In `src/components/editor/CaptionBlock.tsx`:

```ts
type Props = { label: string; block: CaptionBlockType; disabled?: boolean; onChange: (block: CaptionBlockType) => void }
```

In de component-render: als `disabled`, render varianten als statische tekst zonder klik-handlers en met `opacity-60 pointer-events-none`. Lees het bestand eerst om de exacte plek te kiezen.

In `src/components/editor/HashtagBadges.tsx`:

```ts
type Props = { hashtags: Hashtag[]; disabled?: boolean; onChange: (hashtags: Hashtag[]) => void }
```

Idem: bij `disabled` geen click handlers.

- [ ] **Step 3: Type-check + smoke test in dev**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Verwacht: geen errors.

```bash
npm run dev
```

Open http://localhost:3000/grid, log in, klik "Voeg 9 toe", open één concept, edit caption, ga terug, refresh — concepten moeten weg zijn. Plan een concept in (gebruikt echte Zernio: zie `.env.local` voor API key, of zet de Zernio call op mock voor lokale tests).

- [ ] **Step 4: Commit**

```bash
git add src/app/grid/[postId]/page.tsx src/components/editor/CaptionBlock.tsx src/components/editor/HashtagBadges.tsx
git commit -m "refactor(editor): drop PUT, read-only + Unlock-CTA voor planned, lock voor live"
```

---

### Task 18: E2E test — feed-volgorde + AddTile

**Files:**
- Create: `e2e/grid-feed-zones.spec.ts`

- [ ] **Step 1: Schrijf de Playwright spec**

Voorafgaand: lees `e2e/background-caption.spec.ts` en `e2e/generate-caption.spec.ts` om de bestaande auth-bypass en mock-patterns over te nemen — gebruik dezelfde fixtures/setup. Als die specs een `beforeEach` met login hebben, neem die mee.

`e2e/grid-feed-zones.spec.ts`:

```ts
import { test, expect, Page } from '@playwright/test'

const FUTURE_FAR = '2031-01-01T10:00:00Z'
const FUTURE_NEAR = '2030-06-01T10:00:00Z'
const PAST = '2020-01-01T10:00:00Z'

async function mockApi(page: Page) {
  // GET /api/posts → 1 live + 1 planned
  await page.route('**/api/posts', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'planned-far', state: 'locked', position: null, source: null,
            cropData: { x:0, y:0, scale:1 }, caption: null, scheduledAt: FUTURE_FAR,
            isPerson: false, zernioPostId: 'z-far' },
          { id: 'planned-near', state: 'locked', position: null, source: null,
            cropData: { x:0, y:0, scale:1 }, caption: null, scheduledAt: FUTURE_NEAR,
            isPerson: false, zernioPostId: 'z-near' },
          { id: 'live-old', state: 'locked', position: null, source: null,
            cropData: { x:0, y:0, scale:1 }, caption: null, scheduledAt: PAST,
            isPerson: false, zernioPostId: 'z-old' },
        ]),
      })
    }
    return route.continue()
  })
}

test('grid renders AddTile + planned (newest first) + live (oldest last)', async ({ page }) => {
  await mockApi(page)
  await page.goto('/grid')

  const cells = page.locator('[data-testid="grid-cell"]')
  // AddTile, planned-far, planned-near, live-old → 4 cellen
  await expect(cells).toHaveCount(4)
  await expect(cells.nth(0)).toHaveAttribute('data-cell-kind', 'add')
  await expect(cells.nth(1)).toHaveAttribute('data-cell-id', 'planned-far')
  await expect(cells.nth(2)).toHaveAttribute('data-cell-id', 'planned-near')
  await expect(cells.nth(3)).toHaveAttribute('data-cell-id', 'live-old')
})
```

- [ ] **Step 2: Voeg `data-testid` en `data-cell-id` / `data-cell-kind` attributen toe**

Pas `src/components/grid/PostGrid.tsx` aan:

- Wrap elke cel in een `<div data-testid="grid-cell" data-cell-id={post.id}>` (voor concepten en planned/live).
- Voor AddTile: wrap in `<div data-testid="grid-cell" data-cell-kind="add">`.

(Alleen wrappers toevoegen, layout intact laten.)

- [ ] **Step 3: Run de e2e test**

```bash
npm run test:e2e -- e2e/grid-feed-zones.spec.ts
```

Verwacht: PASS.

- [ ] **Step 4: Commit**

```bash
git add e2e/grid-feed-zones.spec.ts src/components/grid/PostGrid.tsx
git commit -m "test(e2e): grid renders AddTile + planned-newest-first + live-last"
```

---

### Task 19: E2E test — unlock-flow

**Files:**
- Create: `e2e/unlock-flow.spec.ts`

- [ ] **Step 1: Schrijf de Playwright spec**

`e2e/unlock-flow.spec.ts`:

```ts
import { test, expect, Page } from '@playwright/test'

const FUTURE = '2031-01-01T10:00:00Z'

async function mockApi(page: Page) {
  let dbHasPost = true

  await page.route('**/api/posts', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(dbHasPost ? [{
        id: 'planned-1', state: 'locked', position: null,
        source: { kind: 'shopify', productId: 'p1', productTitle: 'Test', images: ['https://x/y.jpg', 'https://x/z.jpg'], selectedImageIndices: [1] },
        cropData: { x:0, y:0, scale:1 },
        caption: { opener:{variants:['o'],selected:0}, middle:{variants:['m'],selected:0}, closer:{variants:['c'],selected:0}, hashtags: [] },
        scheduledAt: FUTURE, isPerson: false, zernioPostId: 'z-1',
      }] : []),
    })
  })

  await page.route('**/api/posts/planned-1/unlock', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    dbHasPost = false
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'planned-1', state: 'locked', position: null,
        source: { kind: 'shopify', productId: 'p1', productTitle: 'Test', images: ['https://x/y.jpg', 'https://x/z.jpg'], selectedImageIndices: [1] },
        cropData: { x:0, y:0, scale:1 },
        caption: { opener:{variants:['o'],selected:0}, middle:{variants:['m'],selected:0}, closer:{variants:['c'],selected:0}, hashtags: [] },
        scheduledAt: null, isPerson: false,
      }),
    })
  })
}

test('unlock een planned post — wordt concept zonder scheduledAt', async ({ page }) => {
  await mockApi(page)
  await page.goto('/grid')

  // Klik unlock op de planned tegel
  await page.locator('[data-cell-id="planned-1"] >> button[aria-label="Unlock om te editen"]').click()

  // Toast + de cel mag nu een concept-badge tonen
  await expect(page.locator('text=Unlocked').first()).toBeVisible({ timeout: 5_000 })
  await expect(page.locator('[data-cell-id="planned-1"] >> text=concept')).toBeVisible()
})
```

- [ ] **Step 2: Run de e2e test**

```bash
npm run test:e2e -- e2e/unlock-flow.spec.ts
```

Verwacht: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/unlock-flow.spec.ts
git commit -m "test(e2e): unlock-flow zet planned terug naar concept"
```

---

### Task 20: Volledige verificatie en cleanup

- [ ] **Step 1: Type-check schoon**

```bash
npx tsc --noEmit
```

Verwacht: 0 errors. Los eventuele resten op (vaak: oude verwijzingen naar `'draft'`/`'empty'` in tests of utility-files).

- [ ] **Step 2: Unit tests groen**

```bash
npm run test:run
```

Verwacht: alle tests PASS.

- [ ] **Step 3: E2E suite groen**

```bash
npm run test:e2e
```

Verwacht: alle e2e tests PASS. Bestaande specs (`background-caption`, `fill-button-captions`, `generate-caption`) moeten ook nog passen — zo niet, fix per spec.

- [ ] **Step 4: Manuele rooktest in dev**

```bash
npm run dev
```

Doorloop:
1. Login → grid laadt → AddTile staat linksboven, geen concepten zichtbaar.
2. Klik "Voeg 9 toe" → 9 concepten verschijnen na de AddTile.
3. Klik AddTile → SourcePicker opent → kies een product → 10e concept verschijnt linksboven (na AddTile).
4. Open een concept → edit caption → terug naar grid → edit blijft zichtbaar.
5. Refresh → alle concepten weg, alleen DB-posts (en AddTile) over.
6. Plan een concept in → wordt locked, verschijnt onder concepten op chronologische plek.
7. Klik Unlock op een planned post → wordt weer concept (linksboven), zichtbaar in DB-controle dat row weg is.

- [ ] **Step 5: Final commit + push**

```bash
git push origin main
```

---

## Coverage check (zelf-review na voltooiing)

Tijdens het schrijven gecontroleerd dat elke spec-eis een task heeft:

- ✅ Eén chronologische feed, links-boven nieuwste — Task 3 + 14
- ✅ Add-tegel altijd linksboven — Task 12 + 14
- ✅ Concepten browser-only — Task 6 + 8 + 11 + 17
- ✅ "Voeg 9 toe" altijd zichtbaar — Task 15
- ✅ Locked vs Live afgeleid uit `scheduled_at` — Task 3 + 13
- ✅ Unlock = Zernio cancel + DB delete — Task 4 + 10 + 13 + 17
- ✅ Publish: Zernio first, INSERT pas na succes — Task 5
- ✅ Schema cleanup + zernio_post_id kolom — Task 1
- ✅ Geen ConflictBanner meer — Task 16

# Shopify + Supabase Fundament — Implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vervang alle stub API routes door echte Supabase-persistentie en een echte Shopify-productcatalogus, zodat de app op echte data draait.

**Architecture:** Next.js API routes als thin server layer. Supabase (Postgres + RLS) voor alle app-data. Shopify Admin REST API met Next.js Data Cache (5 min) voor producten. Geen Redis, geen sync-jobs.

**Tech Stack:** Next.js 16 App Router, Supabase (`@supabase/ssr`), Shopify Admin API 2025-01, TypeScript, Vitest.

---

## Context voor de implementeerder

Dit is een bestaande Next.js 16 app (AGENTS.md: **lees `node_modules/next/dist/docs/` vóór je code schrijft**). De codebase heeft:
- `src/lib/supabase/server.ts` — al aanwezig, Supabase server client
- `src/lib/supabase/client.ts` — al aanwezig, Supabase browser client
- `src/lib/types.ts` — alle TypeScript types
- `src/app/api/posts/route.ts` e.a. — stub routes die vervangen worden
- `src/components/editor/ScheduleSheet.tsx` — patroon voor bottom sheets (Sheet van shadcn)
- `src/components/grid/PostGrid.tsx` — rendert de grid, bruikbaar als integratiepunt
- Tests draaien met `npm run test:run` (vitest, jsdom, globals: true)

---

## Task 1: SQL-migratie — Supabase tabellen aanmaken

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Stap 1: Maak het migratiebestand aan**

```sql
-- supabase/migrations/001_initial_schema.sql

create table posts (
  id            uuid primary key default gen_random_uuid(),
  state         text not null check (state in ('empty', 'draft', 'conflict', 'locked')),
  position      integer not null,
  source        jsonb,
  crop_data     jsonb not null default '{"x":0,"y":0,"scale":1}',
  caption       jsonb,
  scheduled_at  timestamptz,
  is_person     boolean not null default false,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);

alter table posts enable row level security;

create policy "team_all" on posts
  for all to authenticated
  using (true)
  with check (true);

create table settings (
  id              integer primary key default 1,
  tone_of_voice   text not null default '',
  updated_at      timestamptz not null default now()
);

alter table settings enable row level security;

create policy "team_all" on settings
  for all to authenticated
  using (true)
  with check (true);

-- Seed één instellingenrij
insert into settings (id, tone_of_voice) values (1, '');

-- Seed lege grid van 12 slots (positie 0-11)
insert into posts (state, position)
select 'empty', generate_series(0, 11);
```

- [ ] **Stap 2: Voer de migratie uit in de Supabase dashboard**

1. Ga naar [https://supabase.com/dashboard](https://supabase.com/dashboard) → jouw project
2. Klik links op **SQL Editor**
3. Plak de volledige SQL uit stap 1
4. Klik **Run**

Verwacht: geen errors, groene melding "Success"

- [ ] **Stap 3: Verifieer de tabellen**

Ga naar **Table Editor** in de Supabase dashboard. Je ziet:
- `posts` tabel met 12 rijen (alle state='empty', position 0-11)
- `settings` tabel met 1 rij (id=1, tone_of_voice='')

- [ ] **Stap 4: Commit**

```bash
git add supabase/
git commit -m "feat: add Supabase migration for posts and settings tables"
```

---

## Task 2: TypeScript types uitbreiden

**Files:**
- Modify: `src/lib/types.ts`

De `PostSourceShopify` type mist `variants`. We voegen ook `ShopifyProduct` en `ShopifyCollection` toe als nieuwe exporteerbare types (nodig voor ProductPicker UI).

- [ ] **Stap 1: Vervang `src/lib/types.ts` volledig**

```typescript
// src/lib/types.ts

export type ShopifyVariant = {
  id: string
  title: string   // bijv. "Naturel / L"
  price: string   // bijv. "24.95"
}

export type ShopifyProduct = {
  id: string
  title: string
  images: string[]
  variants: ShopifyVariant[]
  collectionIds: string[]
}

export type ShopifyCollection = {
  id: string
  title: string
}

export type PostSourceShopify = {
  kind: 'shopify'
  productId: string
  productTitle: string
  images: string[]
  variants?: ShopifyVariant[]   // optional: niet aanwezig in oude fixture data
  selectedImageIndex: number
}

export type PostSourceUpload = {
  kind: 'upload'
  mediaUrl: string
  mediaType: 'image' | 'video'
  userPrompt: string
}

export type PostSource = PostSourceShopify | PostSourceUpload

export type CropData = {
  x: number
  y: number
  scale: number
}

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

export type PostState = 'empty' | 'draft' | 'conflict' | 'locked'

export type Post = {
  id: string
  state: PostState
  position: number
  source: PostSource | null
  cropData: CropData
  caption: PostCaption | null
  scheduledAt: string | null   // ISO 8601
  isPerson: boolean
}

export type ToneOfVoice = {
  content: string
}
```

- [ ] **Stap 2: Verifieer dat de build slaagt**

```bash
npm run build
```

Verwacht: `✓ Compiled successfully`

- [ ] **Stap 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: extend types with ShopifyVariant, ShopifyProduct, ShopifyCollection"
```

---

## Task 3: Shopify client

**Files:**
- Create: `src/lib/shopify/client.ts`
- Create: `src/lib/shopify/__tests__/client.test.ts`

- [ ] **Stap 1: Schrijf de falende test**

```typescript
// src/lib/shopify/__tests__/client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getProducts, getCollections } from '@/lib/shopify/client'

describe('getProducts', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps Shopify API response to ShopifyProduct[]', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          products: [{
            id: 123,
            title: 'Houten treintje',
            images: [{ src: 'https://cdn.shopify.com/img.jpg' }],
            variants: [{ id: 456, title: 'Standaard', price: '24.95' }],
          }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          collects: [{ product_id: 123, collection_id: 789 }],
        }),
      } as Response)

    const products = await getProducts()

    expect(products).toHaveLength(1)
    expect(products[0]).toEqual({
      id: '123',
      title: 'Houten treintje',
      images: ['https://cdn.shopify.com/img.jpg'],
      variants: [{ id: '456', title: 'Standaard', price: '24.95' }],
      collectionIds: ['789'],
    })
  })

  it('geeft lege array bij product zonder collectie', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          products: [{ id: 1, title: 'Solo', images: [], variants: [] }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ collects: [] }),
      } as Response)

    const products = await getProducts()
    expect(products[0].collectionIds).toEqual([])
  })
})

describe('getCollections', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps Shopify custom_collections to ShopifyCollection[]', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      json: () => Promise.resolve({
        custom_collections: [
          { id: 10, title: 'Houten speelgoed' },
          { id: 20, title: 'Buitenspeelgoed' },
        ],
      }),
    } as Response)

    const collections = await getCollections()

    expect(collections).toHaveLength(2)
    expect(collections[0]).toEqual({ id: '10', title: 'Houten speelgoed' })
    expect(collections[1]).toEqual({ id: '20', title: 'Buitenspeelgoed' })
  })
})
```

- [ ] **Stap 2: Run de test — verifieer dat hij faalt**

```bash
npm run test:run
```

Verwacht: FAIL — "Cannot find module '@/lib/shopify/client'"

- [ ] **Stap 3: Implementeer de Shopify client**

```typescript
// src/lib/shopify/client.ts
import type { ShopifyProduct, ShopifyCollection, ShopifyVariant } from '@/lib/types'

type ShopifyApiImage = { src: string }
type ShopifyApiVariant = { id: number; title: string; price: string }
type ShopifyApiProduct = {
  id: number
  title: string
  images: ShopifyApiImage[]
  variants: ShopifyApiVariant[]
}
type ShopifyApiCollection = { id: number; title: string }
type ShopifyApiCollect = { product_id: number; collection_id: number }

const baseUrl = `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2025-01`

function shopifyHeaders() {
  return { 'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN! }
}

export async function getProducts(): Promise<ShopifyProduct[]> {
  const [productsRes, collectsRes] = await Promise.all([
    fetch(`${baseUrl}/products.json?limit=250&fields=id,title,images,variants`, {
      headers: shopifyHeaders(),
      next: { revalidate: 300 },
    }),
    fetch(`${baseUrl}/collects.json?limit=250`, {
      headers: shopifyHeaders(),
      next: { revalidate: 300 },
    }),
  ])

  const { products }: { products: ShopifyApiProduct[] } = await productsRes.json()
  const { collects }: { collects: ShopifyApiCollect[] } = await collectsRes.json()

  const collectionMap = new Map<string, string[]>()
  for (const collect of collects) {
    const pid = String(collect.product_id)
    if (!collectionMap.has(pid)) collectionMap.set(pid, [])
    collectionMap.get(pid)!.push(String(collect.collection_id))
  }

  return products.map(p => ({
    id: String(p.id),
    title: p.title,
    images: p.images.map(img => img.src),
    variants: p.variants.map((v): ShopifyVariant => ({
      id: String(v.id),
      title: v.title,
      price: v.price,
    })),
    collectionIds: collectionMap.get(String(p.id)) ?? [],
  }))
}

export async function getCollections(): Promise<ShopifyCollection[]> {
  const res = await fetch(`${baseUrl}/custom_collections.json?limit=250`, {
    headers: shopifyHeaders(),
    next: { revalidate: 300 },
  })
  const { custom_collections }: { custom_collections: ShopifyApiCollection[] } = await res.json()
  return custom_collections.map(c => ({ id: String(c.id), title: c.title }))
}
```

- [ ] **Stap 4: Run de tests — verifieer dat ze slagen**

```bash
npm run test:run
```

Verwacht: alle tests PASS (inclusief bestaande 6 store-tests)

- [ ] **Stap 5: Commit**

```bash
git add src/lib/shopify/
git commit -m "feat: add Shopify Admin API client with 5-min cache"
```

---

## Task 4: Products & Collections API routes

**Files:**
- Create: `src/app/api/products/route.ts`
- Create: `src/app/api/collections/route.ts`

- [ ] **Stap 1: Maak `/api/products` aan**

```typescript
// src/app/api/products/route.ts
import { NextResponse } from 'next/server'
import { getProducts } from '@/lib/shopify/client'

export async function GET() {
  const products = await getProducts()
  return NextResponse.json(products)
}
```

- [ ] **Stap 2: Maak `/api/collections` aan**

```typescript
// src/app/api/collections/route.ts
import { NextResponse } from 'next/server'
import { getCollections } from '@/lib/shopify/client'

export async function GET() {
  const collections = await getCollections()
  return NextResponse.json(collections)
}
```

- [ ] **Stap 3: Voeg Shopify env vars toe aan `.env.local`**

Voeg deze twee regels toe aan `.env.local` (vraag de Shopify Admin Token op via: Shopify Admin → Settings → Apps → Develop apps → jouw app → API credentials):

```
SHOPIFY_STORE_DOMAIN=jouwwinkel.myshopify.com
SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxx
```

- [ ] **Stap 4: Verifieer de build**

```bash
npm run build
```

Verwacht: `✓ Compiled successfully` — de nieuwe routes verschijnen in de output als `ƒ /api/products` en `ƒ /api/collections`

- [ ] **Stap 5: Commit**

```bash
git add src/app/api/products/ src/app/api/collections/
git commit -m "feat: add /api/products and /api/collections routes backed by Shopify"
```

> **Let op:** `.env.local` nooit committen (staat in `.gitignore`). De Shopify env vars staan alleen lokaal.

---

## Task 5: Posts GET route — Supabase

**Files:**
- Modify: `src/app/api/posts/route.ts`

De `mapPost` helper converteert snake_case DB-rijen naar camelCase TypeScript. We definiëren hem lokaal in elk route-bestand (klein genoeg om te dupliceren).

- [ ] **Stap 1: Vervang `src/app/api/posts/route.ts`**

```typescript
// src/app/api/posts/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('position')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map(mapPost))
}
```

- [ ] **Stap 2: Verifieer de build**

```bash
npm run build
```

Verwacht: `✓ Compiled successfully`

- [ ] **Stap 3: Test handmatig**

Start de dev server (`npm run dev`) en ga naar de app als ingelogde gebruiker. De grid moet laden met de 12 lege slots uit Supabase (niet de fixture data).

- [ ] **Stap 4: Commit**

```bash
git add src/app/api/posts/route.ts
git commit -m "feat: replace GET /api/posts stub with Supabase query"
```

---

## Task 6: Posts PUT + DELETE + Grid order routes

**Files:**
- Modify: `src/app/api/posts/[id]/route.ts`
- Modify: `src/app/api/grid/order/route.ts`

- [ ] **Stap 1: Vervang `src/app/api/posts/[id]/route.ts`**

```typescript
// src/app/api/posts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const patch = await request.json() as Partial<Post>
  const supabase = await createClient()

  const dbPatch: Record<string, unknown> = {}
  if (patch.state !== undefined) dbPatch.state = patch.state
  if (patch.position !== undefined) dbPatch.position = patch.position
  if (patch.source !== undefined) dbPatch.source = patch.source
  if (patch.cropData !== undefined) dbPatch.crop_data = patch.cropData
  if (patch.caption !== undefined) dbPatch.caption = patch.caption
  if (patch.scheduledAt !== undefined) dbPatch.scheduled_at = patch.scheduledAt
  if (patch.isPerson !== undefined) dbPatch.is_person = patch.isPerson

  const { data, error } = await supabase
    .from('posts')
    .update(dbPatch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(mapPost(data))
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

- [ ] **Stap 2: Vervang `src/app/api/grid/order/route.ts`**

```typescript
// src/app/api/grid/order/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(request: NextRequest) {
  const { ids } = await request.json() as { ids: string[] }
  const supabase = await createClient()

  await Promise.all(
    ids.map((id, position) =>
      supabase.from('posts').update({ position }).eq('id', id)
    )
  )

  return NextResponse.json({ saved: true })
}
```

- [ ] **Stap 3: Verifieer de build**

```bash
npm run build
```

Verwacht: `✓ Compiled successfully`

- [ ] **Stap 4: Commit**

```bash
git add src/app/api/posts/[id]/route.ts src/app/api/grid/order/route.ts
git commit -m "feat: replace posts PUT/DELETE and grid order stubs with Supabase"
```

---

## Task 7: Settings + Create-product routes

**Files:**
- Modify: `src/app/api/settings/tone-of-voice/route.ts`
- Modify: `src/app/api/posts/create-product/route.ts`

- [ ] **Stap 1: Vervang `src/app/api/settings/tone-of-voice/route.ts`**

```typescript
// src/app/api/settings/tone-of-voice/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('settings')
    .select('tone_of_voice')
    .eq('id', 1)
    .single()

  if (error) return NextResponse.json({ content: '' })
  return NextResponse.json({ content: data.tone_of_voice })
}

export async function PUT(request: NextRequest) {
  const { content } = await request.json() as { content: string }
  const supabase = await createClient()

  const { error } = await supabase
    .from('settings')
    .update({ tone_of_voice: content, updated_at: new Date().toISOString() })
    .eq('id', 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ content })
}
```

- [ ] **Stap 2: Vervang `src/app/api/posts/create-product/route.ts`**

```typescript
// src/app/api/posts/create-product/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProducts } from '@/lib/shopify/client'
import type { Post, PostState, PostSource, CropData, PostCaption, PostSourceShopify } from '@/lib/types'

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
  const { productId, position } = await request.json() as { productId: string; position: number }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const products = await getProducts()
  const product = products.find(p => p.id === productId)
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const source: PostSourceShopify = {
    kind: 'shopify',
    productId: product.id,
    productTitle: product.title,
    images: product.images,
    variants: product.variants,
    selectedImageIndex: 0,
  }

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

- [ ] **Stap 3: Verifieer de build**

```bash
npm run build
```

Verwacht: `✓ Compiled successfully`

- [ ] **Stap 4: Commit**

```bash
git add src/app/api/settings/ src/app/api/posts/create-product/
git commit -m "feat: replace settings and create-product stubs with Supabase + Shopify"
```

---

## Task 8: ProductPicker component + grid integratie

**Files:**
- Create: `src/components/editor/ProductPicker.tsx`
- Modify: `src/components/grid/PostGrid.tsx`

- [ ] **Stap 1: Maak `src/components/editor/ProductPicker.tsx` aan**

```typescript
// src/components/editor/ProductPicker.tsx
'use client'

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { Post, ShopifyProduct, ShopifyCollection } from '@/lib/types'

type Props = {
  open: boolean
  position: number
  onClose: () => void
  onCreated: (post: Post) => void
}

export function ProductPicker({ open, position, onClose, onCreated }: Props) {
  const [products, setProducts] = useState<ShopifyProduct[]>([])
  const [collections, setCollections] = useState<ShopifyCollection[]>([])
  const [search, setSearch] = useState('')
  const [collectionId, setCollectionId] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!open) return
    setSearch('')
    setCollectionId('')
    setLoading(true)
    Promise.all([
      fetch('/api/products').then(r => r.json()),
      fetch('/api/collections').then(r => r.json()),
    ]).then(([prods, cols]: [ShopifyProduct[], ShopifyCollection[]]) => {
      setProducts(prods)
      setCollections(cols)
      setLoading(false)
    })
  }, [open])

  const filtered = products.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase())
    const matchesCollection = !collectionId || p.collectionIds.includes(collectionId)
    return matchesSearch && matchesCollection
  })

  async function handleSelect(product: ShopifyProduct) {
    setCreating(true)
    const res = await fetch('/api/posts/create-product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: product.id, position }),
    })
    const post = await res.json() as Post
    setCreating(false)
    onCreated(post)
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8 flex flex-col" style={{ height: '80vh' }}>
        <SheetHeader className="mb-3 shrink-0">
          <SheetTitle className="text-sm text-left">Product kiezen</SheetTitle>
        </SheetHeader>

        <div className="flex gap-2 mb-3 shrink-0">
          <input
            type="search"
            placeholder="Zoeken..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 border border-woody-taupe/40 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-woody-bordeaux/30"
          />
          <select
            value={collectionId}
            onChange={e => setCollectionId(e.target.value)}
            className="border border-woody-taupe/40 rounded-lg px-2 py-1.5 text-sm focus:outline-none"
          >
            <option value="">Alle collecties</option>
            {collections.map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-center text-sm text-gray-400 mt-8">Laden...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 mt-8">Geen producten gevonden</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {filtered.map(product => (
                <button
                  key={product.id}
                  onClick={() => handleSelect(product)}
                  disabled={creating}
                  className="text-left rounded-lg overflow-hidden border border-gray-100 active:opacity-60 disabled:opacity-40"
                >
                  {product.images[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.title}
                      className="w-full aspect-square object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-woody-beige" />
                  )}
                  <div className="p-1.5">
                    <p className="text-[10px] font-semibold text-gray-800 leading-tight line-clamp-2">
                      {product.title}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Stap 2: Voeg `ProductPicker` toe aan `src/components/grid/PostGrid.tsx`**

Vervang het volledige bestand:

```typescript
// src/components/grid/PostGrid.tsx
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
import { ProductPicker } from '@/components/editor/ProductPicker'
import type { Post } from '@/lib/types'

function SortableCell({ post }: { post: Post }) {
  const router = useRouter()
  const { draggingId } = useGridStore()
  const isDragging = draggingId === post.id
  const prevDraggingId = useRef<string | null>(null)
  const wasDragged = useRef(false)

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
  const [pickerPosition, setPickerPosition] = useState<number | null>(null)

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
                        ? () => setPickerPosition(post.position)
                        : undefined}
                    />
                  </div>
                )
            )}
          </div>
        </SortableContext>
      </DndContext>

      <ProductPicker
        open={pickerPosition !== null}
        position={pickerPosition ?? 0}
        onClose={() => setPickerPosition(null)}
        onCreated={(newPost) => {
          updatePost(newPost.id, newPost)
          setPickerPosition(null)
        }}
      />
    </>
  )
}
```

- [ ] **Stap 3: Verifieer de build**

```bash
npm run build
```

Verwacht: `✓ Compiled successfully`

- [ ] **Stap 4: Run alle tests**

```bash
npm run test:run
```

Verwacht: alle tests PASS

- [ ] **Stap 5: Handmatige test**

1. Start de dev server: `npm run dev`
2. Log in via magic link
3. Open de app → je ziet 12 lege slots
4. Tik op een leeg slot → ProductPicker sheet opent
5. Producten laden (vanuit Shopify) met zoekbalk en collectie-dropdown
6. Selecteer een product → slot wordt een oranje draft post
7. Tik op de draft post → editor opent
8. Refresh de pagina → draft post blijft staan (persistentie via Supabase)

- [ ] **Stap 6: Commit**

```bash
git add src/components/editor/ProductPicker.tsx src/components/grid/PostGrid.tsx
git commit -m "feat: add ProductPicker UI and wire empty cells to Shopify product selection"
```

- [ ] **Stap 7: Push**

```bash
git push origin main
```

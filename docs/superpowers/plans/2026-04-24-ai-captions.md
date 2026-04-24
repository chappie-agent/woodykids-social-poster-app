# AI Caption Generatie — Implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Genereer automatisch Instagram-captions via Claude direct na productselectie, zodat ze klaar staan wanneer de gebruiker de editor opent.

**Architecture:** ProductPicker triggert een fire-and-forget POST na aanmaken van de post. De route haalt product + tone of voice op uit Supabase, roept Claude claude-sonnet-4-6 aan met vision + tekst, slaat de gegenereerde caption op, en retourneert de bijgewerkte post. De editor pollt elke 2 seconden als caption null is, en biedt altijd een Regenereer-knop.

**Tech Stack:** Next.js 16 App Router, `@anthropic-ai/sdk`, Claude claude-sonnet-4-6, Supabase, TypeScript, Vitest.

---

## Context voor de implementeerder

Dit is een bestaande Next.js 16 app (AGENTS.md: **lees `node_modules/next/dist/docs/` vóór je code schrijft**). De codebase heeft:
- `src/lib/supabase/server.ts` — Supabase server client (`createClient()`)
- `src/lib/types.ts` — `Post`, `PostCaption`, `CaptionBlock`, `Hashtag`, `PostSourceShopify`
- `src/app/api/posts/[id]/route.ts` — bevat `PUT` en `DELETE`, en een lokale `mapPost` helper
- `src/components/editor/ProductPicker.tsx` — `handleSelect` maakt de post aan en roept `onCreated` + `onClose`
- `src/app/grid/[postId]/page.tsx` — editor, line 28: `if (!post || !post.caption || !post.source) return null`
- Tests draaien met `npm run test:run` (vitest, jsdom, globals: true)

---

## Task 1: Installeer @anthropic-ai/sdk en maak Anthropic client

**Files:**
- Modify: `package.json` (via npm install)
- Create: `src/lib/anthropic/client.ts`

- [ ] **Stap 1: Installeer de SDK**

```bash
npm install @anthropic-ai/sdk
```

Verwacht: geen errors, `@anthropic-ai/sdk` verschijnt in `package.json` dependencies.

- [ ] **Stap 2: Maak `src/lib/anthropic/client.ts` aan**

```typescript
// src/lib/anthropic/client.ts
import Anthropic from '@anthropic-ai/sdk'

export function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
  return new Anthropic({ apiKey })
}
```

- [ ] **Stap 3: Verifieer de build**

```bash
npm run build 2>&1 | tail -10
```

Verwacht: `✓ Compiled successfully`

- [ ] **Stap 4: Commit**

```bash
git add package.json package-lock.json src/lib/anthropic/client.ts
git commit -m "feat: install @anthropic-ai/sdk and add Anthropic client factory"
```

---

## Task 2: GET /api/posts/[id] route (voor polling)

De editor pollt deze route elke 2 seconden als `caption === null`. De route bestaat nog niet.

**Files:**
- Modify: `src/app/api/posts/[id]/route.ts`
- Create: `src/app/api/posts/[id]/__tests__/get.test.ts`

- [ ] **Stap 1: Schrijf de falende test**

```typescript
// src/app/api/posts/[id]/__tests__/get.test.ts
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
```

- [ ] **Stap 2: Run de test — verifieer dat hij faalt**

```bash
npm run test:run 2>&1 | tail -15
```

Verwacht: FAIL — `GET is not a function` of `GET is not exported`

- [ ] **Stap 3: Voeg GET toe aan `src/app/api/posts/[id]/route.ts`**

Voeg deze functie toe **boven** de bestaande `PUT` export (na de `mapPost` helper):

```typescript
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(mapPost(data))
}
```

- [ ] **Stap 4: Run de tests — verifieer dat ze slagen**

```bash
npm run test:run 2>&1 | tail -10
```

Verwacht: alle tests PASS (inclusief bestaande 11 tests)

- [ ] **Stap 5: Commit**

```bash
git add src/app/api/posts/[id]/route.ts src/app/api/posts/[id]/__tests__/get.test.ts
git commit -m "feat: add GET /api/posts/[id] route for caption polling"
```

---

## Task 3: Caption prompt builder en parser (pure functies)

Pure functies zijn makkelijk te testen zonder mocks. De route in Task 4 importeert deze.

**Files:**
- Create: `src/lib/anthropic/caption.ts`
- Create: `src/lib/anthropic/__tests__/caption.test.ts`

- [ ] **Stap 1: Schrijf de falende tests**

```typescript
// src/lib/anthropic/__tests__/caption.test.ts
import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, buildUserContent, parseCaptionResponse } from '@/lib/anthropic/caption'
import type { PostSourceShopify } from '@/lib/types'

const shopifySource: PostSourceShopify = {
  kind: 'shopify',
  productId: '1',
  productTitle: 'Houten treintje',
  images: ['https://cdn.shopify.com/img.jpg'],
  variants: [{ id: '1', title: 'Naturel / S', price: '24.95' }],
  selectedImageIndex: 0,
}

const validClaudeJson = JSON.stringify({
  opener: { variants: ['O1', 'O2', 'O3'] },
  middle: { variants: ['M1', 'M2', 'M3'] },
  closer: { variants: ['C1', 'C2', 'C3'] },
  hashtags: ['#hout', '#speelgoed', '#kids', '#natuur', '#woody'],
})

describe('buildSystemPrompt', () => {
  it('bevat de tone of voice letterlijk', () => {
    const prompt = buildSystemPrompt('Spreek als een BFF. Geen em-dashes.')
    expect(prompt).toContain('Spreek als een BFF. Geen em-dashes.')
  })

  it('bevat JSON-formaat instructie met alle velden', () => {
    const prompt = buildSystemPrompt('')
    expect(prompt).toContain('"opener"')
    expect(prompt).toContain('"middle"')
    expect(prompt).toContain('"closer"')
    expect(prompt).toContain('"hashtags"')
  })
})

describe('buildUserContent', () => {
  it('bevat een image block als er een afbeelding is', () => {
    const content = buildUserContent(shopifySource)
    const imageBlock = content.find(b => b.type === 'image')
    expect(imageBlock).toEqual({
      type: 'image',
      source: { type: 'url', url: 'https://cdn.shopify.com/img.jpg' },
    })
  })

  it('bevat productnaam in het tekstblok', () => {
    const content = buildUserContent(shopifySource)
    const textBlock = content.find(b => b.type === 'text') as { type: 'text'; text: string }
    expect(textBlock.text).toContain('Houten treintje')
  })

  it('bevat variantinfo in het tekstblok', () => {
    const content = buildUserContent(shopifySource)
    const textBlock = content.find(b => b.type === 'text') as { type: 'text'; text: string }
    expect(textBlock.text).toContain('Naturel / S')
    expect(textBlock.text).toContain('24.95')
  })

  it('slaat image block over als images leeg is', () => {
    const content = buildUserContent({ ...shopifySource, images: [] })
    expect(content.every(b => b.type !== 'image')).toBe(true)
  })

  it('slaat variantinfo over als variants ontbreekt', () => {
    const content = buildUserContent({ ...shopifySource, variants: undefined })
    const textBlock = content.find(b => b.type === 'text') as { type: 'text'; text: string }
    expect(textBlock.text).not.toContain('Varianten:')
  })
})

describe('parseCaptionResponse', () => {
  it('parsed correcte JSON naar PostCaption', () => {
    const caption = parseCaptionResponse(validClaudeJson)
    expect(caption.opener.variants).toEqual(['O1', 'O2', 'O3'])
    expect(caption.opener.selected).toBe(0)
    expect(caption.middle.variants).toEqual(['M1', 'M2', 'M3'])
    expect(caption.closer.variants).toEqual(['C1', 'C2', 'C3'])
  })

  it('eerste 3 hashtags actief, laatste 2 inactief', () => {
    const caption = parseCaptionResponse(validClaudeJson)
    expect(caption.hashtags).toHaveLength(5)
    expect(caption.hashtags[0]).toEqual({ text: '#hout', active: true })
    expect(caption.hashtags[2]).toEqual({ text: '#kids', active: true })
    expect(caption.hashtags[3]).toEqual({ text: '#natuur', active: false })
    expect(caption.hashtags[4]).toEqual({ text: '#woody', active: false })
  })

  it('geeft fout bij ongeldige JSON', () => {
    expect(() => parseCaptionResponse('dit-is-geen-json')).toThrow('Ongeldige JSON')
  })

  it('geeft fout als opener ontbreekt', () => {
    expect(() => parseCaptionResponse('{"middle":{"variants":["a","b","c"]}}')).toThrow()
  })

  it('geeft fout als hashtags geen array is', () => {
    const bad = JSON.stringify({
      opener: { variants: ['a', 'b', 'c'] },
      middle: { variants: ['a', 'b', 'c'] },
      closer: { variants: ['a', 'b', 'c'] },
      hashtags: 'niet-een-array',
    })
    expect(() => parseCaptionResponse(bad)).toThrow()
  })
})
```

- [ ] **Stap 2: Run de tests — verifieer dat ze falen**

```bash
npm run test:run 2>&1 | tail -15
```

Verwacht: FAIL — `Cannot find module '@/lib/anthropic/caption'`

- [ ] **Stap 3: Implementeer `src/lib/anthropic/caption.ts`**

```typescript
// src/lib/anthropic/caption.ts
import type { PostCaption, PostSourceShopify } from '@/lib/types'

type ContentBlock =
  | { type: 'image'; source: { type: 'url'; url: string } }
  | { type: 'text'; text: string }

type ClaudeOutput = {
  opener: { variants: [string, string, string] }
  middle: { variants: [string, string, string] }
  closer: { variants: [string, string, string] }
  hashtags: string[]
}

export function buildSystemPrompt(toneOfVoice: string): string {
  return `Je bent een social media copywriter voor WoodyKids, een Nederlandse kinderspeelgoedwinkel.
Schrijf altijd in het Nederlands.
Volg deze richtlijnen strikt op:

${toneOfVoice}

Geef je output ALTIJD als geldig JSON in exact dit formaat, zonder extra tekst:
{"opener":{"variants":["...","...","..."]},"middle":{"variants":["...","...","..."]},"closer":{"variants":["...","...","..."]},"hashtags":["...","...","...","...","..."]}`
}

export function buildUserContent(source: PostSourceShopify): ContentBlock[] {
  const content: ContentBlock[] = []

  const selectedImage = source.images[source.selectedImageIndex] ?? source.images[0]
  if (selectedImage) {
    content.push({
      type: 'image',
      source: { type: 'url', url: selectedImage },
    })
  }

  const variantLines = source.variants
    ?.map(v => `${v.title} — €${v.price}`)
    .join(', ')

  content.push({
    type: 'text',
    text: [
      `Product: ${source.productTitle}`,
      variantLines ? `Varianten: ${variantLines}` : null,
      '',
      'Schrijf een Instagram-caption in drie losse secties (opener, middenstuk, afsluiter).',
      'Elke sectie heeft drie varianten die in toon licht van elkaar verschillen.',
      'Genereer ook vijf Nederlandse hashtags.',
    ]
      .filter(line => line !== null)
      .join('\n'),
  })

  return content
}

export function parseCaptionResponse(text: string): PostCaption {
  let parsed: ClaudeOutput
  try {
    parsed = JSON.parse(text) as ClaudeOutput
  } catch {
    throw new Error('Ongeldige JSON van Claude')
  }

  if (
    !Array.isArray(parsed.opener?.variants) ||
    !Array.isArray(parsed.middle?.variants) ||
    !Array.isArray(parsed.closer?.variants) ||
    !Array.isArray(parsed.hashtags)
  ) {
    throw new Error('Onverwachte structuur in Claude-response')
  }

  return {
    opener: { variants: parsed.opener.variants, selected: 0 },
    middle: { variants: parsed.middle.variants, selected: 0 },
    closer: { variants: parsed.closer.variants, selected: 0 },
    hashtags: parsed.hashtags.map((tag, i) => ({ text: tag, active: i < 3 })),
  }
}
```

- [ ] **Stap 4: Run de tests — verifieer dat ze slagen**

```bash
npm run test:run 2>&1 | tail -10
```

Verwacht: alle tests PASS

- [ ] **Stap 5: Commit**

```bash
git add src/lib/anthropic/caption.ts src/lib/anthropic/__tests__/caption.test.ts
git commit -m "feat: add caption prompt builder and parser with tests"
```

---

## Task 4: POST /api/posts/[id]/generate-caption route

**Files:**
- Create: `src/app/api/posts/[id]/generate-caption/route.ts`

Er zijn geen unit tests voor deze route — de kernlogica (prompt building en parsing) is al getest in Task 3. De route zelf doet alleen I/O orchestratie (Supabase + Anthropic).

- [ ] **Stap 1: Maak `src/app/api/posts/[id]/generate-caption/route.ts` aan**

```typescript
// src/app/api/posts/[id]/generate-caption/route.ts
import { NextRequest, NextResponse } from 'next/server'
import type Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAnthropicClient } from '@/lib/anthropic/client'
import { buildSystemPrompt, buildUserContent, parseCaptionResponse } from '@/lib/anthropic/caption'
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

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  // Haal post op
  const { data: postRow, error: postError } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .single()

  if (postError) return NextResponse.json({ error: postError.message }, { status: 500 })

  const source = postRow.source as PostSourceShopify | null
  if (source?.kind !== 'shopify') {
    return NextResponse.json({ error: 'Only Shopify posts supported' }, { status: 400 })
  }

  // Haal tone of voice op
  const { data: settings } = await supabase
    .from('settings')
    .select('tone_of_voice')
    .eq('id', 1)
    .single()

  const toneOfVoice = settings?.tone_of_voice ?? ''

  // Roep Claude aan
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
          content: buildUserContent(source) as Anthropic.ContentBlockParam[],
        },
      ],
    })
    const block = response.content[0]
    responseText = block.type === 'text' ? block.text : ''
  } catch (err) {
    console.error('[generate-caption] Anthropic error:', err)
    return NextResponse.json({ error: 'AI generatie mislukt' }, { status: 500 })
  }

  // Parseer en sla op
  let caption: PostCaption
  try {
    caption = parseCaptionResponse(responseText)
  } catch (err) {
    console.error('[generate-caption] Parse error:', err, 'Raw:', responseText)
    return NextResponse.json({ error: 'Ongeldige AI-response' }, { status: 500 })
  }

  const { data, error: updateError } = await supabase
    .from('posts')
    .update({ caption })
    .eq('id', id)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json(mapPost(data))
}
```

- [ ] **Stap 2: Verifieer de build**

```bash
npm run build 2>&1 | tail -15
```

Verwacht: `✓ Compiled successfully`. De nieuwe route verschijnt als `ƒ /api/posts/[id]/generate-caption`.

- [ ] **Stap 3: Run alle tests**

```bash
npm run test:run 2>&1 | tail -10
```

Verwacht: alle tests PASS

- [ ] **Stap 4: Commit**

```bash
git add src/app/api/posts/[id]/generate-caption/
git commit -m "feat: add POST /api/posts/[id]/generate-caption route"
```

---

## Task 5: ProductPicker — fire-and-forget caption generatie

Direct na aanmaken van de post triggert de client de generatie op de achtergrond.

**Files:**
- Modify: `src/components/editor/ProductPicker.tsx`

- [ ] **Stap 1: Pas `handleSelect` aan in `src/components/editor/ProductPicker.tsx`**

Vervang de bestaande `handleSelect` functie (regels ~43-54):

```typescript
  async function handleSelect(product: ShopifyProduct) {
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/posts/create-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, position }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const post = await res.json() as Post
      // Fire-and-forget: caption genereert terwijl gebruiker naar de editor navigeert
      fetch(`/api/posts/${post.id}/generate-caption`, { method: 'POST' }).catch(() => {})
      onCreated(post)
      onClose()
    } catch {
      setCreateError('Toevoegen mislukt. Probeer opnieuw.')
    } finally {
      setCreating(false)
    }
  }
```

- [ ] **Stap 2: Verifieer de build**

```bash
npm run build 2>&1 | tail -10
```

Verwacht: `✓ Compiled successfully`

- [ ] **Stap 3: Commit**

```bash
git add src/components/editor/ProductPicker.tsx
git commit -m "feat: trigger caption generation in background after product selection"
```

---

## Task 6: Editor — laadstatus, polling en regenereer knop

**Files:**
- Modify: `src/app/grid/[postId]/page.tsx`

De editor heeft drie wijzigingen nodig:
1. Verwijder `!post.caption` uit de guard op regel 28
2. Voeg polling toe als caption null is
3. Voeg een "Regenereer caption" knop toe

- [ ] **Stap 1: Vervang `src/app/grid/[postId]/page.tsx` volledig**

```typescript
// src/app/grid/[postId]/page.tsx
'use client'

import { use, useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useGridStore } from '@/lib/store/gridStore'
import { PhotoCrop } from '@/components/editor/PhotoCrop'
import { PhotoSelector } from '@/components/editor/PhotoSelector'
import { CaptionBlock } from '@/components/editor/CaptionBlock'
import { HashtagBadges } from '@/components/editor/HashtagBadges'
import { ScheduleSheet } from '@/components/editor/ScheduleSheet'
import type { Post, CaptionBlock as CaptionBlockType, Hashtag, CropData } from '@/lib/types'

function EditorContent({ postId }: { postId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { posts, updatePost } = useGridStore()

  const post = posts.find(p => p.id === postId)
  const [scheduleOpen, setScheduleOpen] = useState(searchParams.get('schedule') === 'true')
  const [saving, setSaving] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!post) router.replace('/grid')
  }, [post, router])

  // Poll elke 2 seconden als caption null is, stop na 15 seconden
  useEffect(() => {
    if (!post || post.caption !== null) return

    setIsGenerating(true)
    setGenerateError(null)
    const deadline = Date.now() + 15_000

    pollingRef.current = setInterval(async () => {
      if (Date.now() > deadline) {
        clearInterval(pollingRef.current!)
        setIsGenerating(false)
        setGenerateError('Caption generatie mislukt. Probeer opnieuw.')
        return
      }
      try {
        const res = await fetch(`/api/posts/${post.id}`)
        if (!res.ok) return
        const updated: Post = await res.json()
        if (updated.caption !== null) {
          clearInterval(pollingRef.current!)
          updatePost(post.id, updated)
          setIsGenerating(false)
        }
      } catch {
        // netwerkfout, volgende tick proberen
      }
    }, 2000)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [post?.id, post?.caption === null])

  async function handleRegenerate() {
    if (!post) return
    setIsGenerating(true)
    setGenerateError(null)
    try {
      const res = await fetch(`/api/posts/${post.id}/generate-caption`, { method: 'POST' })
      if (!res.ok) throw new Error('failed')
      const updated: Post = await res.json()
      updatePost(post.id, updated)
    } catch {
      setGenerateError('Caption generatie mislukt. Probeer opnieuw.')
    } finally {
      setIsGenerating(false)
    }
  }

  if (!post || !post.source) return null

  const imageUrl = post.source.kind === 'shopify'
    ? post.source.images[post.source.selectedImageIndex]
    : post.source.mediaUrl

  const isShopify = post.source.kind === 'shopify'
  const title = post.source.kind === 'shopify' ? post.source.productTitle : 'Eigen post'

  async function save(patch: Partial<Post>) {
    setSaving(true)
    updatePost(postId, patch)
    await fetch(`/api/posts/${postId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    setSaving(false)
  }

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

  return (
    <main className="min-h-screen bg-woody-cream flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-woody-taupe/20 sticky top-0 z-10 bg-woody-bordeaux">
        <button onClick={() => router.push('/grid')} className="flex items-center gap-1 text-woody-cream text-sm font-semibold">
          <ChevronLeft size={18} />
          Terug
        </button>
        <span className="text-xs font-semibold text-woody-cream/70 truncate max-w-[140px]">{title}</span>
        <button
          onClick={() => setScheduleOpen(true)}
          className="text-xs font-bold text-woody-bordeaux bg-woody-cream px-3 py-1.5 rounded-full"
        >
          {saving ? '...' : 'Inplannen →'}
        </button>
      </header>

      {/* Photo crop */}
      <PhotoCrop
        imageUrl={imageUrl}
        cropData={post.cropData}
        onChange={(cropData: CropData) => save({ cropData })}
      />

      {/* Photo selector */}
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

      {/* Caption + hashtags */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Regenereer knop */}
        <div className="flex flex-col gap-1">
          <button
            onClick={handleRegenerate}
            disabled={isGenerating}
            className="w-full text-xs font-semibold text-woody-bordeaux border border-woody-bordeaux/40 rounded-lg py-2 disabled:opacity-40"
          >
            {isGenerating ? 'Genereren...' : 'Regenereer caption'}
          </button>
          {generateError && (
            <p className="text-xs text-red-600 text-center">{generateError}</p>
          )}
        </div>

        {/* Caption blokken of laadstatus */}
        {isGenerating || !post.caption ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-24 bg-woody-taupe/20 rounded-xl" />
            <div className="h-24 bg-woody-taupe/20 rounded-xl" />
            <div className="h-24 bg-woody-taupe/20 rounded-xl" />
            <div className="flex gap-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-7 w-20 bg-woody-taupe/20 rounded-full" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <CaptionBlock
              label="Opener"
              block={post.caption.opener}
              onChange={(opener: CaptionBlockType) => save({ caption: { ...post.caption!, opener } })}
            />
            <CaptionBlock
              label="Middenstuk"
              block={post.caption.middle}
              onChange={(middle: CaptionBlockType) => save({ caption: { ...post.caption!, middle } })}
            />
            <CaptionBlock
              label="Afsluiter"
              block={post.caption.closer}
              onChange={(closer: CaptionBlockType) => save({ caption: { ...post.caption!, closer } })}
            />
            <HashtagBadges
              hashtags={post.caption.hashtags}
              onChange={(hashtags: Hashtag[]) => save({ caption: { ...post.caption!, hashtags } })}
            />
          </>
        )}
      </div>

      <ScheduleSheet
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onConfirm={handleSchedule}
        current={post.scheduledAt}
      />
    </main>
  )
}

export default function EditorPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = use(params)
  return (
    <Suspense>
      <EditorContent postId={postId} />
    </Suspense>
  )
}
```

- [ ] **Stap 2: Verifieer de build**

```bash
npm run build 2>&1 | tail -10
```

Verwacht: `✓ Compiled successfully`

- [ ] **Stap 3: Run alle tests**

```bash
npm run test:run 2>&1 | tail -10
```

Verwacht: alle tests PASS

- [ ] **Stap 4: Commit**

```bash
git add src/app/grid/[postId]/page.tsx
git commit -m "feat: add caption loading state, polling, and regenerate button to editor"
```

- [ ] **Stap 5: Push**

```bash
git push origin main
```

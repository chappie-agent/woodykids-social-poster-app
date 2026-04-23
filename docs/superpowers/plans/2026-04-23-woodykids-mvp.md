# WoodyKids Post Builder — MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully interactive mobile-first Instagram feed planner MVP with fake data in the correct API shape, Supabase auth restricted to @woodykids.com, drag-and-drop grid, conflict detection, and a fullscreen post editor.

**Architecture:** Approach B — Zustand manages all client-side grid state (drag, order, conflict detection). Next.js API routes act as stubs returning fake data in production-ready shapes. Supabase handles auth from day 1; swapping stubs for real API calls later requires only changing the route implementations, not the UI.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind v4, shadcn/ui, Zustand, @dnd-kit + Framer Motion, @use-gesture/react, Supabase (auth + storage), Vitest

---

## File Map

```
src/
  middleware.ts                          # Auth guard + @woodykids.com domain check
  lib/
    types.ts                             # All shared TypeScript types
    fixtures/
      posts.ts                           # 12 fake posts (all states)
      products.ts                        # 9 fake Shopify products
      settings.ts                        # Default tone of voice text
    store/
      gridStore.ts                       # Zustand store: posts, order, conflict detection
    supabase/
      client.ts                          # Browser Supabase client (singleton)
      server.ts                          # Server Supabase client (per-request)
  app/
    layout.tsx                           # Root layout (fonts, Toaster)
    page.tsx                             # Redirect: /grid or /login
    login/
      page.tsx                           # Magic link login page
    grid/
      page.tsx                           # Grid page: loads posts, renders grid
      [postId]/
        page.tsx                         # Fullscreen editor page
    settings/
      page.tsx                           # Settings: tone of voice + account
    api/
      posts/
        route.ts                         # GET /api/posts
        generate/route.ts                # POST /api/posts/generate
        create-product/route.ts          # POST /api/posts/create-product
        create-upload/route.ts           # POST /api/posts/create-upload
        [id]/
          route.ts                       # PUT /api/posts/[id]   DELETE /api/posts/[id]
          publish/route.ts               # POST /api/posts/[id]/publish
          upload-media/route.ts          # POST /api/posts/[id]/upload-media
      grid/
        order/route.ts                   # PUT /api/grid/order
      settings/
        tone-of-voice/route.ts           # GET + PUT /api/settings/tone-of-voice
  components/
    grid/
      PostGrid.tsx                       # DndContext + SortableContext, renders cells
      PostCell.tsx                       # Single cell: empty / draft / conflict / locked
      ConflictBanner.tsx                 # Yellow banner listing conflict posts
      ConflictActionSheet.tsx            # Bottom sheet with 3 actions + auto-remove note
    editor/
      PhotoCrop.tsx                      # 4:5 crop frame: pinch-zoom + drag
      PhotoSelector.tsx                  # Horizontal thumbnail strip
      CaptionBlock.tsx                   # opener/middle/closer with 3 variants
      HashtagBadges.tsx                  # 5 toggleable hashtag badges
      ScheduleSheet.tsx                  # Date + time picker slide-up sheet
  test/
    setup.ts                             # @testing-library/jest-dom import
src/lib/store/__tests__/
  gridStore.test.ts                      # Unit tests for detectConflicts + setOrder
```

---

## Task 1: Install dependencies + test runner + shadcn components

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities \
  framer-motion zustand \
  @supabase/supabase-js @supabase/ssr \
  @use-gesture/react
```

Expected: no errors, packages appear in `node_modules/`.

- [ ] **Step 2: Install dev dependencies (test runner)**

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react \
  @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Create vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
})
```

- [ ] **Step 4: Create test setup file**

Create `src/test/setup.ts`:
```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Add test script to package.json**

In `package.json`, add under `"scripts"`:
```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 6: Add required shadcn components**

```bash
npx shadcn@latest add sheet calendar popover scroll-area separator label switch
```

Expected: new files in `src/components/ui/`.

- [ ] **Step 7: Add .superpowers/ to .gitignore**

Add to `.gitignore`:
```
.superpowers/
.env.local
```

- [ ] **Step 8: Run tests to verify setup**

```bash
npm run test:run
```

Expected: "No test files found" — confirms Vitest is wired correctly.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: install deps, configure vitest, add shadcn components"
```

---

## Task 2: Define shared types

**Files:**
- Create: `src/lib/types.ts`

- [ ] **Step 1: Write types**

Create `src/lib/types.ts`:
```ts
export type PostSourceShopify = {
  kind: 'shopify'
  productId: string
  productTitle: string
  images: string[]
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
  position: number        // 0 = top-left (newest), ascending = older
  source: PostSource | null
  cropData: CropData
  caption: PostCaption | null
  scheduledAt: string | null   // ISO 8601
  isPerson: boolean
}

export type Product = {
  id: string
  title: string
  images: string[]
}

export type ToneOfVoice = {
  content: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 3: Create fake data fixtures

**Files:**
- Create: `src/lib/fixtures/products.ts`
- Create: `src/lib/fixtures/posts.ts`
- Create: `src/lib/fixtures/settings.ts`

- [ ] **Step 1: Create products fixture**

Create `src/lib/fixtures/products.ts`:
```ts
import type { Product } from '@/lib/types'

export const fakeProducts: Product[] = [
  {
    id: 'prod-1', title: 'Houten treintje set',
    images: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600',
      'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600',
      'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=600',
    ],
  },
  {
    id: 'prod-2', title: 'Speelkeuken naturel',
    images: [
      'https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=600',
      'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=600',
    ],
  },
  {
    id: 'prod-3', title: 'Houten bouwblokken',
    images: [
      'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=600',
      'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=600',
    ],
  },
  {
    id: 'prod-4', title: 'Stapeltoren regenboog',
    images: [
      'https://images.unsplash.com/photo-1551690029-b9e0e30f1e29?w=600',
      'https://images.unsplash.com/photo-1608889335941-32ac5f2041b9?w=600',
    ],
  },
  {
    id: 'prod-5', title: 'Houten verfset',
    images: [
      'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600',
      'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600',
    ],
  },
  {
    id: 'prod-6', title: 'Hoepel naturel',
    images: [
      'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600',
      'https://images.unsplash.com/photo-1488496508190-6b6e04c85a5b?w=600',
    ],
  },
  {
    id: 'prod-7', title: 'Grijpringen baby',
    images: [
      'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600',
      'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=600',
    ],
  },
  {
    id: 'prod-8', title: 'Houten puzzel dieren',
    images: [
      'https://images.unsplash.com/photo-1596460107916-430662021049?w=600',
      'https://images.unsplash.com/photo-1560707303-4e980ce876ad?w=600',
    ],
  },
  {
    id: 'prod-9', title: 'Speelgoedkeuken accessoires',
    images: [
      'https://images.unsplash.com/photo-1531315396756-905d68d21b56?w=600',
      'https://images.unsplash.com/photo-1558882224-dda166733046?w=600',
    ],
  },
]
```

- [ ] **Step 2: Create posts fixture**

Create `src/lib/fixtures/posts.ts`:
```ts
import type { Post } from '@/lib/types'

const defaultCrop = { x: 0, y: 0, scale: 1 }

const makeCaption = (
  o1: string, o2: string, o3: string,
  m1: string, m2: string, m3: string,
  c1: string, c2: string, c3: string,
  tags: string[],
) => ({
  opener: { variants: [o1, o2, o3] as [string, string, string], selected: 0 as const },
  middle: { variants: [m1, m2, m3] as [string, string, string], selected: 0 as const },
  closer: { variants: [c1, c2, c3] as [string, string, string], selected: 0 as const },
  hashtags: tags.map((text, i) => ({ text, active: i < 3 })),
})

export const fakePosts: Post[] = [
  // ── Lege slots (positions 0-2) ───────────────────────────────
  { id: 'empty-1', state: 'empty', position: 0, source: null, cropData: defaultCrop, caption: null, scheduledAt: null, isPerson: false },
  { id: 'empty-2', state: 'empty', position: 1, source: null, cropData: defaultCrop, caption: null, scheduledAt: null, isPerson: false },
  { id: 'empty-3', state: 'empty', position: 2, source: null, cropData: defaultCrop, caption: null, scheduledAt: null, isPerson: false },

  // ── Draft posts (positions 3-5) ──────────────────────────────
  {
    id: 'draft-1', state: 'draft', position: 3, isPerson: true,
    source: { kind: 'shopify', productId: 'prod-1', productTitle: 'Houten treintje set', images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600', 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600'], selectedImageIndex: 1 },
    cropData: defaultCrop,
    caption: makeCaption(
      'Dit treintje past in iedere speelkamer.', 'Sjoe, dit is een leuke.', 'Kleine ingenieur in de maak.',
      'Gemaakt van duurzaam beuken­hout, veilig geverfd.', 'Elk onderdeel past op een veilige pen.', 'Geen scherpe randjes, wel veel plezier.',
      'Bestel hem voor je het weet weg is.', 'Tip: combineer met de bouwblokken set.', 'Cadeau­tip voor kleine treinliefhebbers.',
      ['#woodykids', '#houtenspeelgoed', '#treintje', '#duurzaamspeelgoed', '#kidstoys'],
    ),
    scheduledAt: null,
  },
  {
    id: 'draft-2', state: 'draft', position: 4, isPerson: false,
    source: { kind: 'shopify', productId: 'prod-2', productTitle: 'Speelkeuken naturel', images: ['https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=600', 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=600'], selectedImageIndex: 1 },
    cropData: defaultCrop,
    caption: makeCaption(
      'De keuken van hun dromen, maar dan van hout.', 'Koken zonder gas, dat kan ook.', 'Michelin-ster in de maak.',
      'Naturel hout, geen verf, wel veel smaak.', 'Solide constructie die jaren meegaat.', 'Past naast elk interieur.',
      'Hoek kiezen en bestellen maar.', 'Tip: combineer met de accessoires set.', 'Cadeautip voor echte keukenprinsen en prinsessen.',
      ['#woodykids', '#speelkeuken', '#houtenspeelgoed', '#naturelspelen', '#kidsroom'],
    ),
    scheduledAt: null,
  },
  {
    id: 'draft-3', state: 'draft', position: 5, isPerson: true,
    source: { kind: 'shopify', productId: 'prod-4', productTitle: 'Stapeltoren regenboog', images: ['https://images.unsplash.com/photo-1551690029-b9e0e30f1e29?w=600'], selectedImageIndex: 0 },
    cropData: defaultCrop,
    caption: makeCaption(
      'Stapelen, omgooien, opnieuw. Herhaal.', 'Elke kleur is een nieuwe uitdaging.', 'Regenboog in de kinderkamer.',
      'Traint de fijne motoriek én het geduld.', 'Elk blokje is iets anders groot.', 'Gemaakt van lindehout, veilig geverfd.',
      'Welke kleur pakt jouw kind als eerste?', 'Cadeau­tip voor 1 t/m 4 jaar.', 'Tip: begin met de grote blokken.',
      ['#woodykids', '#stapeltoren', '#regenboogspelen', '#montessori', '#babyspeelgoed'],
    ),
    scheduledAt: null,
  },

  // ── Conflict post (position 6) ───────────────────────────────
  {
    id: 'conflict-1', state: 'conflict', position: 6, isPerson: true,
    source: { kind: 'shopify', productId: 'prod-3', productTitle: 'Houten bouwblokken', images: ['https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=600', 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=600'], selectedImageIndex: 1 },
    cropData: defaultCrop,
    caption: makeCaption(
      'Bouwen tot het omvalt. Dan opnieuw.', 'De klassieke bouwblokken, maar dan beter.', 'Klein, maar wat kunnen ze er wat mee.',
      'Veilig beuken­hout, geen scherpe kanten.', '42 blokken in 6 vormen.', 'Schuurpapier-glad afgewerkt.',
      'Welk bouwwerk maakt jouw kind?', 'Cadeau­tip voor 2 t/m 6 jaar.', 'Tip: bewaar ze in de houten mand.',
      ['#woodykids', '#bouwblokken', '#houtenspeelgoed', '#duurzaamspeelgoed', '#kidsplay'],
    ),
    scheduledAt: null,
  },

  // ── Locked posts (positions 7-11) ────────────────────────────
  {
    id: 'locked-1', state: 'locked', position: 7, isPerson: false,
    source: { kind: 'shopify', productId: 'prod-5', productTitle: 'Houten verfset', images: ['https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600'], selectedImageIndex: 0 },
    cropData: defaultCrop,
    caption: makeCaption(
      'Kunstenaar in de maak.', 'Kleine handen, groot talent.', 'Van hout naar kunst.',
      'Veilige verf, echte kwasten.', 'Alles zit erin om te beginnen.', 'Compact formaat voor onderweg.',
      'Welk meesterwerk schildert jouw kind?', 'Tip: doe er een schort bij.', 'Cadeau­tip voor kleine Picasso\'s.',
      ['#woodykids', '#verfset', '#kunstenaar', '#kidsart', '#houtenspeelgoed'],
    ),
    scheduledAt: '2026-04-23T10:00:00.000Z',
  },
  {
    id: 'locked-2', state: 'locked', position: 8, isPerson: true,
    source: { kind: 'shopify', productId: 'prod-6', productTitle: 'Hoepel naturel', images: ['https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600'], selectedImageIndex: 0 },
    cropData: defaultCrop,
    caption: makeCaption(
      'Weg van het scherm, met de hoepel erop.', 'Buiten spelen heeft nog nooit zo goed gevoeld.', 'De hoepel is terug.',
      'Naturel berken­hout, super licht.', 'Duurzaam en tijdloos.', 'Goed voor de coördinatie.',
      'Tij­dens de zomer onmisbaar.', 'Tip: ook leuk voor volwassenen.', 'Bestel hem voor het seizoen begint.',
      ['#woodykids', '#hoepel', '#buitenspelen', '#naturelspelen', '#duurzaamspeelgoed'],
    ),
    scheduledAt: '2026-04-22T09:00:00.000Z',
  },
  {
    id: 'locked-3', state: 'locked', position: 9, isPerson: false,
    source: { kind: 'shopify', productId: 'prod-7', productTitle: 'Grijpringen baby', images: ['https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600'], selectedImageIndex: 0 },
    cropData: defaultCrop,
    caption: makeCaption(
      'Eerste speelgoed, voor altijd bijzonder.', 'Kleine handjes, groot plezier.', 'Van dag één speelplezier.',
      'Veilig beuken­hout, spit-proof afgewerkt.', 'Elk ding heeft een andere textuur.', 'BPA-vrij en CE-gecertificeerd.',
      'Tip voor kraamcadeaus: altijd raak.', 'Bestel voor de geboorte.', 'Eerste cadeau, laatste keuze.',
      ['#woodykids', '#babyspeelgoed', '#grijpringen', '#newborn', '#houtenspeelgoed'],
    ),
    scheduledAt: '2026-04-21T11:00:00.000Z',
  },
  {
    id: 'locked-4', state: 'locked', position: 10, isPerson: true,
    source: { kind: 'shopify', productId: 'prod-8', productTitle: 'Houten puzzel dieren', images: ['https://images.unsplash.com/photo-1596460107916-430662021049?w=600'], selectedImageIndex: 0 },
    cropData: defaultCrop,
    caption: makeCaption(
      'Passen en meten, dat doet dit kind al.', 'Welk dier past waar?', 'Puzzelen als pro.',
      'Zes dieren, zes vormen, één plezier.', 'Veilig verf, stevige stukken.', 'Geschikt voor 18 maanden en ouder.',
      'Tip: benoem elk dier hardop.', 'Cadeau­tip voor peuters.', 'Bestel hem nu.',
      ['#woodykids', '#puzzel', '#houtenspeelgoed', '#peuter', '#leren'],
    ),
    scheduledAt: '2026-04-20T11:00:00.000Z',
  },
  {
    id: 'locked-5', state: 'locked', position: 11, isPerson: false,
    source: { kind: 'upload', mediaUrl: 'https://images.unsplash.com/photo-1531315396756-905d68d21b56?w=600', mediaType: 'image', userPrompt: 'Pasen campagne, 15% korting op alles' },
    cropData: defaultCrop,
    caption: makeCaption(
      'Pasen vieren met houten speelgoed.', 'Dit jaar een ander paasei.', 'Geef iets blijvends.',
      '15% korting op alle producten deze week.', 'Gebruik code PASEN26 bij afrekenen.', 'Tot en met zondag geldig.',
      'Bestel voor zaterdag voor Pasen levering.', 'Tip: combineer twee producten.', 'Fijne Pasen van WoodyKids.',
      ['#woodykids', '#pasen', '#aanbieding', '#houtenspeelgoed', '#kidsofinstagram'],
    ),
    scheduledAt: '2026-04-19T09:00:00.000Z',
  },
]
```

- [ ] **Step 3: Create settings fixture**

Create `src/lib/fixtures/settings.ts`:
```ts
import type { ToneOfVoice } from '@/lib/types'

export const defaultToneOfVoice: ToneOfVoice = {
  content: `Schrijf alsof je je beste vriendin een tip geeft. Niet: "Dit product is vervaardigd uit duurzame materialen." Maar: "Dit ding gaat mee tot je kind op de middelbare zit."

Regels:
- Korte zinnen. Maximaal twee komma's per zin.
- Altijd actief. Niet "wordt gemaakt" maar "maken we".
- Geen em-dash, geen dubbele punt halverwege een zin.
- Humor mag, maar één grapje per post is genoeg.
- Opener: haak meteen in, geen "Hé mama!" als openingszin.
- Middenstuk: één concreet ding over het product.
- Afsluiter: sluit af met energie, geen "bestel nu".
- Emoji: max 2 per post, alleen als ze echt iets toevoegen. Geen confetti, geen 100.`,
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/fixtures/
git commit -m "feat: add fake data fixtures for posts, products, and settings"
```

---

## Task 4: Zustand store + conflict detection (with tests)

**Files:**
- Create: `src/lib/store/gridStore.ts`
- Create: `src/lib/store/__tests__/gridStore.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `src/lib/store/__tests__/gridStore.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useGridStore } from '../gridStore'

const makeDraft = (id: string, position: number) => ({
  id, state: 'draft' as const, position, isPerson: false,
  source: null, cropData: { x: 0, y: 0, scale: 1 }, caption: null, scheduledAt: null,
})
const makeLocked = (id: string, position: number) => ({
  ...makeDraft(id, position), state: 'locked' as const,
  scheduledAt: '2026-04-20T10:00:00.000Z',
})
const makeEmpty = (id: string, position: number) => ({
  ...makeDraft(id, position), state: 'empty' as const,
})

describe('detectConflicts', () => {
  beforeEach(() => {
    useGridStore.setState({ posts: [], conflictIds: [] })
  })

  it('marks a draft as conflict when a locked post has a lower position', () => {
    const { result } = renderHook(() => useGridStore())
    act(() => {
      result.current.setPosts([
        makeLocked('locked-1', 3),
        makeDraft('draft-1', 4),
      ])
    })
    expect(result.current.conflictIds).toContain('draft-1')
  })

  it('does not conflict when all locked posts have higher positions', () => {
    const { result } = renderHook(() => useGridStore())
    act(() => {
      result.current.setPosts([
        makeDraft('draft-1', 2),
        makeDraft('draft-2', 3),
        makeLocked('locked-1', 5),
        makeLocked('locked-2', 6),
      ])
    })
    expect(result.current.conflictIds).toHaveLength(0)
  })

  it('marks multiple drafts as conflict', () => {
    const { result } = renderHook(() => useGridStore())
    act(() => {
      result.current.setPosts([
        makeLocked('locked-1', 2),
        makeDraft('draft-1', 3),
        makeDraft('draft-2', 4),
        makeLocked('locked-2', 5),
      ])
    })
    expect(result.current.conflictIds).toContain('draft-1')
    expect(result.current.conflictIds).toContain('draft-2')
  })

  it('empty slots are never conflicts', () => {
    const { result } = renderHook(() => useGridStore())
    act(() => {
      result.current.setPosts([
        makeLocked('locked-1', 0),
        makeEmpty('empty-1', 1),
      ])
    })
    expect(result.current.conflictIds).not.toContain('empty-1')
  })
})

describe('setOrder', () => {
  it('updates positions to match the provided id order', () => {
    const { result } = renderHook(() => useGridStore())
    act(() => {
      result.current.setPosts([makeDraft('a', 0), makeDraft('b', 1), makeDraft('c', 2)])
      result.current.setOrder(['c', 'a', 'b'])
    })
    const sorted = [...result.current.posts].sort((x, y) => x.position - y.position)
    expect(sorted.map(p => p.id)).toEqual(['c', 'a', 'b'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run
```

Expected: FAIL — `useGridStore` not found.

- [ ] **Step 3: Implement the store**

Create `src/lib/store/gridStore.ts`:
```ts
import { create } from 'zustand'
import type { Post } from '@/lib/types'

type GridStore = {
  posts: Post[]
  conflictIds: string[]
  draggingId: string | null
  setPosts: (posts: Post[]) => void
  setOrder: (ids: string[]) => void
  setDragging: (id: string | null) => void
  updatePost: (id: string, patch: Partial<Post>) => void
  detectConflicts: () => void
}

export const useGridStore = create<GridStore>((set, get) => ({
  posts: [],
  conflictIds: [],
  draggingId: null,

  setPosts: (posts) => {
    set({ posts })
    get().detectConflicts()
  },

  setOrder: (ids) => {
    set(state => ({
      posts: state.posts.map(p => ({ ...p, position: ids.indexOf(p.id) })),
    }))
    get().detectConflicts()
  },

  setDragging: (id) => set({ draggingId: id }),

  updatePost: (id, patch) => {
    set(state => ({
      posts: state.posts.map(p => p.id === id ? { ...p, ...patch } : p),
    }))
    get().detectConflicts()
  },

  detectConflicts: () => {
    const { posts } = get()
    const lockedPositions = posts
      .filter(p => p.state === 'locked')
      .map(p => p.position)

    if (lockedPositions.length === 0) {
      set({ conflictIds: [] })
      return
    }

    const minLockedPosition = Math.min(...lockedPositions)

    const conflictIds = posts
      .filter(p => p.state === 'draft' && p.position > minLockedPosition)
      .map(p => p.id)

    // Update state field on the posts themselves
    set(state => ({
      conflictIds,
      posts: state.posts.map(p => {
        if (p.state === 'draft' && conflictIds.includes(p.id)) return { ...p, state: 'conflict' as const }
        if (p.state === 'conflict' && !conflictIds.includes(p.id)) return { ...p, state: 'draft' as const }
        return p
      }),
    }))
  },
}))
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:run
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/store/
git commit -m "feat: add Zustand grid store with conflict detection"
```

---

## Task 5: API route stubs

**Files:**
- Create: `src/app/api/posts/route.ts`
- Create: `src/app/api/posts/generate/route.ts`
- Create: `src/app/api/posts/create-product/route.ts`
- Create: `src/app/api/posts/create-upload/route.ts`
- Create: `src/app/api/posts/[id]/route.ts`
- Create: `src/app/api/posts/[id]/publish/route.ts`
- Create: `src/app/api/posts/[id]/upload-media/route.ts`
- Create: `src/app/api/grid/order/route.ts`
- Create: `src/app/api/settings/tone-of-voice/route.ts`

- [ ] **Step 1: GET /api/posts**

Create `src/app/api/posts/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { fakePosts } from '@/lib/fixtures/posts'

export async function GET() {
  return NextResponse.json(fakePosts)
}
```

- [ ] **Step 2: POST /api/posts/generate**

Create `src/app/api/posts/generate/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { fakeProducts } from '@/lib/fixtures/products'
import type { Post, PostCaption } from '@/lib/types'
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
  const { count, startPosition } = await request.json() as { count: number; startPosition: number }

  const newPosts: Post[] = Array.from({ length: count }, (_, i) => {
    const product = fakeProducts[i % fakeProducts.length]
    const isPerson = i % 2 === 0
    return {
      id: randomUUID(),
      state: 'draft',
      position: startPosition + i,
      isPerson,
      source: {
        kind: 'shopify',
        productId: product.id,
        productTitle: product.title,
        images: product.images,
        selectedImageIndex: Math.min(1, product.images.length - 1),
      },
      cropData: { x: 0, y: 0, scale: 1 },
      caption: makeCaption(),
      scheduledAt: null,
    }
  })

  return NextResponse.json(newPosts)
}
```

- [ ] **Step 3: POST /api/posts/create-product**

Create `src/app/api/posts/create-product/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { fakeProducts } from '@/lib/fixtures/products'
import type { Post } from '@/lib/types'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  const { productId, position } = await request.json() as { productId: string; position: number }
  const product = fakeProducts.find(p => p.id === productId) ?? fakeProducts[0]

  const post: Post = {
    id: randomUUID(),
    state: 'draft',
    position,
    isPerson: false,
    source: {
      kind: 'shopify',
      productId: product.id,
      productTitle: product.title,
      images: product.images,
      selectedImageIndex: Math.min(1, product.images.length - 1),
    },
    cropData: { x: 0, y: 0, scale: 1 },
    caption: null,
    scheduledAt: null,
  }

  return NextResponse.json(post)
}
```

- [ ] **Step 4: POST /api/posts/create-upload**

Create `src/app/api/posts/create-upload/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import type { Post } from '@/lib/types'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  const { mediaUrl, mediaType, userPrompt, position } = await request.json() as {
    mediaUrl: string; mediaType: 'image' | 'video'; userPrompt: string; position: number
  }

  const post: Post = {
    id: randomUUID(),
    state: 'draft',
    position,
    isPerson: false,
    source: { kind: 'upload', mediaUrl, mediaType, userPrompt },
    cropData: { x: 0, y: 0, scale: 1 },
    caption: null,
    scheduledAt: null,
  }

  return NextResponse.json(post)
}
```

- [ ] **Step 5: PUT + DELETE /api/posts/[id]**

Create `src/app/api/posts/[id]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import type { Post } from '@/lib/types'

// In MVP: acknowledge the update and echo back the patch.
// Real implementation: update Supabase DB.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const patch = await request.json() as Partial<Post>
  return NextResponse.json({ id, ...patch })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return NextResponse.json({ deleted: id })
}
```

- [ ] **Step 6: POST /api/posts/[id]/publish**

Create `src/app/api/posts/[id]/publish/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { scheduledAt } = await request.json() as { scheduledAt: string }
  // Real implementation: POST to Zernio API
  console.log(`[stub] Post ${id} queued for Zernio at ${scheduledAt}`)
  return NextResponse.json({ queued: true, id, scheduledAt })
}
```

- [ ] **Step 7: POST /api/posts/[id]/upload-media**

Create `src/app/api/posts/[id]/upload-media/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  // Real implementation: upload to Supabase Storage, return public URL
  // MVP: return a placeholder URL
  const mediaUrl = `https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600`
  console.log(`[stub] Media upload for post ${id}`)
  return NextResponse.json({ mediaUrl })
}
```

- [ ] **Step 8: PUT /api/grid/order**

Create `src/app/api/grid/order/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(request: NextRequest) {
  const { ids } = await request.json() as { ids: string[] }
  // Real implementation: update positions in Supabase DB
  console.log('[stub] Grid order saved:', ids)
  return NextResponse.json({ saved: true })
}
```

- [ ] **Step 9: GET + PUT /api/settings/tone-of-voice**

Create `src/app/api/settings/tone-of-voice/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { defaultToneOfVoice } from '@/lib/fixtures/settings'

// In-memory for MVP; real implementation reads/writes Supabase DB
let current = defaultToneOfVoice.content

export async function GET() {
  return NextResponse.json({ content: current })
}

export async function PUT(request: NextRequest) {
  const { content } = await request.json() as { content: string }
  current = content
  return NextResponse.json({ content })
}
```

- [ ] **Step 10: Commit**

```bash
git add src/app/api/
git commit -m "feat: add all API route stubs in production-ready shape"
```

---

## Task 6: Supabase setup

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `.env.local` (manually — not committed)

- [ ] **Step 1: Create Supabase project (manual)**

1. Go to https://supabase.com → New project
2. Note your Project URL and anon key from Settings → API
3. Enable Email provider: Authentication → Providers → Email → Enable "Magic Link"

- [ ] **Step 2: Create .env.local**

Create `.env.local` (already in .gitignore):
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 3: Create browser Supabase client**

Create `src/lib/supabase/client.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

- [ ] **Step 4: Create server Supabase client**

Create `src/lib/supabase/server.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options))
          } catch {}
        },
      },
    },
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat: add Supabase browser and server client helpers"
```

---

## Task 7: Auth middleware

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create middleware**

Create `src/middleware.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  const isLoginPage = request.nextUrl.pathname === '/login'

  // Not logged in → redirect to login
  if (!user && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Logged in but wrong domain → sign out and redirect
  if (user && !user.email?.endsWith('@woodykids.com')) {
    await supabase.auth.signOut()
    const url = new URL('/login', request.url)
    url.searchParams.set('error', 'unauthorized')
    return NextResponse.redirect(url)
  }

  // Already logged in → skip login page
  if (user && isLoginPage) {
    return NextResponse.redirect(new URL('/grid', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add auth middleware with @woodykids.com domain check"
```

---

## Task 8: Login page

**Files:**
- Create: `src/app/login/page.tsx`

- [ ] **Step 1: Create login page**

Create `src/app/login/page.tsx`:
```tsx
'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const isUnauthorized = searchParams.get('error') === 'unauthorized'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.endsWith('@woodykids.com')) {
      setError('Alleen @woodykids.com accounts hebben toegang.')
      return
    }
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/grid` },
    })
    setLoading(false)
    if (authError) { setError(authError.message); return }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="text-center space-y-2">
        <p className="text-2xl">📬</p>
        <p className="font-semibold text-orange-900">Check je inbox</p>
        <p className="text-sm text-orange-700/60">We stuurden een magic link naar {email}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-xs">
      {isUnauthorized && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          Alleen @woodykids.com accounts hebben toegang.
        </p>
      )}
      <div className="space-y-1">
        <Label htmlFor="email">E-mailadres</Label>
        <Input
          id="email"
          type="email"
          placeholder="jij@woodykids.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="border-orange-200 focus-visible:ring-orange-300"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white"
      >
        {loading ? 'Versturen...' : 'Stuur magic link →'}
      </Button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#FFF8F0] flex flex-col items-center justify-center px-6 gap-8">
      <div className="text-center space-y-1">
        <div className="text-4xl">🪵</div>
        <h1 className="text-2xl font-extrabold text-orange-900">WoodyKids Poster</h1>
        <p className="text-sm text-orange-700/50">Alleen voor het WoodyKids team</p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/login/
git commit -m "feat: add magic link login page"
```

---

## Task 9: Root layout + redirect

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update root layout**

Overwrite `src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'WoodyKids Poster',
  description: 'Instagram feed planner voor WoodyKids',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Toaster position="bottom-center" />
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Update root redirect**

Overwrite `src/app/page.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  redirect(user ? '/grid' : '/login')
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx
git commit -m "feat: root layout with Toaster, root redirect to grid or login"
```

---

## Task 10: PostCell component

**Files:**
- Create: `src/components/grid/PostCell.tsx`

- [ ] **Step 1: Create PostCell**

Create `src/components/grid/PostCell.tsx`:
```tsx
import type { Post } from '@/lib/types'

type Props = {
  post: Post
  isDragging?: boolean
  onTap?: () => void
}

function getImageUrl(post: Post): string | null {
  if (!post.source) return null
  if (post.source.kind === 'shopify') return post.source.images[post.source.selectedImageIndex] ?? post.source.images[0]
  return post.source.mediaUrl
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function PostCell({ post, isDragging, onTap }: Props) {
  const imageUrl = getImageUrl(post)

  if (post.state === 'empty') {
    return (
      <div className="aspect-[4/5] rounded-md border-[1.5px] border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
        <span className="text-[9px] font-bold text-gray-300 uppercase tracking-wider">leeg</span>
      </div>
    )
  }

  const isConflict = post.state === 'conflict'
  const isLocked = post.state === 'locked'

  return (
    <div
      className={[
        'aspect-[4/5] rounded-md relative overflow-hidden select-none',
        isLocked ? (post.isPerson ? 'bg-violet-200' : 'bg-blue-200') : (post.isPerson ? 'bg-yellow-200' : 'bg-orange-200'),
        isConflict ? 'ring-[2.5px] ring-amber-400 ring-offset-0' : '',
        isDragging ? 'opacity-40' : '',
        !isLocked ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed',
      ].join(' ')}
      onClick={onTap}
    >
      {/* Background image */}
      {imageUrl && (
        <img
          src={imageUrl}
          alt={post.source?.kind === 'shopify' ? post.source.productTitle : 'Eigen upload'}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      )}

      {/* Overlay gradient for readability */}
      {imageUrl && <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/40" />}

      {/* Conflict pulse ring — CSS animation via Tailwind arbitrary */}
      {isConflict && (
        <span className="absolute inset-[-3px] rounded-[7px] border-[2.5px] border-amber-400 animate-pulse pointer-events-none" />
      )}

      {/* ! badge for conflict */}
      {isConflict && (
        <div className="absolute top-[-5px] left-[-5px] z-10 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center shadow">
          <span className="text-[9px] font-black text-white">!</span>
        </div>
      )}

      {/* Draft chip */}
      {(post.state === 'draft' || post.state === 'conflict') && (
        <div className="absolute top-1 left-1 bg-white/80 rounded-[3px] px-1 py-0.5 text-[7px] font-bold text-orange-500">
          concept
        </div>
      )}

      {/* Lock icon for locked */}
      {isLocked && (
        <div className="absolute top-1 right-1 text-[11px] leading-none">🔒</div>
      )}

      {/* Date badge for locked */}
      {isLocked && post.scheduledAt && (
        <div className="absolute bottom-1 left-1 right-1 bg-white/85 rounded-[3px] px-1 py-0.5 text-[7px] font-bold text-blue-800 text-center truncate">
          {formatDate(post.scheduledAt)}
        </div>
      )}

      {/* Product title for draft (no image) */}
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
git commit -m "feat: PostCell component with all four states"
```

---

## Task 11: PostGrid with drag-and-drop

**Files:**
- Create: `src/components/grid/PostGrid.tsx`

- [ ] **Step 1: Create PostGrid**

Create `src/components/grid/PostGrid.tsx`:
```tsx
'use client'

import {
  DndContext, DragEndEvent, DragStartEvent,
  MouseSensor, TouchSensor, useSensor, useSensors,
  closestCenter,
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useGridStore } from '@/lib/store/gridStore'
import { PostCell } from './PostCell'
import type { Post } from '@/lib/types'

function SortableCell({ post }: { post: Post }) {
  const router = useRouter()
  const { draggingId } = useGridStore()
  const isDragging = draggingId === post.id

  const {
    attributes, listeners, setNodeRef, transform, transition,
  } = useSortable({
    id: post.id,
    disabled: post.state === 'locked' || post.state === 'empty',
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 'auto' as const,
  }

  function handleTap() {
    if (post.state === 'draft' || post.state === 'conflict') {
      router.push(`/grid/${post.id}`)
    }
  }

  return (
    <motion.div
      layout
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <PostCell post={post} isDragging={isDragging} onTap={handleTap} />
    </motion.div>
  )
}

export function PostGrid() {
  const { posts, setOrder, setDragging } = useGridStore()

  const sorted = [...posts].sort((a, b) => a.position - b.position)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 5 } }),
  )

  function handleDragStart(event: DragStartEvent) {
    setDragging(event.active.id as string)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setDragging(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sorted.findIndex(p => p.id === active.id)
    const newIndex = sorted.findIndex(p => p.id === over.id)

    // Locked posts are not moveable — but drafts can be inserted around them
    const overPost = sorted[newIndex]
    if (overPost.state === 'locked' || overPost.state === 'empty') return

    const newOrder = [...sorted]
    const [moved] = newOrder.splice(oldIndex, 1)
    newOrder.splice(newIndex, 0, moved)

    const ids = newOrder.map(p => p.id)
    setOrder(ids)

    // Persist order to API (fire and forget in MVP)
    fetch('/api/grid/order', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={sorted.map(p => p.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-3 gap-[3px] p-[3px]">
          <AnimatePresence>
            {sorted.map(post => (
              <SortableCell key={post.id} post={post} />
            ))}
          </AnimatePresence>
        </div>
      </SortableContext>
    </DndContext>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/grid/PostGrid.tsx
git commit -m "feat: PostGrid with @dnd-kit drag-and-drop and Framer Motion layout animations"
```

---

## Task 12: ConflictBanner + ConflictActionSheet

**Files:**
- Create: `src/components/grid/ConflictBanner.tsx`
- Create: `src/components/grid/ConflictActionSheet.tsx`

- [ ] **Step 1: Create ConflictBanner**

Create `src/components/grid/ConflictBanner.tsx`:
```tsx
'use client'

import { useGridStore } from '@/lib/store/gridStore'

type Props = { onTap: () => void }

export function ConflictBanner({ onTap }: Props) {
  const { posts, conflictIds } = useGridStore()
  if (conflictIds.length === 0) return null

  const conflictTitles = posts
    .filter(p => conflictIds.includes(p.id))
    .map(p => p.source?.kind === 'shopify' ? p.source.productTitle : 'Eigen post')
    .join(', ')

  return (
    <button
      onClick={onTap}
      className="w-full flex items-start gap-2 px-3 py-2 bg-amber-50 border-b border-amber-200 text-left"
    >
      <span className="text-sm mt-0.5 flex-shrink-0">⚠️</span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-amber-800">
          {conflictIds.length === 1 ? '1 post dreigt te laat' : `${conflictIds.length} posts dreigen te laat`}
        </p>
        <p className="text-[10px] text-amber-700 truncate">{conflictTitles}</p>
      </div>
      <span className="text-amber-500 text-sm flex-shrink-0">›</span>
    </button>
  )
}
```

- [ ] **Step 2: Create ConflictActionSheet**

Create `src/components/grid/ConflictActionSheet.tsx`:
```tsx
'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useGridStore } from '@/lib/store/gridStore'
import { useRouter } from 'next/navigation'

type Props = {
  open: boolean
  onClose: () => void
}

export function ConflictActionSheet({ open, onClose }: Props) {
  const { posts, conflictIds, setOrder, updatePost } = useGridStore()
  const router = useRouter()

  const conflictPost = posts.find(p => conflictIds.includes(p.id))
  const title = conflictPost?.source?.kind === 'shopify'
    ? conflictPost.source.productTitle
    : 'Eigen post'

  function handleScheduleNow() {
    onClose()
    if (conflictPost) router.push(`/grid/${conflictPost.id}?schedule=true`)
  }

  function handleMoveUp() {
    if (!conflictPost) return
    // Move conflict post to just before the first locked post
    const byPosition = [...posts].sort((a, b) => a.position - b.position)
    const firstLockedIdx = byPosition.findIndex(p => p.state === 'locked')
    if (firstLockedIdx === -1) return
    const withoutConflict = byPosition.filter(p => p.id !== conflictPost.id)
    withoutConflict.splice(firstLockedIdx, 0, conflictPost)
    setOrder(withoutConflict.map(p => p.id))
    fetch('/api/grid/order', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: withoutConflict.map(p => p.id) }),
    })
    onClose()
  }

  async function handleAutoRemove() {
    if (!conflictPost) return
    await fetch(`/api/posts/${conflictPost.id}`, { method: 'DELETE' })
    const remaining = posts.filter(p => p.id !== conflictPost.id)
    const ids = [...remaining].sort((a, b) => a.position - b.position).map(p => p.id)
    setOrder(ids)
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-left text-sm">⚠️ Post staat ingeklemd</SheetTitle>
          <p className="text-[11px] text-muted-foreground text-left">
            &ldquo;{title}&rdquo; is omringd door al-gepubliceerde posts maar staat zelf nog niet ingepland.
          </p>
        </SheetHeader>
        <div className="space-y-2">
          <ActionRow icon="📅" title="Nu inplannen" desc="Kies datum & tijd in de editor." onTap={handleScheduleNow} />
          <ActionRow icon="↕️" title="Verplaatsen naar het heden" desc="Schuif de post boven de geplande posts." onTap={handleMoveUp} />
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 flex gap-3">
            <span className="text-base flex-shrink-0 mt-0.5">🕐</span>
            <div>
              <p className="text-[11px] font-bold text-gray-500">Niets doen = automatisch verwijderd</p>
              <p className="text-[10px] text-gray-400 leading-relaxed mt-0.5">
                Sluit je deze melding zonder keuze, dan verdwijnt de post uit het grid zodra er een nieuwe geplande post bijkomt.
              </p>
            </div>
          </div>
          <button
            onClick={handleAutoRemove}
            className="w-full text-[11px] text-gray-400 py-2 hover:text-gray-600"
          >
            Nu verwijderen
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ActionRow({ icon, title, desc, onTap }: { icon: string; title: string; desc: string; onTap: () => void }) {
  return (
    <button onClick={onTap} className="w-full flex gap-3 items-start p-3 rounded-xl border border-gray-200 text-left hover:bg-gray-50 active:bg-gray-100">
      <span className="text-lg flex-shrink-0">{icon}</span>
      <div>
        <p className="text-[11px] font-bold text-gray-900">{title}</p>
        <p className="text-[10px] text-gray-500">{desc}</p>
      </div>
    </button>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/grid/
git commit -m "feat: ConflictBanner and ConflictActionSheet with resolve actions"
```

---

## Task 13: FillButton

**Files:**
- Create: `src/components/grid/FillButton.tsx`

- [ ] **Step 1: Create FillButton**

Create `src/components/grid/FillButton.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useGridStore } from '@/lib/store/gridStore'
import { toast } from 'sonner'
import type { Post } from '@/lib/types'

export function FillButton() {
  const { posts, setPosts } = useGridStore()
  const [loading, setLoading] = useState(false)

  const draftCount = posts.filter(p => p.state === 'draft' || p.state === 'conflict').length
  const needed = Math.max(0, 9 - draftCount)

  if (needed === 0) return null

  async function handleFill() {
    setLoading(true)
    try {
      const maxPosition = Math.max(0, ...posts.map(p => p.position))
      const emptyPosts = posts.filter(p => p.state === 'empty')
      const startPosition = emptyPosts.length > 0
        ? Math.min(...emptyPosts.map(p => p.position))
        : maxPosition + 1

      const res = await fetch('/api/posts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: needed, startPosition }),
      })
      const newPosts: Post[] = await res.json()

      // Replace empty slots with new posts, append rest
      const withoutEmpties = posts.filter(p => p.state !== 'empty')
      const toFill = emptyPosts.slice(0, newPosts.length)
      const filled = newPosts.map((np, i) => ({ ...np, position: toFill[i]?.position ?? np.position }))
      const remaining = newPosts.slice(toFill.length)

      setPosts([...withoutEmpties, ...filled, ...remaining])
      toast.success(`✨ ${newPosts.length} posts gegenereerd`)
    } catch {
      toast.error('Genereren mislukt, probeer opnieuw')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleFill}
      disabled={loading}
      size="sm"
      className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-full px-3 h-7"
    >
      {loading ? '...' : `✨ Vul aan tot 9`}
    </Button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/grid/FillButton.tsx
git commit -m "feat: FillButton — generates posts to reach 9 drafts"
```

---

## Task 14: Grid page

**Files:**
- Create: `src/app/grid/page.tsx`

- [ ] **Step 1: Create grid page**

Create `src/app/grid/page.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Settings } from 'lucide-react'
import { useGridStore } from '@/lib/store/gridStore'
import { PostGrid } from '@/components/grid/PostGrid'
import { ConflictBanner } from '@/components/grid/ConflictBanner'
import { ConflictActionSheet } from '@/components/grid/ConflictActionSheet'
import { FillButton } from '@/components/grid/FillButton'
import type { Post } from '@/lib/types'

export default function GridPage() {
  const { setPosts } = useGridStore()
  const [conflictSheetOpen, setConflictSheetOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/posts')
      .then(r => r.json())
      .then((posts: Post[]) => {
        setPosts(posts)
        setLoading(false)
      })
  }, [setPosts])

  return (
    <main className="min-h-screen bg-[#FFF8F0]">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-sm border-b border-orange-100">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-base font-extrabold text-orange-900">🪵 WoodyKids</span>
          <div className="flex items-center gap-2">
            <FillButton />
            <Link href="/settings" className="p-1 text-orange-400 hover:text-orange-600">
              <Settings size={18} />
            </Link>
          </div>
        </div>
        <ConflictBanner onTap={() => setConflictSheetOpen(true)} />
      </header>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-orange-300 text-sm">
          Laden...
        </div>
      ) : (
        <PostGrid />
      )}

      <ConflictActionSheet
        open={conflictSheetOpen}
        onClose={() => setConflictSheetOpen(false)}
      />
    </main>
  )
}
```

- [ ] **Step 2: Start dev server and verify grid renders**

```bash
npm run dev
```

Open http://localhost:3000 in browser. You should be redirected to `/login`. After login (or bypassing via `/grid` with a valid session), the grid should show posts in 3 columns with correct state colors.

- [ ] **Step 3: Commit**

```bash
git add src/app/grid/page.tsx
git commit -m "feat: grid page — loads posts, renders PostGrid with header"
```

---

## Task 15: PhotoCrop component

**Files:**
- Create: `src/components/editor/PhotoCrop.tsx`

- [ ] **Step 1: Create PhotoCrop**

Create `src/components/editor/PhotoCrop.tsx`:
```tsx
'use client'

import { useRef } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { useGesture } from '@use-gesture/react'
import type { CropData } from '@/lib/types'

type Props = {
  imageUrl: string
  cropData: CropData
  onChange: (crop: CropData) => void
}

export function PhotoCrop({ imageUrl, cropData, onChange }: Props) {
  const x = useMotionValue(cropData.x)
  const y = useMotionValue(cropData.y)
  const scale = useMotionValue(cropData.scale)
  const containerRef = useRef<HTMLDivElement>(null)

  const bind = useGesture(
    {
      onDrag: ({ offset: [ox, oy], memo }) => {
        x.set(ox)
        y.set(oy)
        return memo
      },
      onDragEnd: () => {
        onChange({ x: x.get(), y: y.get(), scale: scale.get() })
      },
      onPinch: ({ offset: [s] }) => {
        const clamped = Math.max(1, Math.min(4, s))
        scale.set(clamped)
      },
      onPinchEnd: () => {
        onChange({ x: x.get(), y: y.get(), scale: scale.get() })
      },
    },
    {
      drag: {
        from: () => [x.get(), y.get()],
      },
      pinch: {
        scaleBounds: { min: 1, max: 4 },
        from: () => [scale.get(), 0],
      },
      target: containerRef,
    },
  )

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden bg-black"
      style={{ aspectRatio: '4/5', touchAction: 'none' }}
      {...bind()}
    >
      <motion.img
        src={imageUrl}
        alt="Crop preview"
        className="w-full h-full object-cover"
        style={{ x, y, scale }}
        draggable={false}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/PhotoCrop.tsx
git commit -m "feat: PhotoCrop with pinch-to-zoom and drag-to-reposition"
```

---

## Task 16: PhotoSelector component

**Files:**
- Create: `src/components/editor/PhotoSelector.tsx`

- [ ] **Step 1: Create PhotoSelector**

Create `src/components/editor/PhotoSelector.tsx`:
```tsx
'use client'

import { ScrollArea } from '@/components/ui/scroll-area'

type Props = {
  images: string[]
  selectedIndex: number
  onChange: (index: number) => void
}

export function PhotoSelector({ images, selectedIndex, onChange }: Props) {
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex gap-2 px-3 py-2 w-max">
        {images.map((url, i) => (
          <button
            key={i}
            onClick={() => onChange(i)}
            className={[
              'flex-shrink-0 w-12 h-16 rounded overflow-hidden border-2 transition-all',
              i === selectedIndex ? 'border-orange-500 opacity-100' : 'border-transparent opacity-60',
            ].join(' ')}
          >
            <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/PhotoSelector.tsx
git commit -m "feat: PhotoSelector — horizontal scrollable image thumbnail strip"
```

---

## Task 17: CaptionBlock component

**Files:**
- Create: `src/components/editor/CaptionBlock.tsx`

- [ ] **Step 1: Create CaptionBlock**

Create `src/components/editor/CaptionBlock.tsx`:
```tsx
'use client'

import type { CaptionBlock as CaptionBlockType } from '@/lib/types'

type Props = {
  label: string
  block: CaptionBlockType
  onChange: (block: CaptionBlockType) => void
}

export function CaptionBlock({ label, block, onChange }: Props) {
  function selectVariant(i: 0 | 1 | 2) {
    onChange({ ...block, selected: i })
  }

  function editText(text: string) {
    const variants = [...block.variants] as [string, string, string]
    variants[block.selected] = text
    onChange({ ...block, variants })
  }

  return (
    <div className="space-y-2">
      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{label}</p>

      {/* Variant selector */}
      <div className="flex gap-1.5">
        {([0, 1, 2] as const).map(i => (
          <button
            key={i}
            onClick={() => selectVariant(i)}
            className={[
              'text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors',
              block.selected === i
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-gray-500 border-gray-200',
            ].join(' ')}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Editable text */}
      <textarea
        value={block.variants[block.selected]}
        onChange={e => editText(e.target.value)}
        rows={2}
        className="w-full text-[12px] text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-orange-300 leading-relaxed"
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/CaptionBlock.tsx
git commit -m "feat: CaptionBlock with 3 variant selector and inline editing"
```

---

## Task 18: HashtagBadges component

**Files:**
- Create: `src/components/editor/HashtagBadges.tsx`

- [ ] **Step 1: Create HashtagBadges**

Create `src/components/editor/HashtagBadges.tsx`:
```tsx
'use client'

import type { Hashtag } from '@/lib/types'

type Props = {
  hashtags: Hashtag[]
  onChange: (hashtags: Hashtag[]) => void
}

export function HashtagBadges({ hashtags, onChange }: Props) {
  function toggle(index: number) {
    onChange(hashtags.map((h, i) => i === index ? { ...h, active: !h.active } : h))
  }

  return (
    <div className="space-y-2">
      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Hashtags</p>
      <div className="flex flex-wrap gap-1.5">
        {hashtags.map((tag, i) => (
          <button
            key={tag.text}
            onClick={() => toggle(i)}
            className={[
              'text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors',
              tag.active
                ? 'bg-green-100 text-green-800 border-green-300'
                : 'bg-gray-100 text-gray-400 border-gray-200',
            ].join(' ')}
          >
            {tag.text}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/HashtagBadges.tsx
git commit -m "feat: HashtagBadges — 5 toggleable hashtag badges"
```

---

## Task 19: ScheduleSheet component

**Files:**
- Create: `src/components/editor/ScheduleSheet.tsx`

- [ ] **Step 1: Create ScheduleSheet**

Create `src/components/editor/ScheduleSheet.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: (isoDateTime: string) => void
  current?: string | null
}

export function ScheduleSheet({ open, onClose, onConfirm, current }: Props) {
  const [date, setDate] = useState<Date | undefined>(
    current ? new Date(current) : undefined,
  )
  const [time, setTime] = useState(
    current
      ? new Date(current).toTimeString().slice(0, 5)
      : '10:00',
  )

  function handleConfirm() {
    if (!date) return
    const [hours, minutes] = time.split(':').map(Number)
    const dt = new Date(date)
    dt.setHours(hours, minutes, 0, 0)
    onConfirm(dt.toISOString())
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-sm text-left">Wanneer publiceren?</SheetTitle>
        </SheetHeader>
        <div className="space-y-4">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            disabled={{ before: new Date() }}
            className="mx-auto"
          />
          <div className="space-y-1 px-1">
            <Label htmlFor="time" className="text-xs">Tijdstip</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="border-orange-200 focus-visible:ring-orange-300"
            />
          </div>
          <Button
            onClick={handleConfirm}
            disabled={!date}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          >
            Inplannen →
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/ScheduleSheet.tsx
git commit -m "feat: ScheduleSheet — date and time picker for scheduling posts"
```

---

## Task 20: Fullscreen editor page

**Files:**
- Create: `src/app/grid/[postId]/page.tsx`

- [ ] **Step 1: Create editor page**

Create `src/app/grid/[postId]/page.tsx`:
```tsx
'use client'

import { use, useState, useEffect } from 'react'
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

export default function EditorPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { posts, updatePost } = useGridStore()

  const post = posts.find(p => p.id === postId)
  const [scheduleOpen, setScheduleOpen] = useState(searchParams.get('schedule') === 'true')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!post) router.replace('/grid')
  }, [post, router])

  if (!post || !post.caption || !post.source) return null

  const imageUrl = post.source.kind === 'shopify'
    ? post.source.images[post.source.selectedImageIndex]
    : post.source.mediaUrl

  const isShopify = post.source.kind === 'shopify'
  const title = isShopify ? post.source.productTitle : 'Eigen post'

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
      body: JSON.stringify({ scheduledAt: isoDateTime }),
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
    <main className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-gray-100 sticky top-0 z-10 bg-white">
        <button onClick={() => router.push('/grid')} className="flex items-center gap-1 text-orange-500 text-sm font-semibold">
          <ChevronLeft size={18} />
          Terug
        </button>
        <span className="text-xs font-semibold text-gray-500 truncate max-w-[140px]">{title}</span>
        <button
          onClick={() => setScheduleOpen(true)}
          className="text-xs font-bold text-white bg-orange-500 px-3 py-1.5 rounded-full"
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/grid/
git commit -m "feat: fullscreen editor with crop, photo selector, captions, hashtags, scheduling"
```

---

## Task 21: Settings page

**Files:**
- Create: `src/app/settings/page.tsx`

- [ ] **Step 1: Create settings page**

Create `src/app/settings/page.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

export default function SettingsPage() {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState('')

  useEffect(() => {
    fetch('/api/settings/tone-of-voice')
      .then(r => r.json())
      .then(data => setContent(data.content))

    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? '')
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    await fetch('/api/settings/tone-of-voice', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    setSaving(false)
    toast.success('Tone of voice opgeslagen')
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <main className="min-h-screen bg-[#FFF8F0]">
      <header className="flex items-center gap-2 px-3 py-3 border-b border-orange-100 bg-white/80 backdrop-blur-sm sticky top-0">
        <button onClick={() => router.push('/grid')} className="text-orange-500">
          <ChevronLeft size={20} />
        </button>
        <span className="text-base font-extrabold text-orange-900">Instellingen</span>
      </header>

      <div className="px-4 py-6 space-y-8 max-w-xl mx-auto">
        {/* Tone of voice */}
        <section className="space-y-3">
          <Label className="text-sm font-bold text-orange-900">Tone of voice</Label>
          <p className="text-xs text-gray-500">
            AI gebruikt deze tekst bij elke post-generatie. Pas aan als de toon moet veranderen.
          </p>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={14}
            className="w-full text-[12px] text-gray-800 bg-white border border-orange-200 rounded-xl px-3 py-3 resize-none focus:outline-none focus:ring-1 focus:ring-orange-300 leading-relaxed"
          />
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm"
          >
            {saving ? 'Opslaan...' : 'Opslaan'}
          </Button>
        </section>

        <Separator />

        {/* Account */}
        <section className="space-y-3">
          <p className="text-sm font-bold text-orange-900">Account</p>
          <p className="text-xs text-gray-500">{email}</p>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50 text-sm"
          >
            Uitloggen
          </Button>
        </section>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/settings/
git commit -m "feat: settings page with tone of voice editor and logout"
```

---

## Task 22: Final wiring, smoke test, and push

- [ ] **Step 1: Run full test suite**

```bash
npm run test:run
```

Expected: all 5 tests pass (gridStore conflict detection + setOrder).

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3: Manual mobile smoke test**

Start dev server: `npm run dev`

Open on mobile (or DevTools responsive mode, iPhone 14 width: 390px) and verify:
- [ ] `/login` shows form, rejects non-@woodykids.com email immediately (client-side), sends magic link for valid email
- [ ] `/grid` shows posts grid in 3 columns, all 4 states render correctly
- [ ] Conflict post shows pulsing orange ring + `!` badge
- [ ] ConflictBanner appears at top
- [ ] Long press (>500ms) on a draft initiates drag, release repositions with animation
- [ ] "Vul aan tot 9" fills empty slots, counter updates correctly
- [ ] Tap a draft → navigates to `/grid/[id]`
- [ ] Editor: crop (drag + pinch), photo selector, caption variants selectable and editable
- [ ] Hashtag badges toggle green/gray
- [ ] "Inplannen →" opens ScheduleSheet, confirming a date locks the post
- [ ] `/settings` loads tone of voice, editing and saving works, logout redirects to login

- [ ] **Step 4: Push to GitHub**

```bash
git push origin main
```

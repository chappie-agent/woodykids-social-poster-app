# Shopify + Supabase Fundament — Design Spec

**Doel:** Vervang alle stub API routes door echte persistentie (Supabase) en een echte productcatalogus (Shopify Admin API). Na deze spec draait de app op echte data.

**Architectuur:** Next.js API routes als thin server layer. Supabase voor alle persistente app-data. Shopify Admin API voor producten, gecached via Next.js Data Cache. Geen Redis, geen sync-jobs.

**Tech stack:** Next.js 16 (App Router), Supabase (Postgres + Auth + RLS), Shopify Admin REST API 2025-01, `@supabase/ssr`, TypeScript.

---

## 1. Database schema

### Tabel: `posts`

```sql
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
```

### Tabel: `settings`

```sql
create table settings (
  id              integer primary key default 1,
  tone_of_voice   text not null default '',
  updated_at      timestamptz not null default now()
);

-- Seed één rij
insert into settings (id, tone_of_voice) values (1, '');
```

### Row Level Security

```sql
-- posts: alle authenticated users mogen alles
alter table posts enable row level security;

create policy "team_all" on posts
  for all
  to authenticated
  using (true)
  with check (true);

-- settings: idem
alter table settings enable row level security;

create policy "team_all" on settings
  for all
  to authenticated
  using (true)
  with check (true);
```

**Toelichting:** Posts zijn team-eigendom — één gedeelde grid voor de hele organisatie, aansluitend op het principe dat er één Instagram-account is als bron van waarheid. `created_by` is enkel voor audit.

### Initiële seed: lege grid

```sql
insert into posts (state, position)
select 'empty', generate_series(0, 11);
```

---

## 2. Shopify client

### Environment variabelen (toe te voegen aan `.env.local`)

```
SHOPIFY_STORE_DOMAIN=jouwwinkel.myshopify.com
SHOPIFY_ADMIN_TOKEN=shpat_...
```

### Bestand: `src/lib/shopify/client.ts`

Verantwoordelijk voor: producten ophalen, collecties ophalen, producten per collectie.

**Caching:** Next.js ingebouwde fetch Data Cache via `next: { revalidate: 300 }` (5 minuten). Werkt correct in zowel development als serverless productie (Vercel). Geen Redis nodig.

**API versie:** `2025-01`

**Functies:**

```ts
getProducts(): Promise<ShopifyProduct[]>
getCollections(): Promise<ShopifyCollection[]>
```

**Types:**

```ts
type ShopifyProduct = {
  id: string
  title: string
  images: string[]          // alle afbeelding-URLs
  variants: ShopifyVariant[]
  collectionIds: string[]
}

type ShopifyVariant = {
  id: string
  title: string             // bijv. "Naturel / L"
  price: string             // bijv. "24.95"
}

type ShopifyCollection = {
  id: string
  title: string
}
```

**Shopify endpoints gebruikt:**
- `GET /admin/api/2025-01/products.json?limit=250&fields=id,title,images,variants`
- `GET /admin/api/2025-01/custom_collections.json?limit=250`
- `GET /admin/api/2025-01/collects.json?limit=250` (product↔collectie mapping)

**Authenticatie:** `X-Shopify-Access-Token: {SHOPIFY_ADMIN_TOKEN}` header op elke request.

---

## 3. Nieuwe API routes

### `GET /api/products`

Geeft gecachte ShopifyProduct[] terug. Roept `getProducts()` aan vanuit de Shopify client.

### `GET /api/collections`

Geeft gecachte ShopifyCollection[] terug. Roept `getCollections()` aan.

---

## 4. Stubs vervangen door echte implementaties

| Route | Stub gedrag | Echte implementatie |
|---|---|---|
| `GET /api/posts` | Fixture data | `select * from posts order by position` |
| `PUT /api/posts/[id]` | Echo patch | `update posts set ... where id = $1` |
| `DELETE /api/posts/[id]` | Echo id | `delete from posts where id = $1` |
| `PUT /api/grid/order` | console.log | Bulk `update posts set position = $1 where id = $2` |
| `GET /api/settings/tone-of-voice` | In-memory | `select tone_of_voice from settings where id = 1` |
| `PUT /api/settings/tone-of-voice` | In-memory | `update settings set tone_of_voice = $1 where id = 1` |
| `POST /api/posts/create-product` | Echo | Shopify snapshot ophalen → `insert into posts` |

### `POST /api/posts/create-product` — detail

Request body: `{ productId: string, position: number }`

Flow:
1. Haal product op via Shopify client (gecached)
2. Bouw source snapshot: `{ kind: 'shopify', productId, productTitle, images, variants, selectedImageIndex: 0 }`
3. Update het bestaande `state: 'empty'` record op `position` naar `state: 'draft'` met de source snapshot en `created_by: user.id`
4. Return de geüpdatete post

**Toelichting:** Er is altijd al een rij in de tabel voor elke positie (de initiële seed). We inserten nooit nieuwe rijen — we updaten bestaande lege slots.

**`POST /api/posts/generate` (autofill) blijft stub** — wordt geïmplementeerd in Spec 2 (AI-integratie).

---

## 5. Product picker UI

### Bestand: `src/components/editor/ProductPicker.tsx`

Bottom sheet, zelfde patroon als de bestaande `ScheduleSheet`.

**Props:**
```ts
type Props = {
  open: boolean
  position: number          // welk grid-slot wordt gevuld
  onClose: () => void
  onCreated: (post: Post) => void
}
```

**UI-structuur:**
- Zoekbalk (controlled input, filtert client-side op `product.title`)
- Collectie-dropdown (`<select>` of `<ComboBox>`), default "Alle collecties"
- Thumbnail grid: productafbeelding (eerste image), naam, collectie-label
- Loading state tijdens fetch
- Leeg-state als geen producten matchen

**Interactie:**
- Tik op product → `POST /api/posts/create-product` → `onCreated(post)` callback → sheet sluit

### Integratie in grid

`PostCell` voor een lege post (`state: 'empty'`) krijgt een `onTap` handler die `ProductPicker` opent met het juiste position-nummer.

---

## 6. Supabase server client

### Bestand: `src/lib/supabase/server.ts`

Supabase client voor gebruik in Next.js API routes (server-side), gebouwd met `@supabase/ssr`.

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
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options))
        },
      },
    }
  )
}
```

---

## 7. Wat er NIET in deze spec zit

- AI caption generatie → Spec 2
- Zernio publishing → Spec 3
- Upload-flow (eigen media) → onderdeel van Spec 2
- `POST /api/posts/generate` (autofill) → Spec 2

---

## Bestandsoverzicht

**Nieuw:**
- `src/lib/shopify/client.ts`
- `src/lib/supabase/server.ts`
- `src/app/api/products/route.ts`
- `src/app/api/collections/route.ts`
- `src/components/editor/ProductPicker.tsx`
- `supabase/migrations/001_initial_schema.sql`

**Gewijzigd:**
- `src/app/api/posts/route.ts`
- `src/app/api/posts/[id]/route.ts`
- `src/app/api/grid/order/route.ts`
- `src/app/api/settings/tone-of-voice/route.ts`
- `src/app/api/posts/create-product/route.ts`
- `src/components/grid/PostCell.tsx` (lege cel → opent ProductPicker)
- `src/app/grid/page.tsx` (ProductPicker state beheer)
- `.env.local` (nieuwe variabelen)

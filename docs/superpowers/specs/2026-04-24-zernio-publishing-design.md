# Zernio Publishing — Design Spec

**Doel:** Vervang de stub `POST /api/posts/[id]/publish` door een echte Zernio API-integratie. Een post wordt pas `locked` als Zernio de scheduling bevestigt. Bij een fout blijft de post `draft` en ziet de gebruiker een foutmelding.

**Architectuur:** Atomaire publish route op de server — Zernio-call en Supabase-update gebeuren samen. De client past de store pas aan na een succesvolle response. Zernio wordt aangesproken via `POST https://zernio.com/api/v1/posts` met Bearer-auth.

**Tech stack:** Next.js 16 App Router, `fetch` (native), Supabase, TypeScript.

---

## 1. Flow

1. Gebruiker kiest datum/tijd in `ScheduleSheet` → `handleSchedule(isoDateTime)` in de editor
2. Editor roept `POST /api/posts/[id]/publish` aan met `{ scheduledAt }`
3. Route haalt de post op uit Supabase (caption + source)
4. Validatie: caption niet null, afbeelding beschikbaar — anders 400
5. Caption samengesteld uit `opener`, `middle`, `closer`, actieve hashtags
6. Route roept Zernio aan: Instagram + Facebook tegelijk
7. **Zernio OK:** route update post in Supabase (`state: locked`, `scheduled_at`), retourneert bijgewerkte post
8. **Zernio fout:** route retourneert 500, post blijft `draft` in Supabase
9. Editor bij succes: `updatePost` in store + toast + navigeer naar grid
10. Editor bij fout: inline foutmelding, gebruiker blijft op de editorpagina

---

## 2. Zernio API

**Endpoint:** `POST https://zernio.com/api/v1/posts`

**Headers:**
```
Authorization: Bearer ${ZERNIO_API_KEY}
Content-Type: application/json
```

**Request body:**
```json
{
  "accountIds": ["<ZERNIO_INSTAGRAM_ACCOUNT_ID>", "<ZERNIO_FACEBOOK_ACCOUNT_ID>"],
  "content": "<assembled caption>",
  "scheduledFor": "2026-04-24T10:00:00",
  "media": [{ "url": "<selected image URL>" }]
}
```

**Caption-formaat:**
```
{opener.variants[opener.selected]}

{middle.variants[middle.selected]}

{closer.variants[closer.selected]}

#hashtag1 #hashtag2 #hashtag3
```

Alleen actieve hashtags worden meegenomen (`hashtag.active === true`), samengevoegd met spaties op één regel.

**`scheduledFor`:** de `scheduledAt` ISO-string uit de request body, doorgegeven zonder tijdzone-conversie (Zernio accepteert ISO 8601).

---

## 3. API route: `POST /api/posts/[id]/publish`

**Bestand:** `src/app/api/posts/[id]/publish/route.ts`

### Flow
1. Haal post op uit Supabase via `id`
2. Als `post.caption === null` → return 400 `{ error: 'Geen caption beschikbaar' }`
3. Bepaal image URL: `post.source.kind === 'shopify'` → `post.source.images[post.source.selectedImageIndex]`; als geen afbeelding beschikbaar → geen `media`-veld in Zernio-request (Zernio-call gaat door zonder media)
4. Stel caption samen via `assembleCaption(post.caption)`
5. Roep `scheduleZernioPost({ content, scheduledFor, imageUrl })` aan
6. Bij Zernio-fout → log + return 500
7. Update Supabase: `state: 'locked'`, `scheduled_at: scheduledAt`
8. Return bijgewerkte post via `mapPost`

### Input
```typescript
{ scheduledAt: string } // ISO 8601
```

### Output
Bijgewerkte `Post` met `state: 'locked'` en `scheduledAt` gevuld.

### Foutafhandeling
- Post niet gevonden: 500
- Caption null: 400 `{ error: 'Geen caption beschikbaar' }`
- Zernio-fout: 500 `{ error: 'Inplannen bij Zernio mislukt' }`
- Supabase update-fout: 500

---

## 4. Zernio client

**Bestand:** `src/lib/zernio/client.ts`

```typescript
type ZernioPostInput = {
  content: string
  scheduledFor: string
  imageUrl?: string
}

export async function scheduleZernioPost(input: ZernioPostInput): Promise<void> {
  // Bouwt request body met accountIds uit env vars
  // Gooit Error als response niet ok is
}
```

Env vars:
- `ZERNIO_API_KEY`
- `ZERNIO_INSTAGRAM_ACCOUNT_ID`
- `ZERNIO_FACEBOOK_ACCOUNT_ID`

Alle drie verplicht — functie gooit als een van hen ontbreekt.

---

## 5. Caption assembly

**Bestand:** `src/lib/zernio/format.ts`

```typescript
export function assembleCaption(caption: PostCaption): string
```

Pure functie. Retourneert:
```
{opener}

{middle}

{closer}

{actieve hashtags}
```

Als er geen actieve hashtags zijn, wordt de laatste lege regel weggelaten.

---

## 6. UI-wijzigingen

**Bestand:** `src/app/grid/[postId]/page.tsx`

`handleSchedule` wordt aangepast: de optimistische store-update en aparte PUT worden verwijderd. De publish route is nu atomair.

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

De bestaande `generateError` state wordt hergebruikt voor de foutmelding.

---

## 7. Tests

- `src/lib/zernio/__tests__/format.test.ts` — unit tests voor `assembleCaption` (pure functie, geen mocks)
- `src/lib/zernio/__tests__/client.test.ts` — unit test met `vi.stubGlobal('fetch', vi.fn())` voor happy path + foutpad
- `src/app/api/posts/[id]/publish/__tests__/route.test.ts` — integratietest met gemockte Supabase + gemockte `scheduleZernioPost`

---

## 8. Bestandsoverzicht

**Nieuw:**
- `src/lib/zernio/client.ts`
- `src/lib/zernio/format.ts`
- `src/lib/zernio/__tests__/format.test.ts`
- `src/lib/zernio/__tests__/client.test.ts`
- `src/app/api/posts/[id]/publish/__tests__/route.test.ts`

**Gewijzigd:**
- `src/app/api/posts/[id]/publish/route.ts` — stub vervangen
- `src/app/grid/[postId]/page.tsx` — `handleSchedule` aangepast

**Niet in deze spec:**
- Upload-flow publishing (Spec 4)
- Analytics of Zernio webhook callbacks

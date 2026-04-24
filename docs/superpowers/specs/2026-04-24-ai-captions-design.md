# AI Caption Generatie — Design Spec

**Doel:** Genereer automatisch Instagram-captions voor Shopify-posts via Claude. Direct na productselectie, op de achtergrond, zodat de caption klaar staat zodra de gebruiker de editor opent.

**Architectuur:** Next.js API route roept Claude claude-sonnet-4-6 aan met vision (productafbeelding) + producttekst + tone of voice. Claude geeft gestructureerde JSON terug. Caption wordt opgeslagen in Supabase op de post-rij. Trigger zit client-side in ProductPicker, direct na aanmaken van de post.

**Tech stack:** Next.js 16 App Router, `@anthropic-ai/sdk`, Claude claude-sonnet-4-6, Supabase, TypeScript.

---

## 1. Trigger-flow

1. Gebruiker selecteert een product in de ProductPicker
2. `POST /api/posts/create-product` slaagt → post bestaat in Supabase met `caption: null`
3. Client roept direct daarna `POST /api/posts/[id]/generate-caption` aan **op de achtergrond** (fire-and-forget, geen await in de UI)
4. `onCreated(post)` callback update de grid — gebruiker ziet de draft post
5. Claude genereert ondertussen de caption (1–3 seconden)
6. Gebruiker opent editor → caption is er al, of ziet even een laadindicator in de captionblokken

**Eenmalig:** als `post.caption !== null` slaat de route de generatie over. Heropenen van de editor triggert nooit een nieuwe generatie.

**Regenereren:** expliciete "Regenereer" knop in de editor — altijd zichtbaar, ook als er al een caption is.

---

## 2. API route: `POST /api/posts/[id]/generate-caption`

**Bestand:** `src/app/api/posts/[id]/generate-caption/route.ts`

### Input
Geen request body. De post-ID komt uit de URL-parameter.

### Flow
1. Haal post op uit Supabase (`source`, `caption`)
2. Als `source.kind !== 'shopify'` → return 400 (upload-flow is Spec 4)
3. Haal `tone_of_voice` op uit `settings where id = 1`
4. Bouw Claude-bericht op (zie sectie 3)
5. Roep Claude aan via Anthropic client
6. Parseer JSON uit de response
7. Sla caption op: `update posts set caption = $1 where id = $2`
8. Return de bijgewerkte post

### Output
De bijgewerkte `Post` met gevulde `caption`.

### Foutafhandeling
- Supabase-fout bij ophalen: 500
- Anthropic API-fout: 500 met `{ error: '...' }`
- Ongeldige JSON van Claude: 500 met `{ error: 'Ongeldige AI-response' }`
- Geen afbeelding beschikbaar: genereer zonder vision (alleen tekst)

---

## 3. Claude-prompt

### Systeemprompt
```
Je bent een social media copywriter voor WoodyKids, een Nederlandse kinderspeelgoedwinkel.
Schrijf altijd in het Nederlands.
Volg deze richtlijnen strikt op:

{tone_of_voice}

Geef je output ALTIJD als geldig JSON in exact dit formaat, zonder extra tekst:
{
  "opener": { "variants": ["...", "...", "..."] },
  "middle": { "variants": ["...", "...", "..."] },
  "closer": { "variants": ["...", "...", "..."] },
  "hashtags": ["...", "...", "...", "...", "..."]
}
```

### Gebruikersbericht (multimodaal)
1. Productafbeelding via vision: `{ type: 'image', source: { type: 'url', url: selectedImageUrl } }` — weggelaten als er geen afbeelding is
2. Tekstblok:
```
Product: {productTitle}
Varianten: {variants.map(v => `${v.title} — €${v.price}`).join(', ')}

Schrijf een Instagram-caption in drie losse secties (opener, middenstuk, afsluiter).
Elke sectie heeft drie varianten die in toon licht van elkaar verschillen.
Genereer ook vijf Nederlandse hashtags.
```

### Model
`claude-sonnet-4-6` — snel genoeg, geen streaming nodig.

---

## 4. Caption-formaat

```typescript
// Geretourneerd door Claude, omgezet naar PostCaption:
{
  opener: { variants: [string, string, string], selected: 0 },
  middle:  { variants: [string, string, string], selected: 0 },
  closer:  { variants: [string, string, string], selected: 0 },
  hashtags: [
    { text: '#...', active: true },   // 1
    { text: '#...', active: true },   // 2
    { text: '#...', active: true },   // 3
    { text: '#...', active: false },  // 4
    { text: '#...', active: false },  // 5
  ]
}
```

Eerste 3 hashtags standaard actief, laatste 2 inactief. Gebruiker kan toggled.

---

## 5. Anthropic client

**Bestand:** `src/lib/anthropic/client.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk'

export function createAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
  return new Anthropic({ apiKey })
}
```

---

## 6. UI-wijzigingen

### ProductPicker (`src/components/editor/ProductPicker.tsx`)
Na `onCreated(post)` roept de client in de achtergrond aan:
```typescript
fetch(`/api/posts/${post.id}/generate-caption`, { method: 'POST' })
  .catch(() => {}) // fire-and-forget, fout wordt in editor getoond
```

### Editor (`src/app/grid/[postId]/page.tsx`)
- Als `post.caption === null` bij openen: toon laadindicator in captionblokken én start polling — haal de post elke 2 seconden opnieuw op via `/api/posts/[id]` totdat `caption !== null`
- Na 15 seconden zonder caption: stop met pollen, toon foutmelding "Caption generatie mislukt. Probeer opnieuw." met "Regenereer" knop
- "Regenereer caption" knop — altijd zichtbaar (ook als caption al bestaat)
- Bij klik op regenereren: roep `/api/posts/[id]/generate-caption` aan, wacht op response (spinner op de knop), update caption in store + Supabase
- Foutmelding bij mislukte regeneratie: "Caption generatie mislukt. Probeer opnieuw."

---

## 7. Environment variabelen

```
ANTHROPIC_API_KEY=sk-ant-...
```

Toe te voegen aan `.env.local` (nooit committen).

---

## 8. Bestandsoverzicht

**Nieuw:**
- `src/lib/anthropic/client.ts`
- `src/app/api/posts/[id]/generate-caption/route.ts`

**Gewijzigd:**
- `src/components/editor/ProductPicker.tsx` — fire-and-forget na `onCreated`
- `src/app/grid/[postId]/page.tsx` — laadindicator + regenereer knop
- `package.json` — `@anthropic-ai/sdk` toevoegen

**Niet in deze spec:**
- Caption generatie voor uploads (Spec 4)
- Bulk autofill (`/api/posts/generate`) — later

# Upload Flow — Design Spec

**Doel:** Gebruikers kunnen eigen foto's en video's uploaden als Instagram-post, inclusief automatische caption-generatie via Claude. Uploaden gebeurt rechtstreeks vanuit de browser naar Supabase Storage.

**Architectuur:** Een `SourcePicker` vervangt de directe koppeling van lege cel → ProductPicker. Vanuit de SourcePicker kiest de gebruiker tussen een Shopify-product of eigen media. Bij eigen media: bestand uploaden naar Supabase Storage in de browser, daarna post aanmaken in Supabase, fire-and-forget caption-generatie. Voor afbeeldingen gebruikt Claude vision + userPrompt; voor video's alleen userPrompt (Claude ondersteunt geen video-analyse).

**Tech stack:** Next.js 16 App Router, Supabase Storage, `@supabase/supabase-js` (browser client), Claude claude-sonnet-4-6, TypeScript.

---

## 1. UI-flow

### Gewijzigde triggerflow

Lege cel tap → **SourcePicker** (nieuw) — twee keuzes:
1. **Shopify product** → bestaande `ProductPicker`
2. **Eigen media** → nieuwe `UploadPicker`

`PostGrid` beheert de open/dicht staat van alle drie sheets.

### SourcePicker (`src/components/editor/SourcePicker.tsx`)

Bottom sheet met twee grote keuze-knoppen. Sluit zichzelf zodra de gebruiker kiest.

Props:
```typescript
type Props = {
  open: boolean
  onClose: () => void
  onChooseProduct: () => void
  onChooseUpload: () => void
}
```

### UploadPicker (`src/components/editor/UploadPicker.tsx`)

Bottom sheet in drie stappen, allemaal in één scherm:
1. **Bestandskiezer** — `<input type="file" accept="image/*,video/*">` → na selectie preview (thumbnail voor afbeelding, bestandsnaam + duur-indicator voor video)
2. **UserPrompt** — tekstveld: `placeholder="Beschrijf je post, bijv. 'Pasen sale, 20% korting'"` 
3. **Toevoegen-knop** — uploadt naar Supabase Storage, maakt post aan, vuurt caption-generatie af, sluit sheet

Props:
```typescript
type Props = {
  open: boolean
  position: number
  onClose: () => void
  onCreated: (post: Post) => void
}
```

---

## 2. Supabase Storage

**Bucket:** `post-media` — publiek, aan te maken in Supabase dashboard (handmatige stap).

**Upload vanuit de browser:**
```typescript
const ext = file.name.split('.').pop()
const path = `${crypto.randomUUID()}.${ext}`
const { error } = await supabase.storage.from('post-media').upload(path, file)
const { data } = supabase.storage.from('post-media').getPublicUrl(path)
const mediaUrl = data.publicUrl
```

De Supabase browser-client (`@/lib/supabase/client`) wordt gebruikt — niet de server-client.

**Foutafhandeling:** Als de upload mislukt toont `UploadPicker` een inline foutmelding. Geen post wordt aangemaakt.

---

## 3. API route: `POST /api/posts/create-upload`

**Bestand:** `src/app/api/posts/create-upload/route.ts` (stub vervangen)

### Huidige stub
Genereert alleen een in-memory `Post` object, slaat niets op in Supabase.

### Nieuwe implementatie
Zelfde patroon als `create-product`:
1. Lees `{ mediaUrl, mediaType, userPrompt, position }` uit de request body
2. Haal eventuele bestaande post op voor die positie
3. Upsert in Supabase: `state: 'draft'`, `source: { kind: 'upload', mediaUrl, mediaType, userPrompt }`
4. Return de opgeslagen post via `mapPost`

### Input
```typescript
{
  mediaUrl: string       // Supabase Storage public URL
  mediaType: 'image' | 'video'
  userPrompt: string     // vrije tekst van de gebruiker
  position: number
}
```

### Output
De opgeslagen `Post` met gevulde `source`.

---

## 4. Caption-generatie voor uploads

### `caption.ts` — nieuwe functie

**Bestand:** `src/lib/anthropic/caption.ts`

Nieuwe pure functie naast de bestaande `buildUserContent`:

```typescript
export function buildUploadUserContent(source: PostSourceUpload): ContentBlock[]
```

- **Afbeelding** (`mediaType === 'image'`): vision-blok met `mediaUrl` + tekstblok
- **Video** (`mediaType === 'video'`): alleen tekstblok (geen vision)

Tekstblok:
```
Eigen post: {userPrompt}

Schrijf een Instagram-caption in drie losse secties (opener, middenstuk, afsluiter).
Elke sectie heeft drie varianten die in toon licht van elkaar verschillen.
Genereer ook vijf Nederlandse hashtags.
```

Dezelfde systeemprompt (`buildSystemPrompt`) en parser (`parseCaptionResponse`) worden hergebruikt — alleen de user content verandert.

### generate-caption route

**Bestand:** `src/app/api/posts/[id]/generate-caption/route.ts`

Vervang het huidige guard:
```typescript
// Oud:
if (source?.kind !== 'shopify') {
  return NextResponse.json({ error: 'Only Shopify posts supported' }, { status: 400 })
}
```

Door een branch op `source.kind`:
- `'shopify'` → `buildUserContent(source)` (bestaand)
- `'upload'` → `buildUploadUserContent(source)` (nieuw)
- anders → 400

De rest van de route (Claude aanroepen, parseren, opslaan) blijft ongewijzigd.

---

## 5. PostGrid aanpassen

**Bestand:** `src/components/grid/PostGrid.tsx`

Huidige koppeling: lege cel tap → `ProductPicker` direct.

Nieuwe koppeling:
- Lege cel tap → `SourcePicker` open
- `SourcePicker` "Shopify product" → `ProductPicker` open
- `SourcePicker` "Eigen media" → `UploadPicker` open
- Beide pickers roepen `onCreated` aan → zelfde `updatePost` flow als nu

---

## 6. Handmatige stap (Supabase dashboard)

Vóór eerste gebruik: maak bucket `post-media` aan in Supabase Storage met publieke leestoegang.

---

## 7. Bestandsoverzicht

**Nieuw:**
- `src/components/editor/SourcePicker.tsx`
- `src/components/editor/UploadPicker.tsx`

**Gewijzigd:**
- `src/components/grid/PostGrid.tsx` — SourcePicker i.p.v. directe ProductPicker-koppeling
- `src/app/api/posts/create-upload/route.ts` — stub vervangen door Supabase-insert
- `src/lib/anthropic/caption.ts` — `buildUploadUserContent` toevoegen
- `src/app/api/posts/[id]/generate-caption/route.ts` — guard vervangen door branch

**Gewijzigd (aanvulling):**
- `src/app/api/posts/[id]/publish/route.ts` — imageUrl extractie uitbreiden met upload-branch:
  ```typescript
  if (source?.kind === 'shopify') {
    imageUrl = source.images[source.selectedImageIndex] ?? source.images[0]
  } else if (source?.kind === 'upload') {
    imageUrl = source.mediaUrl
  }
  ```
  Zonder deze aanpassing publiceert Zernio upload-posts zonder media, wat Instagram afwijst.

**Niet in deze spec:**
- Supabase Storage bucket aanmaken (handmatige stap)
- Video-thumbnail extractie (buiten scope)

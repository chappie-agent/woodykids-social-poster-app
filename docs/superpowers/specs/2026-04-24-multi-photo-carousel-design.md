# Multi-Photo Carousel — Design Spec

**Doel:** Laat gebruikers meerdere foto's per post selecteren (Instagram carousel), zowel voor Shopify-producten als eigen uploads. Maximaal 10 foto's per post (Instagram-limiet). De eerste foto is altijd de cover en de enige die naar Claude vision gaat.

**Architectuur:** Brekende wijziging in het data-model (`selectedImageIndex → selectedImageIndices`, `mediaUrl → mediaUrls`), een SQL-migratie die bestaande rijen converteert, een nieuwe `MultiPhotoSelector` UI-component, uitbreiding van `UploadPicker` met multi-file support, en aanpassingen aan vier routes. Alle routes en de Zernio-client worden bijgewerkt om met arrays te werken.

**Tech Stack:** Next.js 16 App Router, Supabase Storage, TypeScript, Vitest.

---

## 1. Data model (`src/lib/types.ts`)

### `PostSourceShopify`
```typescript
// Oud:
selectedImageIndex: number

// Nieuw:
selectedImageIndices: number[]   // geordende array, max 10 elementen
```

### `PostSourceUpload`
```typescript
// Oud:
mediaUrl: string

// Nieuw:
mediaUrls: string[]              // geordende array, max 10 elementen
// mediaType blijft: type van de eerste/cover media (voor Claude vision)
```

---

## 2. SQL-migratie (`supabase/migrations/003_multi_photo_carousel.sql`)

Converteert bestaande Shopify- en upload-posts naar de nieuwe array-structuur:

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

---

## 3. `MultiPhotoSelector` component (`src/components/editor/MultiPhotoSelector.tsx`)

Vervangt `PhotoSelector` voor Shopify-posts in de editor.

```typescript
type Props = {
  images: string[]
  selectedIndices: number[]           // geordende array
  onChange: (indices: number[]) => void
}
```

**Gedrag:**
- Tap ongeselecteerd → voeg toe aan einde van array
- Tap geselecteerd → verwijder, overige schuiven op (herindexeer)
- Maximum = 10: ongeselecteerde foto's krijgen `opacity-30 pointer-events-none` als de limiet bereikt is
- Geselecteerde foto → bordeaux border + badge met positienummer (1-gebaseerd)

**UI per thumbnail:**
```tsx
<div className="relative flex-shrink-0 w-12 h-16">
  <img ... className={`... ${isSelected ? 'border-woody-bordeaux' : 'border-transparent opacity-60'}`} />
  {isSelected && (
    <span className="absolute top-0.5 right-0.5 bg-woody-bordeaux text-woody-cream text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
      {position}
    </span>
  )}
</div>
```

---

## 4. `UploadPicker` — multi-file support (`src/components/editor/UploadPicker.tsx`)

- `<input type="file" multiple accept="image/*,video/*">` — gebruiker kiest meerdere bestanden
- Maximaal 10 bestanden (overtollige worden genegeerd met een melding)
- Preview: horizontale rij thumbnails (afbeelding) of bestandsnaam-badges (video), in selectievolgorde
- `mediaType` = type van het eerste bestand (voor caption generation)
- Upload: alle bestanden parallel naar Supabase Storage
- Foutafhandeling: als één upload mislukt → cleanup alle uploads van die batch, toon foutmelding

---

## 5. `create-product` route (`src/app/api/posts/create-product/route.ts`)

```typescript
// Oud:
selected_image_index: 0

// Nieuw:
source: { ..., selectedImageIndices: [1] }   // standaard tweede foto als cover
```

---

## 6. `create-upload` route (`src/app/api/posts/create-upload/route.ts`)

```typescript
// Input body:
{ mediaUrls: string[], mediaType: 'image' | 'video', userPrompt: string, position: number }

// Source opgebouwd:
const source: PostSourceUpload = { kind: 'upload', mediaUrls, mediaType, userPrompt }
```

---

## 7. `generate-caption` route (`src/app/api/posts/[id]/generate-caption/route.ts`)

Vision alleen op de eerste/cover foto:
```typescript
// Shopify:
const coverImage = source.images[source.selectedImageIndices[0]] ?? source.images[0]

// Upload:
const coverImage = source.mediaUrls[0]
```

De `buildUserContent` en `buildUploadUserContent` functies ontvangen het cover-URL en werken ongewijzigd.

---

## 8. `publish` route (`src/app/api/posts/[id]/publish/route.ts`)

Stuur alle geselecteerde foto's als media-array naar Zernio:
```typescript
// Shopify:
const mediaUrls = source.selectedImageIndices.map(i => source.images[i]).filter(Boolean)

// Upload:
const mediaUrls = source.mediaUrls
```

---

## 9. Zernio client (`src/lib/zernio/client.ts`)

```typescript
// Oud:
type ZernioPostInput = { content: string; scheduledFor: string; imageUrl?: string }
// body.media = [{ url: imageUrl }]

// Nieuw:
type ZernioPostInput = { content: string; scheduledFor: string; mediaUrls?: string[] }
// body.media = mediaUrls.map(url => ({ url }))
```

---

## 10. Editor page (`src/app/grid/[postId]/page.tsx`)

```typescript
// Cover-foto:
const imageUrl = post.source.kind === 'shopify'
  ? post.source.images[post.source.selectedImageIndices[0]] ?? post.source.images[0]
  : post.source.mediaUrls[0]
```

`PhotoSelector` vervangen door `MultiPhotoSelector` voor Shopify-posts. Upload-posts tonen geen selector (volgorde is vastgelegd bij upload).

---

## 11. Bestandsoverzicht

| File | Actie |
|---|---|
| `src/lib/types.ts` | Modify — `selectedImageIndices`, `mediaUrls` |
| `supabase/migrations/003_multi_photo_carousel.sql` | Create — data-migratie |
| `src/components/editor/MultiPhotoSelector.tsx` | Create — nieuwe component |
| `src/components/editor/PhotoSelector.tsx` | Delete — vervangen door MultiPhotoSelector |
| `src/components/editor/UploadPicker.tsx` | Modify — multi-file support |
| `src/app/grid/[postId]/page.tsx` | Modify — cover URL + MultiPhotoSelector |
| `src/app/api/posts/create-product/route.ts` | Modify — `selectedImageIndices: [1]` |
| `src/app/api/posts/create-upload/route.ts` | Modify — `mediaUrls` array |
| `src/app/api/posts/[id]/generate-caption/route.ts` | Modify — cover-URL uit array |
| `src/app/api/posts/[id]/publish/route.ts` | Modify — alle URLs naar Zernio |
| `src/lib/zernio/client.ts` | Modify — `mediaUrls` array |
| `src/lib/zernio/format.ts` | Geen wijziging |

---

## Niet in deze spec

- Foto-volgorde aanpassen ná upload (drag-to-reorder)
- Upload-posts tonen geen foto-selector in de editor (volgorde vast bij upload)
- Video-thumbnail extractie
- Mixed image+video carousel type-detectie per item (alleen cover bepaalt `mediaType`)

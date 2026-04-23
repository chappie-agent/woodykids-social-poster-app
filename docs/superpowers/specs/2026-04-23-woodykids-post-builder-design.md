# WoodyKids Post Builder — Design Spec

**Datum:** 2026-04-23
**Fase:** MVP — fake data, echte UI/UX
**Doel:** Volledige UI bouwen met correcte datastructuur zodat API-integraties later één-op-één kunnen worden ingewisseld zonder UI-aanpassingen.

---

## 1. Wat we bouwen

Een mobile-first Instagram feed planner voor WoodyKids. De app leest productdata (Shopify), genereert posts met AI (tekst + foto), toont ze in een scrollbaar 3-koloms grid en publiceert via Zernio op het gekozen moment.

MVP-scope: alle UI en interacties draaien op fake data via API route stubs. Supabase auth werkt wel echt vanaf dag 1.

---

## 2. Data model

### Post states

```
empty     → lege slot, wacht op vulling via "Vul aan tot 9"
draft     → concept, volledig bewerkbaar, sleepbaar in het grid
conflict  → draft die ingeklemd zit tussen een published post en het huidige moment
            (de post had al gepubliceerd moeten zijn), toont pulserende oranje ring
locked    → ingepland bij Zernio, niet sleepbaar, toont datum + slotje
```

### Post object

```ts
type PostSource =
  | { kind: 'shopify'; productId: string; productTitle: string; images: string[]; selectedImageIndex: number }
  | { kind: 'upload';  mediaUrl: string; mediaType: 'image' | 'video'; userPrompt: string }

type CropData = { x: number; y: number; scale: number }

type CaptionBlock = { variants: [string, string, string]; selected: 0 | 1 | 2 }

type Hashtag = { text: string; active: boolean }

type Post = {
  id: string
  state: 'empty' | 'draft' | 'conflict' | 'locked'
  position: number           // volgorde in het grid, 0 = linksboven
  source: PostSource | null  // null voor empty slots
  cropData: CropData
  caption: {
    opener:  CaptionBlock
    middle:  CaptionBlock
    closer:  CaptionBlock
    hashtags: Hashtag[]      // altijd 5 items, standaard eerste 3 actief
  } | null                   // null voor empty slots
  scheduledAt: string | null // ISO 8601, null = nog niet ingepland
  isPerson: boolean          // heeft de foto een persoon? stuurt compositie-logica
}
```

### Grid-volgorde

- **Linksboven** = positie 0 = heden / nieuwste content
- **Rechtsonder** = hoogste positie = oudst / al gepubliceerd
- Lege slots verschijnen altijd linksboven (laagste positie)
- Locked posts zakken richting rechtsonder naarmate ze gepubliceerd zijn

---

## 3. Architectuur

### Tech stack

| Laag | Keuze |
|---|---|
| Framework | Next.js 15, App Router, TypeScript |
| Styling | Tailwind v4, shadcn/ui |
| Client state | Zustand (`useGridStore`) |
| Drag-and-drop | `@dnd-kit` (logica) + Framer Motion (animaties) |
| Auth | Supabase Auth — alleen `@woodykids.com` toegestaan |
| Storage | Supabase Storage (eigen uploads) |
| Database (later) | Supabase DB |

### Routing

```
/                     → redirect: ingelogd → /grid, uitgelogd → /login
/login                → Supabase magic link login
/grid                 → hoofdscherm: scrollbaar 3-koloms grid
/grid/[postId]        → fullscreen post-editor
/settings             → tone of voice, account, uitloggen
```

### Supabase auth — domein-check

Na Supabase login controleert server-side middleware of het e-mailadres eindigt op `@woodykids.com`. Zo niet: sessie direct vernietigd, redirect naar `/login` met foutmelding.

### Zustand store — `useGridStore`

```ts
{
  posts: Post[]
  conflictIds: string[]        // ids van posts in conflict-state
  draggingId: string | null
  setOrder: (ids: string[]) => void
  detectConflicts: () => void  // herberekent conflictIds na elke mutatie
}
```

De store wordt gehydrateerd vanuit `GET /api/posts` bij page load. Daarna volledig client-side tijdens drag-interactie. Na elke drop: `PUT /api/grid/order` + `detectConflicts()`.

---

## 4. API routes (stubs → later real)

Elke stub returnt data in exact dezelfde shape als de echte integratie straks. De UI ziet nooit het verschil.

```
GET  /api/posts                  → alle posts (fake fixture)
PUT  /api/grid/order             → sla nieuwe volgorde op { ids: string[] }
POST /api/posts/generate         → genereer N posts via AI { count: number }
POST /api/posts/create-product   → nieuwe post vanuit Shopify product
POST /api/posts/create-upload    → nieuwe post vanuit eigen upload
PUT  /api/posts/[id]             → update post:
                                     selectedImageIndex | mediaUrl
                                     cropData
                                     caption (opener/middle/closer)
                                     hashtags
                                     scheduledAt
POST /api/posts/[id]/upload-media → upload image/video naar Supabase Storage
POST /api/posts/[id]/publish      → stuur naar Zernio (stub logt alleen)
DELETE /api/posts/[id]            → verwijder post (conflict auto-remove of handmatig)
PUT  /api/settings/tone-of-voice  → sla bijgewerkt tone of voice document op
GET  /api/settings/tone-of-voice  → haal huidig document op
```

---

## 5. Schermen

### 5.1 Login (`/login`)

- Magic link via Supabase
- Minimale UI: logo, e-mailinput, verzendknop
- Foutmelding bij niet-woodykids.com adres: "Alleen @woodykids.com accounts hebben toegang."

### 5.2 Grid (`/grid`)

Het hoofdscherm. Geen aparte secties of tabs — één doorlopend scrollbaar 3-koloms grid.

**Structuur van boven naar beneden:**

```
[leeg]  [leeg]  [leeg]       ← linksboven: nieuwe slots
[draft] [draft] [draft]      ← planning zone
[locked🔒] [conflict⚠️] [locked🔒]  ← conflict: ingeklemd tussen published + heden
[locked🔒] [locked🔒] [locked🔒]    ← rechtsonder: gepubliceerd
```

**Header (sticky):**
- Logo links
- "✨ Vul aan tot 9" rechts (oranje knop)
- ⚙️ icoon voor settings

**Cel-weergave per state:**

| State | Achtergrond | Extras |
|---|---|---|
| `empty` | grijs gestippeld | tekst "leeg" |
| `draft` | oranje (product) / geel (persoon) | "concept" chip linksboven |
| `conflict` | oranje/geel + pulserende oranje ring | `!` pip linksboven |
| `locked` | blauw (product) / paars (persoon) | 🔒 rechtsboven, datum onderaan |

**Drag-and-drop:**
- Long press (500ms) om een draft-post op te pakken
- Andere draft-posts schuiven automatisch door (Framer Motion layout animatie)
- Locked posts bewegen nooit
- Een draft over een locked post laten vallen: de draft schuift ertussen zonder locked posts te verplaatsen
- Na loslaten: `PUT /api/grid/order` + `detectConflicts()`

**"Vul aan tot 9" logica (fake):**
- Telt het aantal huidige draft-posts (locked posts tellen niet mee)
- Genereert `9 - aantal drafts` nieuwe posts via `POST /api/posts/generate`
- Fake AI: vult afwisselend persoon/product posts in (`isPerson` alternates)
- Elk product komt maximaal één keer voor per batch van 9
- Standaard geselecteerde foto: index 1 (Shopify sfeerfoto)

### 5.3 Conflict-flow

**Detectie:** na elke grid-mutatie herberekent `detectConflicts()` welke drafts in conflict zijn. Een draft is in conflict als er een locked post bestaat met een lager positienummer (= linkser in het grid = meer recent gepubliceerd). Dat betekent: er is iets gepubliceerd dat "na" de draft hoort te staan, terwijl de draft zelf nog niet gepubliceerd is.

**Visueel:** pulserende oranje ring + `!` pip op de post. Gele banner bovenaan de grid met samenvatting.

**Action sheet (tik post of banner):**
1. Nu inplannen — date/time picker opent als sheet in de editor
2. Verplaatsen naar het heden — schuift de post omhoog naar de draft zone
3. Ruilen met een andere draft
4. _(informatienoot)_ Niets doen = post wordt automatisch verwijderd uit het grid zodra er een nieuwe locked post met een lager positienummer verschijnt. De post is dan weg (geen archief in MVP-scope).

### 5.4 Fullscreen editor (`/grid/[postId]`)

Opent bij tap op een draft-post. Fullscreen, "‹ Terug" bovenaan.

**Structuur:**

```
[Header: ‹ terug | productnaam | Inplannen →]
[Foto: 4:5 crop, pinch om te zoomen, drag om te herpositioneren]
[Foto-selector: thumbnails van Shopify-foto's of upload-knop]
──────────────────────────────────────────────
[Opener]   variant 1 · 2 · 3
[Middenstuk] variant 1 · 2 · 3
[Afsluiter]  variant 1 · 2 · 3
──────────────────────────────────────────────
[Hashtags: badge badge badge badge badge]
  (5 badges, togglebaar, standaard 3 actief)
```

**Foto-crop:**
- Vaste 4:5 container
- Pinch: zoom in/uit (`scale` in cropData)
- Drag binnen het kader: `x` en `y` in cropData
- Foto-selector: horizontaal scrollbare rij thumbnails (Shopify images[])

**Eigen upload (kind: 'upload'):**
- Geen Shopify-thumbnails, maar een upload-knop
- Upload naar Supabase Storage via `POST /api/posts/[id]/upload-media`
- Gebruiker geeft een korte prompt mee als context voor AI ("Sinterklaas actie, 20% korting")
- Voor video (Reel): geen crop, maar een thumbnail-frame selector (schuifbalk om het gewenste stillframe te kiezen als preview)
- Captions en hashtags werken identiek

**Caption-blokken:**
- Drie varianten per blok, geselecteerde variant highlighted
- Vrij bewerkbaar: tik op de tekst om te typen
- "Regenereer" knop per blok (stub: returnt nieuwe fake variant)

**Hashtags:**
- 5 badges, standaard eerste 3 actief (groen), rest inactief (grijs)
- Tap om te togglen
- "Regenereer hashtags" knop (stub)

**Inplannen-flow:**
- Knop "Inplannen →" in de header
- Date/time picker schuift omhoog als een sheet, editor blijft zichtbaar op achtergrond
- Bevestigen: `PUT /api/posts/[id]` met `scheduledAt` + `POST /api/posts/[id]/publish`
- Post verandert naar state `locked`, terug naar grid

### 5.5 Settings (`/settings`)

Bereikbaar via ⚙️ in de grid-header.

**Secties:**
1. **Tone of voice** — bewerkbare textarea met de huidige regels, opgeslagen via `PUT /api/settings/tone-of-voice`. AI laadt dit document bij elke generatie.
2. **Account** — naam, e-mailadres (readonly), uitlogknop

---

## 6. Tone of voice (standaard)

Dit document leeft in de settings en is bewerkbaar. Standaardinhoud:

> Schrijf alsof je je beste vriendin een tip geeft. Niet: "Dit product is vervaardigd uit duurzame materialen." Maar: "Dit ding gaat mee tot je kind op de middelbare zit."
>
> Regels:
> - Korte zinnen. Maximaal twee komma's per zin.
> - Altijd actief. Niet "wordt gemaakt" maar "maken we".
> - Geen em-dash, geen dubbele punt halverwege een zin.
> - Humor mag, maar één grapje per post is genoeg.
> - Geen aanhalingstekens als je iets wilt benadrukken, gebruik gewoon vette taal.
> - Opener: haak meteen in, geen "Hé mama!" als openingszin.
> - Middenstuk: één concreet ding over het product.
> - Afsluiter: sluit af met energie, geen "bestel nu".
> - Emoji: max 2 per post, alleen als ze echt iets toevoegen. Geen confetti, geen 100.

---

## 7. Fake data structuur

Fixtures leven in `src/lib/fixtures/`. Elke fixture spiegelt exact de shape van de echte API-response.

```
src/lib/fixtures/
  posts.ts        → 12 fake posts (mix van empty/draft/locked/conflict)
  products.ts     → 9 fake Shopify producten met images[]
  settings.ts     → standaard tone of voice tekst
```

Fake posts bevatten realistische Nederlandse captions, hashtags en Shopify-image URLs (Unsplash placeholders met hout/speelgoed thema).

---

## 8. Wat buiten scope valt voor de MVP

- Echte Shopify API-koppeling
- Echte Claude API voor tekstgeneratie
- Echte Zernio publicatie
- Instagram preview (hoe de feed er echt uitziet)
- Multi-user / team accounts
- Post-archief scherm
- Push notificaties voor conflict-deadlines

---

## 9. Succes-criteria voor de MVP

- [ ] Inloggen werkt, niet-woodykids.com accounts worden geblokkeerd
- [ ] Grid toont mix van empty/draft/locked posts in juiste richting
- [ ] "Vul aan tot 9" vult lege slots met fake AI-posts
- [ ] Drag-and-drop voelt snappy aan op mobile (long press, smooth animaties)
- [ ] Conflict-detectie werkt correct, alert en action sheet functioneren
- [ ] Fullscreen editor: foto-crop, foto-selectie, caption-blokken, hashtag-toggles
- [ ] Eigen upload flow werkt (image + video)
- [ ] Inplan-flow: date/time picker, post wordt locked
- [ ] Settings: tone of voice bewerkbaar, uitloggen werkt
- [ ] Alle API routes retourneren correcte fake data in productie-waardige shape

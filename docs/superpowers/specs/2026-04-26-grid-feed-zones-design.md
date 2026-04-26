# Grid feed zones, concepten browser-local, add-tegel, unlock-flow

**Datum:** 2026-04-26
**Status:** Approved (awaiting plan)

## Probleem

De grid mist een coherent ordenings- en levenscyclus-model:

- Posts staan chronologisch oplopend (oudste linksboven), tegengesteld aan Instagram-conventie.
- "Empty" slots staan op willekeurige posities in plaats van bovenaan.
- Concepten worden gedeeltelijk gepersisteerd door autosave-PUT en — bij een eerdere bug in de publish-volgorde — door een gefaalde Zernio-call. Dat veroorzaakt "spook"-rijen in de DB.
- Locked posts (gepland of al live) worden hetzelfde behandeld; er is geen onderscheid tussen "nog te editen" en "definitief".
- Geen handmatige weg om buiten "Vul aan tot 9" om één enkele post toe te voegen (de SourcePicker bestaat in de code maar wordt nooit getoond).

## Oplossing: één chronologische feed met vier zones

De grid wordt gerenderd als één doorlopende Instagram-stijl feed. Sortering: **nieuwste linksboven, oudste rechtsonder.**

Van linksboven (nieuwste) naar rechtsonder (oudste):

| # | Zone | Bron | Editbaar? | Versleepbaar? |
|---|---|---|---|---|
| 1 | **Add-tegel** | client (statisch) | n.v.t. | nee |
| 2 | **Concepten** | Zustand store (in-memory) | ja | ja, onderling |
| 3 | **Geplande posts** | Supabase (`scheduled_at >= now()`) | nee, tenzij ge-unlocked | nee |
| 4 | **Live posts** | Supabase (`scheduled_at < now()`) | nee | nee |

### Sortering binnen elke zone

- **Add-tegel:** altijd één enkele cel, exact op grid-positie 0 (linksboven).
- **Concepten:** in de volgorde waarin ze door "Voeg 9 toe" of de add-tegel zijn aangemaakt (nieuwste eerst). Onderling versleepbaar binnen deze zone.
- **Geplande posts:** op `scheduled_at` aflopend (laatst-geplande direct onder de concepten, eerstvolgende publicatie aan de onderkant van deze zone).
- **Live posts:** op `scheduled_at` aflopend (meest recent gepubliceerd bovenaan, oudste rechtsonder).

Drag-and-drop werkt **alleen** binnen de concepten-zone. Je kunt een concept niet tussen geplande posts in slepen — ordening daar wordt volledig bepaald door `scheduled_at`. Wil je tussen twee geplande posts in publiceren, dan kies je gewoon een tijdstip ertussen; de post landt automatisch op de juiste plek.

## Concepten leven alleen in de browser

- Concepten worden **nooit** in Supabase gepersisteerd.
- Ze leven uitsluitend in de Zustand `gridStore`.
- Edits in de editor (crop, foto-selectie, captions, hashtags) updaten de store en blijven daarmee behouden bij navigatie binnen de SPA (editor ↔ grid).
- **Een page refresh wist alle concepten.** Dit is het verwachte gedrag.
- De DB bevat dus alleen geplande en live posts.

## "Voeg 9 toe" knop

- Vervangt "Vul aan tot 9".
- Elke klik genereert 9 nieuwe concepten en voegt ze direct na de add-tegel toe (positie 1..9).
- Bestaande concepten en alle DB-posts schuiven 9 plaatsen naar achter.
- Geen plafond — meermaals klikken kan; je krijgt 18, 27, etc. concepten.
- Caption-generatie loopt op de achtergrond, zoals nu.
- Knop blijft altijd zichtbaar (geen `if (needed === 0) return null` meer).

## Add-tegel UX

- Eén lichtgrijze tegel, altijd op grid-positie 0 (linksboven).
- Inhoud: groot "+" icoon, eventueel met een subtiel label "Voeg toe".
- Tap → opent de bestaande `SourcePicker` bottom sheet met twee opties:
  - **"Uit Shopify-product"** → opent `ProductPicker` → resulteert in een nieuwe concept-tegel op positie 1.
  - **"Zelf uploaden"** → opent `UploadPicker` → resulteert in een nieuwe concept-tegel op positie 1.
- De handmatig toegevoegde post is een gewoon concept (browser-local), volgt dezelfde levenscyclus als concepten uit "Voeg 9 toe".

## Locked vs Live afleiden

- Geen aparte DB-state voor "live". `live = scheduled_at < now()`.
- DB-state `'locked'` blijft bestaan en betekent simpelweg "in DB en gepland".
- Render-logica in de grid bepaalt aan de hand van `scheduled_at` of een locked post in de "geplande" of "live" zone valt.
- States `'draft'`, `'conflict'` en `'empty'` worden uit de DB gestript (zie schema-cleanup hieronder).

## Unlock-flow

Een geplande (nog niet live) post kan worden ge-unlocked om alsnog te editen.

- UI: in de PostCell van een geplande post (en alleen geplande, niet live) een "Unlock"-actie.
- Backend: nieuwe endpoint `POST /api/posts/[id]/unlock`. Doet:
  1. Lookup `zernio_post_id` op de DB-row.
  2. `DELETE https://zernio.com/api/v1/posts?postId=<zernioId>` — Zernio refundt automatisch het quota-slot.
  3. Verwijder de Supabase-row volledig (geen state-herwaardering nodig — concepten staan toch niet in DB).
  4. Stuur de post-snapshot terug zodat de client 'm in de Zustand-store kan zetten als concept.
- De post leeft daarna verder als gewoon concept (browser-only). Wil je 'm opnieuw publiceren, dan ga je door de normale publish-flow heen → nieuwe Zernio-call → nieuwe DB-row.
- Quota-impact: 0 (oude geannuleerd → 1 refund; nieuwe gepland → 1 verbruik).

**Vereiste schema-aanpassing:** posts moeten een nullable `zernio_post_id text` kolom krijgen, gevuld door de publish-route met de ID die Zernio teruggeeft. (Check Zernio response shape in plan-fase; zo niet beschikbaar, dan unlock-flow ontwerpen rond een andere identificator zoals scheduled_at + content-hash, maar dat is fragiel.)

## Schema-cleanup

- Verwijder rijen met `state IN ('draft', 'conflict', 'empty')` uit `posts` (eenmalig). Concepten staan toch niet meer in DB.
- Optioneel: enum/check-constraint op `state` versmallen tot `'locked'` — maar dat kan in een latere migratie, niet blokkerend.
- Geen "empty"-slots meer aanmaken bij grid-init.

## Wijzigingen per file (richting voor het implementatieplan)

| File | Verandering |
|---|---|
| `src/app/api/posts/[id]/publish/route.ts` | Volgorde fix: Zernio call eerst, pas bij succes INSERT met `state='locked'` en `zernio_post_id`. |
| `src/app/api/posts/[id]/unlock/route.ts` | Nieuwe POST-endpoint: cancel bij Zernio + delete row. |
| `src/app/api/posts/[id]/route.ts` | PUT-handler kan weg (concepten zitten niet in DB). DELETE blijft voor unlock-helper. |
| `src/app/api/posts/route.ts` | GET filtert al impliciet alleen op DB-rows; geen verandering nodig behalve evt. order: `scheduled_at DESC`. |
| `src/app/api/posts/generate/route.ts` | Geeft 9 concept-objects terug, geen DB-interactie. Geen `startPosition` meer nodig — client positioneert. |
| `src/app/grid/page.tsx` | Initiële fetch haalt alleen DB-rows op (geplande + live). Concepten beginnen leeg. Achtergrond-captiongeneratie blijft. |
| `src/app/grid/[postId]/page.tsx` | `save()` doet alleen `updatePost` in store, geen PUT meer. Geplande posts openen in read-only modus met prominente "Unlock om te editen"-CTA bovenin. Tap op een live post navigeert niet naar de editor. |
| `src/components/grid/PostGrid.tsx` | Render in nieuwe zone-volgorde. Drag-and-drop alleen binnen concept-indices. Add-tegel render op index 0. |
| `src/components/grid/FillButton.tsx` | "Voeg 9 toe", altijd zichtbaar. Geen empty-slot logica; voegt concepten toe aan store. |
| `src/components/grid/PostCell.tsx` | Render-varianten: add-tile (nieuw), concept, planned, live. Unlock-actie op planned. |
| `src/components/grid/AddTile.tsx` | Nieuw component. Toont +-icoon, opent SourcePicker. |
| `src/lib/store/gridStore.ts` | Eventuele persist-middleware uitzetten als die bestaat (refresh moet wissen). Helpers voor zone-sortering. |
| `src/lib/zernio/client.ts` | Nieuwe `cancelZernioPost(postId)`-functie die DELETE doet. `scheduleZernioPost` returnt `zernio_post_id` (response uitlezen). |

## Niet in scope

- Live-detectie via Zernio webhook (`post.published` event). We leiden af uit `scheduled_at < now()`. Webhook-implementatie kan later als de afgeleide aanname te grof blijkt.
- Re-publish vanuit een live post (bijv. carousel update). Live posts zijn definitief.
- Multi-user concurrency. Concepten zijn browser-local; locked posts zijn server-state, race conditions zijn onwaarschijnlijk in single-user gebruik.
- Drag-and-drop tussen zones. Bewust uitgesloten — bron van verwarring.

## Open vragen

Geen — alle eerder besproken twijfels zijn besloten:
- Sortering = chronologisch nieuw→oud, één feed.
- Concepten = browser-only, refresh wist.
- Add-tegel = bottom sheet (optie A).
- Unlock = Zernio DELETE, refundt quota.
- Live = afgeleid uit `scheduled_at`.

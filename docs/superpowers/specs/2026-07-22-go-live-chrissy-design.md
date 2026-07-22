# Go-live: WoodyKids Poster gehost, beveiligd, bruikbaar door Chrissy

**Datum:** 2026-07-22
**Status:** Awaiting review

## Probleem / huidige staat

De app draait alleen lokaal en is in de huidige vorm niet klaar om publiek (op internet) te draaien:

- **Supabase-backend ligt eruit.** Het project `nkrsfxugnxkfcfpjcbme` (naam: `woodykids-social-poster-app`) staat **gepauzeerd** (`INACTIVE`); het subdomein resolvet niet meer (NXDOMAIN). Gevolg: `/api/posts` geeft 500, de grid is leeg, en de magic-link login (óók Supabase) werkt niet. De data is behouden — het project hoeft alleen hersteld te worden.
- **API-routes zijn onbeveiligd.** Route-bescherming loopt via `src/proxy.ts` (Next.js 16's hernoemde middleware), maar de `matcher` sluit `api/` expliciet uit, en de API-routes checken zelf geen sessie. Pagina's (`/grid`, `/settings`) zijn dus dicht, maar `POST /api/posts/[id]/publish`, `/api/posts/generate` e.d. zijn zonder login aanroepbaar. Dat is het echte beveiligingsgat vóór publiek draaien.
- **De grid-feed-zones rework staat klaar maar niet op main.** Volledig gebouwd op `feature/grid-feed-zones` (geverifieerd: 45/50 tests groen, 5 falers zijn stale tests/env — geen productbugs; app draait, nieuwe 4-zone grid werkt). Nog niet gemerged.
- **Chrissy kan de app nog niet gebruiken** omdat hij niet gehost is.

## Doel

WoodyKids Poster van "lokaal, backend gepauzeerd" naar **gehost op internet, achter login, bruikbaar door Elwyn én Chrissy**, met de grid-feed-zones rework meegenomen.

## Vastgelegde beslissingen

- **Merge-first:** de grid-feed-zones rework wordt eerst gemerged naar main; daarna gaan we live. (Beter product, fixt de spookrijen-bug, vermijdt een datamodel-migratie op een reeds-live tool.)
- **Chrissy's toegang:** Chrissy heeft een eigen `@woodykids.com`-adres. Het bestaande domein-gebaseerde toegangsmodel (magic link, beperkt tot `@woodykids.com`) blijft dus ongewijzigd — geen allowlist-herbouw nodig.
- **Hosting:** starten met een gratis `*.vercel.app`-URL. Eigen domein kan later zonder herbouw.
- **Testfase:** Chrissy test vanaf go-live meteen mee; bij de deploy verifiëren we dat de magic-link login werkt voor zowel Elwyns als Chrissy's `@woodykids.com`-adres.

## Aanpak (vijf blokken, in volgorde van afhankelijkheid)

### Blok 1 — Rework mergen naar `main`

- **Fix de 5 stale tests** op de branch zodat de suite groen is vóór de merge:
  - `src/lib/shopify/__tests__/client.test.ts`: mock-producten missen `status`; voeg `status: 'active'` toe (de client filtert nu op actieve producten).
  - `src/lib/zernio/__tests__/client.test.ts` (of `tests/lib/zernio/client.test.ts`): cancel-verwachting bijwerken naar de path-param-vorm (`DELETE /v1/posts/{id}`) conform commit `0ba28b0`.
  - `src/lib/anthropic/__tests__/integration.test.ts`: deze bellen de échte API; markeer als skip/conditioneel wanneer `ANTHROPIC_API_KEY` ontbreekt, zodat ze CI niet rood maken maar lokaal-met-key wel draaien.
- **Merge** `feature/grid-feed-zones` → `main`.
- **Ruim git-rommel op** in de working tree: verwijderde `.claude/worktrees/*`-refs en de verplaatste zernio-testfile netjes verwerken/committen.
- **Verificatie:** `npm run test:run` groen op main; app start lokaal.

### Blok 2 — Supabase herstellen

- **Restore** het bestaande project `nkrsfxugnxkfcfpjcbme` (data blijft behouden).
- **Migraties:** controleer dat 001–003 zijn toegepast; pas **004** (`004_grid_feed_zones.sql`) toe. 004 verwijdert alleen niet-`locked` rijen (oude drafts); geplande/live posts blijven. Let op: bestaande locked posts hebben geen `zernio_post_id` (nullable) — dat is verwacht.
- **Fallback:** lukt de restore niet (data gepurged), maak een nieuw project, draai alle migraties, en werk `.env.local` + Vercel-env bij met de nieuwe URL/keys.
- **Verificatie:** `/api/posts` geeft 200 lokaal; magic-link login werkt lokaal.

### Blok 3 — API-gat dichten (kern van "veilig publiek")

- Nieuwe gedeelde helper, bijv. `src/lib/supabase/require-user.ts`:
  - Maakt de server-client, roept `auth.getUser()` aan.
  - Geen geldige sessie of e-mail niet op `@woodykids.com` → geeft een **401 JSON**-response terug (géén redirect; een fetch hoort geen HTML-loginpagina te krijgen).
  - Respecteert de bestaande `E2E_TEST=true`-bypass voor testpariteit met de e2e-suite.
- **Pas toe op alle** `/api/*`-routes (post-merge set): o.a. `posts` (GET), `posts/[id]` (GET/DELETE), `posts/[id]/generate-caption`, `posts/[id]/publish`, `posts/[id]/unlock`, `posts/[id]/upload-media`, `posts/create-product`, `posts/create-upload`, `posts/generate`, `posts/repick`, `products`, `collections`, `settings/tone-of-voice`. **Uitgezonderd:** `/auth/callback` blijft publiek (login-afhandeling).
- **Tests:** per helper/route een 401 zonder sessie en een 200 mét sessie.

### Blok 4 — Deployen naar Vercel

- Vercel-project koppelen aan de repo; deployen vanaf `main`.
- **Alle env-vars** in Vercel zetten: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SHOPIFY_*`, `ZERNIO_*`, `ANTHROPIC_API_KEY`. (E2E_TEST **niet** in productie.)
- **Supabase Auth config:** productie-URL toevoegen aan **Site URL** + **Redirect URLs** (`emailRedirectTo` gebruikt `window.location.origin`, dus de allowlist moet de Vercel-URL bevatten, anders faalt de magic link).
- **End-to-end verificatie op de live URL:** inloggen met een `@woodykids.com`-adres (Elwyn én Chrissy) → grid zien; één concept genereren; een niet-@woodykids.com adres wordt geweigerd; een `/api/*`-call zonder sessie geeft 401.

### Blok 5 — Optioneel / later (buiten scope, YAGNI)

- **Eigen SMTP** voor magic-link mail (Supabase-default heeft lage verzendlimiet + spamrisico). Voor twee gebruikers meestal voldoende; opschalen zodra het knelt.
- **Eigen domein** (bijv. `poster.woodykids.com`) i.p.v. `*.vercel.app`.

## Expliciete go/no-go-momenten

Twee acties raken infra/publiek en worden pas na expliciete toestemming uitgevoerd:
1. **Supabase-project herstellen** (Blok 2).
2. **Eerste deploy naar Vercel** (Blok 4).

## Niet in scope

- Toegangsmodel verbreden voorbij `@woodykids.com` (niet nodig — Chrissy heeft zo'n adres).
- Eigen SMTP en eigen domein (zie Blok 5).
- Multi-user concurrency-hardening voorbij wat de rework al biedt (concepten browser-lokaal; geplande/live posts gedeeld). Voor twee gebruikers laag risico.
- Rate limiting / WAF op de API (401-gate volstaat voor een interne tool).

## Risico's

- **Supabase-restore faalt** (data na lange pauze gepurged) → fallback naar nieuw project (Blok 2).
- **Magic-link mail onbetrouwbaar** bij meer gebruik → eigen SMTP (Blok 5).
- **Merge-conflicten/regressies** bij het mergen → tests groen als gate vóór en na de merge (Blok 1).

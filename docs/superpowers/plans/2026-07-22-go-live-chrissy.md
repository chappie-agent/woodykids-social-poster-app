# Go-live: WoodyKids Poster gehost, beveiligd, Chrissy-toegang — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** WoodyKids Poster van "lokaal, backend gepauzeerd" naar gehost (Vercel), achter login, bruikbaar door Elwyn én Chrissy — met de grid-feed-zones rework meegenomen en het onbeveiligde API-oppervlak dichtgezet.

**Architecture:** We werken op één integratiebranch `feature/go-live-chrissy`. Daarin mergen we eerst de grid-feed-zones rework, maken de testsuite groen, herstellen Supabase, en zetten alle `/api/*`-routes achter een `requireUser()`-guard die 401 geeft zonder geldige `@woodykids.com`-sessie. Als laatste mergen we naar `main` en deployen naar Vercel.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts` i.p.v. middleware), React 19, Supabase (DB + Auth via `@supabase/ssr`), Zustand 5, Vitest + Playwright, Vercel. Zernio/Shopify/Anthropic REST APIs.

## Global Constraints

- **Next.js 16 is anders:** lees `node_modules/next/dist/docs/` vóór je routes of conventies aanraakt. Route-bescherming loopt via `src/proxy.ts` (niet `middleware.ts`).
- **Toegang is beperkt tot `@woodykids.com`** — zowel in `src/proxy.ts` (pagina's) als straks in `requireUser()` (API). Niet verbreden.
- **Test-bypass:** `process.env.E2E_TEST === 'true'` slaat auth over. Dit hoort in test- en e2e-runs, **nooit** in productie-env.
- **Magic-link redirect** gebruikt `window.location.origin` — de live URL moet in Supabase Auth → Site URL + Redirect URLs staan.
- **Uitgangspunt branch:** `feature/go-live-chrissy` is aangemaakt vanaf `main` en bevat al de design-spec (`docs/superpowers/specs/2026-07-22-go-live-chrissy-design.md`).

---

### Task 1: Grid-feed-zones rework mergen in de integratiebranch

**Files:**
- Git-operatie; geen bestand direct.

- [ ] **Step 1: Zorg dat je op de integratiebranch staat**

Run: `git -C /Users/elwyndeneve/Development/woodykids-social-poster-app checkout feature/go-live-chrissy && git status --short`
Expected: op `feature/go-live-chrissy`. Losse working-tree-rommel mag er staan (worktree-refs, `.claude/launch.json`) — die ruimen we in Step 4 op.

- [ ] **Step 2: Merge de rework-branch erin**

Run: `git -C /Users/elwyndeneve/Development/woodykids-social-poster-app merge --no-ff feature/grid-feed-zones -m "merge: grid-feed-zones rework in go-live branch"`
Expected: merge slaagt. **Bij conflicten:** los ze op door voor bestanden onder `src/`, `tests/`, `supabase/` de **rework-versie** (`feature/grid-feed-zones`) te kiezen (`git checkout --theirs <pad>`), en voor `docs/` beide te behouden. Daarna `git add` + `git commit`.

- [ ] **Step 3: Installeer deps opnieuw (branch heeft andere package.json) en type-check**

Run: `cd /Users/elwyndeneve/Development/woodykids-social-poster-app && npm install && npx tsc --noEmit 2>&1 | tail -20`
Expected: `npm install` klaar; `tsc` geen errors (of alleen bekende die volgende taken oplossen — noteer ze).

- [ ] **Step 4: Ruim git-rommel op**

Verwijder de verouderde worktree-refs uit versiebeheer en houd de lokale dev-launcher buiten git:

Run:
```bash
cd /Users/elwyndeneve/Development/woodykids-social-poster-app
git rm --cached -r .claude/worktrees 2>/dev/null || true
printf '\n.claude/launch.json\n' >> .gitignore
git add .gitignore
git commit -m "chore: drop stale worktree refs, ignore local launch.json"
```
Expected: schone `git status` op de tracked bestanden na (alleen `.claude/launch.json` en `.worktrees/` blijven untracked/ignored).

---

### Task 2: Shopify-client tests fixen (stale mocks missen `status`)

De client filtert op `status === 'active'` (`src/lib/shopify/client.ts:110`), maar de mock-producten hebben geen `status` → ze worden weggefilterd.

**Files:**
- Modify: `src/lib/shopify/__tests__/client.test.ts`

- [ ] **Step 1: Voeg `status: 'active'` toe aan beide mock-producten**

In `src/lib/shopify/__tests__/client.test.ts`, in de test `'maps Shopify API response to ShopifyProduct[]'`, wijzig het product-object:

```ts
products: [{
  id: 123,
  title: 'Houten treintje',
  status: 'active',
  images: [{ src: 'https://cdn.shopify.com/img.jpg' }],
  variants: [{ id: 456, title: 'Standaard', price: '24.95' }],
}],
```

En in de test `'geeft lege array bij product zonder collectie'`:

```ts
products: [{ id: 1, title: 'Solo', status: 'active', images: [], variants: [] }],
```

- [ ] **Step 2: Run de Shopify-tests, verifieer groen**

Run: `npm run test:run -- src/lib/shopify/__tests__/client.test.ts`
Expected: alle tests PASS (incl. de eerdere 2 falers).

- [ ] **Step 3: Commit**

```bash
git add src/lib/shopify/__tests__/client.test.ts
git commit -m "test(shopify): add status:'active' to product mocks"
```

---

### Task 3: Zernio cancel-test fixen (query-param → path-param)

De client doet `DELETE /v1/posts/{id}` (`src/lib/zernio/client.ts:66`), de test verwacht nog `?postId=`.

**Files:**
- Modify: `tests/lib/zernio/client.test.ts`

- [ ] **Step 1: Werk de cancel-test bij naar de path-param-vorm**

In `tests/lib/zernio/client.test.ts`, vervang de test `'issues DELETE to /v1/posts with postId query param'`:

```ts
it('issues DELETE to /v1/posts/{id} (path param)', async () => {
  const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ success: true }), { status: 200 })
  )

  await cancelZernioPost('zernio-abc')

  expect(fetchMock).toHaveBeenCalledWith(
    'https://zernio.com/api/v1/posts/zernio-abc',
    expect.objectContaining({
      method: 'DELETE',
      headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
    })
  )
})
```

- [ ] **Step 2: Run de Zernio-tests, verifieer groen**

Run: `npm run test:run -- tests/lib/zernio/client.test.ts`
Expected: alle 4 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/lib/zernio/client.test.ts
git commit -m "test(zernio): expect DELETE path param, matching client"
```

---

### Task 4: Anthropic-integratietests overslaan zonder API-key

Deze tests bellen de échte Anthropic API; zonder key horen ze te skippen i.p.v. CI rood te maken.

**Files:**
- Modify: `src/lib/anthropic/__tests__/integration.test.ts`

- [ ] **Step 1: Maak het describe-blok conditioneel**

In `src/lib/anthropic/__tests__/integration.test.ts`, vervang de regel:

```ts
describe('Anthropic caption generation — real API', () => {
```

door:

```ts
describe.skipIf(!process.env.ANTHROPIC_API_KEY?.trim())('Anthropic caption generation — real API', () => {
```

- [ ] **Step 2: Run de volledige suite, verifieer volledig groen (skips toegestaan)**

Run: `npm run test:run 2>&1 | tail -15`
Expected: `Test Files … passed`, `Tests … passed | N skipped`, **0 failed**.

- [ ] **Step 3: Commit**

```bash
git add src/lib/anthropic/__tests__/integration.test.ts
git commit -m "test(anthropic): skip real-API tests when ANTHROPIC_API_KEY absent"
```

---

### Task 5: Supabase-project herstellen en migratie 004 toepassen

> **GO/NO-GO:** deze taak raakt je infra. Vraag Elwyn expliciet om akkoord vóór restore.

**Files:**
- Verify: `supabase/migrations/004_grid_feed_zones.sql`

- [ ] **Step 1: Restore het gepauzeerde project**

Gebruik de Supabase MCP `restore_project` met `project_id="nkrsfxugnxkfcfpjcbme"`.
Expected: project gaat van `INACTIVE` → `ACTIVE_HEALTHY` (kan enkele minuten duren; poll met `list_projects` of `get_project`).
**Fallback** als restore faalt (data gepurged): `create_project` (nieuw), noteer nieuwe URL + anon key, en werk `.env.local` + later de Vercel-env bij.

- [ ] **Step 2: Controleer welke migraties er al op staan**

Gebruik de Supabase MCP `list_migrations` met hetzelfde `project_id`.
Expected: 001–003 aanwezig. Zo niet, pas ze eerst toe uit `supabase/migrations/`.

- [ ] **Step 3: Pas migratie 004 toe**

Lees `supabase/migrations/004_grid_feed_zones.sql` en pas de inhoud toe via Supabase MCP `apply_migration` (`name="004_grid_feed_zones"`). Verwachte inhoud:

```sql
delete from posts where state <> 'locked';
alter table posts add column if not exists zernio_post_id text;
alter table posts drop constraint if exists posts_state_check;
alter table posts add constraint posts_state_check check (state = 'locked');
alter table posts alter column position drop not null;
alter table posts drop constraint if exists posts_position_key;
```

- [ ] **Step 4: Verifieer schema**

Via Supabase MCP `execute_sql`:
```sql
select column_name, is_nullable from information_schema.columns where table_name='posts';
```
Expected: `zernio_post_id` bestaat, `position` is nullable.

- [ ] **Step 5: Verifieer lokaal end-to-end**

Run: `npm run dev` (of via de preview-tooling), open `/api/posts`.
Expected: **200** met een (mogelijk lege) JSON-array — geen 500 meer.

---

### Task 6: `requireUser()`-guard bouwen (TDD)

**Files:**
- Create: `src/lib/supabase/require-user.ts`
- Test: `src/lib/supabase/__tests__/require-user.test.ts`
- Modify: `src/test/setup.ts`

**Interfaces:**
- Produces: `requireUser(): Promise<{ user: User; response: null } | { user: null; response: NextResponse }>`. Routes gebruiken: `const { response } = await requireUser(); if (response) return response`.

- [ ] **Step 1: Zet de test-bypass aan in de vitest-setup**

Voeg boven­aan `src/test/setup.ts` toe (zodat bestaande route-tests die geen sessie mocken blijven slagen):

```ts
process.env.E2E_TEST = 'true'
```

- [ ] **Step 2: Schrijf de failing tests**

`src/lib/supabase/__tests__/require-user.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

const ORIG = process.env.E2E_TEST

beforeEach(() => {
  delete process.env.E2E_TEST // test het echte auth-pad, niet de bypass
  vi.clearAllMocks()
})
afterEach(() => {
  if (ORIG === undefined) delete process.env.E2E_TEST
  else process.env.E2E_TEST = ORIG
})

function mockClient(user: unknown) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } }
}

describe('requireUser', () => {
  it('geeft 401 zonder sessie', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(mockClient(null) as never)
    const { requireUser } = await import('@/lib/supabase/require-user')
    const { user, response } = await requireUser()
    expect(user).toBeNull()
    expect(response?.status).toBe(401)
  })

  it('geeft 401 bij niet-@woodykids.com adres', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(mockClient({ email: 'x@gmail.com' }) as never)
    const { requireUser } = await import('@/lib/supabase/require-user')
    const { response } = await requireUser()
    expect(response?.status).toBe(401)
  })

  it('laat een geldige @woodykids.com gebruiker door', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(mockClient({ email: 'chris@woodykids.com' }) as never)
    const { requireUser } = await import('@/lib/supabase/require-user')
    const { user, response } = await requireUser()
    expect(response).toBeNull()
    expect(user?.email).toBe('chris@woodykids.com')
  })

  it('bypasst auth wanneer E2E_TEST=true', async () => {
    process.env.E2E_TEST = 'true'
    const { requireUser } = await import('@/lib/supabase/require-user')
    const { response } = await requireUser()
    expect(response).toBeNull()
  })
})
```

- [ ] **Step 3: Run de tests, verifieer dat ze falen**

Run: `npm run test:run -- src/lib/supabase/__tests__/require-user.test.ts`
Expected: FAIL — module `require-user` bestaat nog niet.

- [ ] **Step 4: Implementeer de helper**

`src/lib/supabase/require-user.ts`:

```ts
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

type RequireUserResult =
  | { user: User; response: null }
  | { user: null; response: NextResponse }

export async function requireUser(): Promise<RequireUserResult> {
  // Pariteit met proxy.ts: e2e-runs slaan auth over.
  if (process.env.E2E_TEST === 'true') {
    return { user: { email: 'e2e@woodykids.com' } as User, response: null }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.email?.endsWith('@woodykids.com')) {
    return { user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { user, response: null }
}
```

- [ ] **Step 5: Run de tests, verifieer groen**

Run: `npm run test:run -- src/lib/supabase/__tests__/require-user.test.ts`
Expected: 4 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/require-user.ts src/lib/supabase/__tests__/require-user.test.ts src/test/setup.ts
git commit -m "feat(auth): requireUser guard returning 401 for API routes"
```

---

### Task 7: `requireUser()` toepassen op alle API-routes

Elke exported handler (`GET`/`POST`/`PUT`/`DELETE`) krijgt bovenaan de guard. Uitzondering: `/auth/callback` (geen `/api`-route) blijft publiek.

**Files (elk aanpassen — voeg de guard toe aan élke handler in het bestand):**
- Modify: `src/app/api/posts/route.ts`
- Modify: `src/app/api/posts/[id]/route.ts`
- Modify: `src/app/api/posts/[id]/generate-caption/route.ts`
- Modify: `src/app/api/posts/[id]/publish/route.ts`
- Modify: `src/app/api/posts/[id]/unlock/route.ts`
- Modify: `src/app/api/posts/[id]/upload-media/route.ts`
- Modify: `src/app/api/posts/create-product/route.ts`
- Modify: `src/app/api/posts/create-upload/route.ts`
- Modify: `src/app/api/posts/generate/route.ts`
- Modify: `src/app/api/posts/repick/route.ts`
- Modify: `src/app/api/products/route.ts`
- Modify: `src/app/api/collections/route.ts`
- Modify: `src/app/api/grid/order/route.ts`
- Modify: `src/app/api/settings/tone-of-voice/route.ts`
- Modify: `src/app/api/settings/feed-first-column/route.ts`

- [ ] **Step 1: Pas het patroon toe per handler**

Voeg de import toe en guard élke handler. Voorbeeld voor `src/app/api/posts/route.ts` (GET):

```ts
import { requireUser } from '@/lib/supabase/require-user'
// ...bestaande imports...

export async function GET() {
  const { response } = await requireUser()
  if (response) return response

  const supabase = await createClient()
  // ...bestaande body ongewijzigd...
}
```

Herhaal exact dit patroon (`const { response } = await requireUser(); if (response) return response`) als eerste regels in **elke** exported handler in de bovenstaande bestanden.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit 2>&1 | tail -20`
Expected: geen nieuwe errors.

- [ ] **Step 3: Run de volledige unit-suite (bestaande route-tests bypassen via E2E_TEST uit Task 6)**

Run: `npm run test:run 2>&1 | tail -15`
Expected: **0 failed** (skips toegestaan).

- [ ] **Step 4: Handmatige 401-check lokaal**

Run (dev-server draait, zonder ingelogde sessie, E2E_TEST **niet** gezet):
`curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/posts`
Expected: **401**.

- [ ] **Step 5: Commit**

```bash
git add src/app/api
git commit -m "feat(api): guard all API routes with requireUser (401 unauthorized)"
```

---

### Task 8: Mergen naar `main` en deployen naar Vercel

> **GO/NO-GO:** de deploy is outward-facing. Vraag Elwyn expliciet om akkoord vóór de eerste deploy.

**Files:**
- Git + Vercel/Supabase-config; geen code.

- [ ] **Step 1: Volledige suite groen, dan merge naar main**

```bash
cd /Users/elwyndeneve/Development/woodykids-social-poster-app
npm run test:run 2>&1 | tail -5   # verwacht 0 failed
git checkout main
git merge --no-ff feature/go-live-chrissy -m "merge: go-live (rework + API-auth + Chrissy)"
```
Expected: merge slaagt, tests groen.

- [ ] **Step 2: Vercel-project koppelen en env-vars zetten**

Koppel de repo aan een Vercel-project (Vercel MCP `deploy_to_vercel`, of `vercel link` / dashboard). Zet in de Vercel Project Settings → Environment Variables **alle** keys uit `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_TOKEN`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `SHOPIFY_ADMIN_TOKEN`, `ZERNIO_API_KEY`, `ZERNIO_INSTAGRAM_ACCOUNT_ID`, `ANTHROPIC_API_KEY`.
**Zet `E2E_TEST` NIET** in productie.

- [ ] **Step 3: Deploy**

Deploy `main` naar productie. Noteer de `*.vercel.app`-URL.
Expected: build slaagt, site laadt de `/login`-pagina.

- [ ] **Step 4: Supabase Auth-URLs instellen**

In het Supabase-dashboard (Authentication → URL Configuration): zet **Site URL** op de Vercel-URL en voeg toe aan **Redirect URLs**: `https://<jouw-app>.vercel.app/auth/callback`.
Expected: opgeslagen. (Zonder dit faalt de magic link vanaf de live site.)

- [ ] **Step 5: End-to-end verificatie op de live URL**

- [ ] Login met Elwyns `@woodykids.com`-adres → magic link → `/grid` zichtbaar.
- [ ] Login met Chrissy's `@woodykids.com`-adres → idem.
- [ ] Een niet-`@woodykids.com` adres wordt geweigerd (`?error=unauthorized`).
- [ ] `curl -s -o /dev/null -w "%{http_code}\n" https://<jouw-app>.vercel.app/api/posts` zonder sessie → **401**.
- [ ] "Add Feed" genereert concepten; één post publiceren plant in bij Zernio.

- [ ] **Step 6: Deel de URL met Chrissy**

Stuur Chrissy de `*.vercel.app`-URL zodat ze kan inloggen en meetesten.

---

## Self-Review

**Spec-dekking:** Blok 1 (merge + tests) → Tasks 1–4. Blok 2 (Supabase) → Task 5. Blok 3 (API-auth) → Tasks 6–7. Blok 4 (Vercel) → Task 8. Blok 5 (SMTP/domein) is expliciet out-of-scope. Alle spec-secties gedekt.

**Go/no-go-momenten:** Supabase-restore (Task 5) en eerste deploy (Task 8) staan expliciet gemarkeerd als "vraag akkoord".

**Openstaand voor uitvoering:** de `.claude/launch.json` blijft lokaal (gitignored in Task 1). Bestaande locked posts zonder `zernio_post_id` zijn verwacht en niet-unlockbaar (spec-notitie).

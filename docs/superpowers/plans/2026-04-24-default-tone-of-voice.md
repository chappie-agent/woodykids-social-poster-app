# Default Tone of Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pre-fill the `tone_of_voice` column in the `settings` table so Claude generates on-brand captions from day one.

**Architecture:** One SQL migration file added to `supabase/migrations/`. The existing GET/PUT routes and generate-caption route pick it up automatically — no code changes needed.

**Tech Stack:** Supabase (Postgres), SQL.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/002_default_tone_of_voice.sql` | Create | Set the default tone of voice in the settings row |

---

## Task 1: Apply the migration

**Files:**
- Create: `supabase/migrations/002_default_tone_of_voice.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/002_default_tone_of_voice.sql` with this content:

```sql
UPDATE settings
SET tone_of_voice = 'Schrijf als een enthousiaste vriendin die iets tips aan haar BFF. Warm, eerlijk, nooit neerbuigend.

Stijl:
- Informeel: gebruik ''jij'', ''je'', ''jou'', ''we'' — nooit ''u''
- Korte zinnen. Geen lappen tekst.
- Geen gedachtestreepjes (—)
- Een vleugje humor is prima, maar maak er geen standup van

Verkoop:
Vermijd harde verkooptaal: geen ''koop nu!'', ''mis het niet!'' of drie uitroeptekens achter elkaar. Laat het product voor zichzelf spreken — jij voegt de sfeer toe.

Inhoud:
Focus op beleving en gevoel, niet op specs. Spreek ouders aan alsof je ze kent. Een retorische vraag of een kleine glimlach in de tekst mag.

Taal:
Altijd Nederlands.'
WHERE id = 1
  AND (tone_of_voice IS NULL OR tone_of_voice = '');
```

Note: single quotes inside SQL strings are escaped as `''` (two single quotes).

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use the Supabase MCP tool (`apply_migration`) with:
- `name`: `default_tone_of_voice`
- `query`: the full SQL from Step 1

- [ ] **Step 3: Verify the migration applied**

Use the Supabase MCP tool (`execute_sql`) with:
```sql
SELECT id, LEFT(tone_of_voice, 80) AS preview FROM settings WHERE id = 1;
```

Expected: the `preview` column starts with `Schrijf als een enthousiaste vriendin`.

- [ ] **Step 4: Run all tests to confirm no regressions**

```bash
npm test -- --run
```

Expected: all 74 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/002_default_tone_of_voice.sql
git commit -m "feat: seed default tone of voice in settings"
```

# Caption Length Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce the Instagram caption limit of 2,200 characters — first by instructing Claude in the system prompt, then by showing a live character count in the editor.

**Architecture:** Two independent changes: (1) add one sentence to `buildSystemPrompt` so Claude targets the limit at generation time; (2) add a read-only character counter below `HashtagBadges` in the editor that computes the assembled length of the selected variant combination and turns red above 2,200.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/anthropic/caption.ts` | Modify | Add length constraint to system prompt |
| `src/lib/anthropic/__tests__/caption.test.ts` | Modify | Test that system prompt contains the limit instruction |
| `src/app/grid/[postId]/page.tsx` | Modify | Add `assembledLength` helper + character counter UI |

---

## Context for implementers

### Current `buildSystemPrompt` (lines 14–23 of `src/lib/anthropic/caption.ts`)

```typescript
export function buildSystemPrompt(toneOfVoice: string): string {
  return `Je bent een social media copywriter voor WoodyKids, een Nederlandse kinderspeelgoedwinkel.
Schrijf altijd in het Nederlands.
Volg deze richtlijnen strikt op:

${toneOfVoice}

Geef je output ALTIJD als geldig JSON in exact dit formaat, zonder extra tekst:
{"opener":{"variants":["...","...","..."]},"middle":{"variants":["...","...","..."]},"closer":{"variants":["...","...","..."]},"hashtags":["...","...","...","...","..."]}`
}
```

### Relevant types (`src/lib/types.ts`)

```typescript
export type CaptionBlock = {
  variants: [string, string, string]
  selected: number
}

export type Hashtag = {
  text: string
  active: boolean
}

export type PostCaption = {
  opener: CaptionBlock
  middle: CaptionBlock
  closer: CaptionBlock
  hashtags: Hashtag[]
}
```

### Editor page caption section (lines 186–208 of `src/app/grid/[postId]/page.tsx`)

The caption section renders inside a `<>` fragment:
```tsx
<>
  <CaptionBlock label="Opener" ... />
  <CaptionBlock label="Middenstuk" ... />
  <CaptionBlock label="Afsluiter" ... />
  <HashtagBadges ... />
</>
```
The character counter goes after `<HashtagBadges>`, still inside the fragment.

### Run tests

```bash
npm test -- --run
```

---

## Task 1: Add length instruction to `buildSystemPrompt`

**Files:**
- Modify: `src/lib/anthropic/caption.ts`
- Modify: `src/lib/anthropic/__tests__/caption.test.ts`

- [ ] **Step 1: Add a failing test**

Open `src/lib/anthropic/__tests__/caption.test.ts` and add this test inside the existing `describe('buildSystemPrompt')` block:

```typescript
it('bevat de caption-lengtelimiet instructie', () => {
  const prompt = buildSystemPrompt('')
  expect(prompt).toContain('2.200 tekens')
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --run src/lib/anthropic/__tests__/caption.test.ts
```

Expected: FAIL — `'2.200 tekens'` not found in prompt.

- [ ] **Step 3: Add the length instruction to `buildSystemPrompt`**

In `src/lib/anthropic/caption.ts`, change `buildSystemPrompt` to:

```typescript
export function buildSystemPrompt(toneOfVoice: string): string {
  return `Je bent een social media copywriter voor WoodyKids, een Nederlandse kinderspeelgoedwinkel.
Schrijf altijd in het Nederlands.
Houd de totale caption (opener + middenstuk + afsluiter + hashtags samen) onder de 2.200 tekens.
Volg deze richtlijnen strikt op:

${toneOfVoice}

Geef je output ALTIJD als geldig JSON in exact dit formaat, zonder extra tekst:
{"opener":{"variants":["...","...","..."]},"middle":{"variants":["...","...","..."]},"closer":{"variants":["...","...","..."]},"hashtags":["...","...","...","...","..."]}`
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --run src/lib/anthropic/__tests__/caption.test.ts
```

Expected: all caption tests PASS.

- [ ] **Step 5: Run all tests**

```bash
npm test -- --run
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/anthropic/caption.ts src/lib/anthropic/__tests__/caption.test.ts
git commit -m "feat: add 2200-character Instagram limit instruction to system prompt"
```

---

## Task 2: Live character counter in the editor

**Files:**
- Modify: `src/app/grid/[postId]/page.tsx`

No unit tests — this is a pure UI display derived from already-tested types. Run all tests after to confirm no regressions.

- [ ] **Step 1: Add the constant and helper function**

At the top of the `EditorContent` component function body (after the state declarations), add:

```typescript
const INSTAGRAM_CAPTION_LIMIT = 2200

function assembledLength(caption: PostCaption): number {
  const opener = caption.opener.variants[caption.opener.selected] ?? ''
  const middle = caption.middle.variants[caption.middle.selected] ?? ''
  const closer = caption.closer.variants[caption.closer.selected] ?? ''
  const hashtags = caption.hashtags.filter(h => h.active).map(h => h.text).join(' ')
  const parts: string[] = [opener, middle, closer]
  if (hashtags) parts.push(hashtags)
  return parts.join('\n\n').length
}
```

Note: `PostCaption` is already imported at the top of the file as `CaptionBlock as CaptionBlockType`. Check the imports — `PostCaption` may need to be added to the import from `@/lib/types`.

- [ ] **Step 2: Add the character counter after `<HashtagBadges>`**

Find the caption fragment (the `<>` block starting around line 187). After the `<HashtagBadges ... />` line, add:

```tsx
{(() => {
  const count = assembledLength(post.caption)
  return (
    <p className={`text-xs text-right pr-1 ${count > INSTAGRAM_CAPTION_LIMIT ? 'text-red-600 font-semibold' : 'text-woody-taupe'}`}>
      {count} / {INSTAGRAM_CAPTION_LIMIT} tekens
    </p>
  )
})()}
```

The full fragment after your change:
```tsx
<>
  <CaptionBlock
    label="Opener"
    block={post.caption.opener}
    onChange={(opener: CaptionBlockType) => save({ caption: { ...post.caption!, opener } })}
  />
  <CaptionBlock
    label="Middenstuk"
    block={post.caption.middle}
    onChange={(middle: CaptionBlockType) => save({ caption: { ...post.caption!, middle } })}
  />
  <CaptionBlock
    label="Afsluiter"
    block={post.caption.closer}
    onChange={(closer: CaptionBlockType) => save({ caption: { ...post.caption!, closer } })}
  />
  <HashtagBadges
    hashtags={post.caption.hashtags}
    onChange={(hashtags: Hashtag[]) => save({ caption: { ...post.caption!, hashtags } })}
  />
  {(() => {
    const count = assembledLength(post.caption)
    return (
      <p className={`text-xs text-right pr-1 ${count > INSTAGRAM_CAPTION_LIMIT ? 'text-red-600 font-semibold' : 'text-woody-taupe'}`}>
        {count} / {INSTAGRAM_CAPTION_LIMIT} tekens
      </p>
    )
  })()}
</>
```

- [ ] **Step 3: Run all tests**

```bash
npm test -- --run
```

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/grid/[postId]/page.tsx
git commit -m "feat: show live Instagram character count in caption editor"
```

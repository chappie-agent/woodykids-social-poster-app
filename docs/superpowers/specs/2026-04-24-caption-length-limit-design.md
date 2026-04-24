# Caption Length Limit — Design Spec

**Doel:** Zorg dat captions binnen de Instagram-limiet van 2.200 tekens blijven — zowel door Claude te instrueren als door de gebruiker live feedback te geven in de editor.

**Architectuur:** Twee kleine wijzigingen. (1) Eén zin toevoegen aan de systeemprompt zodat Claude al rekening houdt met de limiet bij generatie. (2) Een live karakter-teller in de editor die de lengte van de *geselecteerde* combinatie (opener + middenstuk + afsluiter + actieve hashtags) berekent en rood kleurt boven de limiet. Geen harde blokkade — alleen visuele feedback.

**Tech Stack:** Next.js 16 App Router, TypeScript.

---

## 1. Systeemprompt (`src/lib/anthropic/caption.ts`)

Voeg één instructiezin toe aan `buildSystemPrompt`, na de taal-instructie:

```
Houd de totale caption (opener + middenstuk + afsluiter + hashtags samen) onder de 2.200 tekens.
```

Volledige nieuwe prompt:
```
Je bent een social media copywriter voor WoodyKids, een Nederlandse kinderspeelgoedwinkel.
Schrijf altijd in het Nederlands.
Houd de totale caption (opener + middenstuk + afsluiter + hashtags samen) onder de 2.200 tekens.
Volg deze richtlijnen strikt op:

{toneOfVoice}

Geef je output ALTIJD als geldig JSON in exact dit formaat, zonder extra tekst:
{"opener":{"variants":["...","...","..."]},"middle":{"variants":["...","...","..."]},"closer":{"variants":["...","...","..."]},"hashtags":["...","...","...","...","..."]}
```

---

## 2. Live karakter-teller (`src/app/grid/[postId]/page.tsx`)

### Constante
```typescript
const INSTAGRAM_CAPTION_LIMIT = 2200
```

### Berekening (inline, geen aparte utility)
```typescript
function assembledLength(caption: PostCaption): number {
  const opener = caption.opener.variants[caption.opener.selected] ?? ''
  const middle = caption.middle.variants[caption.middle.selected] ?? ''
  const closer = caption.closer.variants[caption.closer.selected] ?? ''
  const hashtags = caption.hashtags.filter(h => h.active).map(h => h.text).join(' ')
  const parts = [opener, middle, closer]
  if (hashtags) parts.push(hashtags)
  return parts.join('\n\n').length
}
```

### UI
Toon onder de `<HashtagBadges>` component, alleen als `post.caption !== null`:

```tsx
{post.caption && (() => {
  const count = assembledLength(post.caption)
  return (
    <p className={`text-xs text-right ${count > INSTAGRAM_CAPTION_LIMIT ? 'text-red-600 font-semibold' : 'text-woody-taupe'}`}>
      {count} / {INSTAGRAM_CAPTION_LIMIT} tekens
    </p>
  )
})()}
```

---

## 3. Niet in deze spec

- Harde validatie die plannen blokkeert
- Afzonderlijke limieten per platform (Instagram is de bindende constraint)
- Teller tijdens het genereren (caption is null, teller is verborgen)

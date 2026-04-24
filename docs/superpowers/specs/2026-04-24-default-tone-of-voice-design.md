# Default Tone of Voice — Design Spec

**Doel:** Vul het `tone_of_voice`-veld in de `settings`-tabel met een doordachte standaardwaarde, zodat Claude meteen bruikbare captions genereert zonder dat de gebruiker eerst iets hoeft in te stellen.

**Architectuur:** Eén Supabase-migratie die de bestaande rij (id=1) bijwerkt. Geen code-aanpassingen — de bestaande GET-route, PUT-route en generate-caption-route werken al correct met de ingevulde waarde.

---

## Standaardtekst

```
Schrijf als een enthousiaste vriendin die iets tips aan haar BFF. Warm, eerlijk, nooit neerbuigend.

Stijl:
- Informeel: gebruik 'jij', 'je', 'jou', 'we' — nooit 'u'
- Korte zinnen. Geen lappen tekst.
- Geen gedachtestreepjes (—)
- Een vleugje humor is prima, maar maak er geen standup van

Verkoop:
Vermijd harde verkooptaal: geen 'koop nu!', 'mis het niet!' of drie uitroeptekens achter elkaar. Laat het product voor zichzelf spreken — jij voegt de sfeer toe.

Inhoud:
Focus op beleving en gevoel, niet op specs. Spreek ouders aan alsof je ze kent. Een retorische vraag of een kleine glimlach in de tekst mag.

Taal:
Altijd Nederlands.
```

---

## Implementatie

**SQL-migratie:**
```sql
UPDATE settings
SET tone_of_voice = '...'  -- bovenstaande tekst
WHERE id = 1
  AND (tone_of_voice IS NULL OR tone_of_voice = '');
```

De conditie `AND (tone_of_voice IS NULL OR tone_of_voice = '')` zorgt dat een al aangepaste waarde nooit overschreven wordt.

---

## Niet in deze spec

- Reset-naar-standaard-knop in de UI (YAGNI)
- Validatie of tone_of_voice niet leeg is bij caption-generatie

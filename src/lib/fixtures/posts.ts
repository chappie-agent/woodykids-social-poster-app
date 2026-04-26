import type { Post } from '@/lib/types'

const defaultCrop = { x: 0, y: 0, scale: 1 }

const makeCaption = (
  o1: string, o2: string, o3: string,
  m1: string, m2: string, m3: string,
  c1: string, c2: string, c3: string,
  tags: string[],
) => ({
  opener: { variants: [o1, o2, o3] as [string, string, string], selected: 0 as const },
  middle: { variants: [m1, m2, m3] as [string, string, string], selected: 0 as const },
  closer: { variants: [c1, c2, c3] as [string, string, string], selected: 0 as const },
  hashtags: tags.map((text, i) => ({ text, active: i < 3 })),
})

export const fakePosts: Post[] = [
  // ── Lege slots (positions 0-2) ───────────────────────────────
  { id: 'empty-1', state: 'empty', position: 0, source: null, cropData: defaultCrop, caption: null, scheduledAt: null, isPerson: false },
  { id: 'empty-2', state: 'empty', position: 1, source: null, cropData: defaultCrop, caption: null, scheduledAt: null, isPerson: false },
  { id: 'empty-3', state: 'empty', position: 2, source: null, cropData: defaultCrop, caption: null, scheduledAt: null, isPerson: false },

  // ── Draft posts (positions 3-5) ──────────────────────────────
  {
    id: 'draft-1', state: 'draft', position: 3, isPerson: true,
    source: { kind: 'shopify', productId: 'prod-1', productTitle: 'Houten treintje set', images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600', 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600'], selectedImageIndices: [1] },
    cropData: defaultCrop,
    caption: makeCaption(
      'Dit treintje past in iedere speelkamer.', 'Sjoe, dit is een leuke.', 'Kleine ingenieur in de maak.',
      'Gemaakt van duurzaam beuken­hout, veilig geverfd.', 'Elk onderdeel past op een veilige pen.', 'Geen scherpe randjes, wel veel plezier.',
      'Bestel hem voor je het weet weg is.', 'Tip: combineer met de bouwblokken set.', 'Cadeau­tip voor kleine treinliefhebbers.',
      ['#woodykids', '#houtenspeelgoed', '#treintje', '#duurzaamspeelgoed', '#kidstoys'],
    ),
    scheduledAt: null,
  },
  {
    id: 'draft-2', state: 'draft', position: 4, isPerson: false,
    source: { kind: 'shopify', productId: 'prod-2', productTitle: 'Speelkeuken naturel', images: ['https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=600', 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=600'], selectedImageIndices: [1] },
    cropData: defaultCrop,
    caption: makeCaption(
      'De keuken van hun dromen, maar dan van hout.', 'Koken zonder gas, dat kan ook.', 'Michelin-ster in de maak.',
      'Naturel hout, geen verf, wel veel smaak.', 'Solide constructie die jaren meegaat.', 'Past naast elk interieur.',
      'Hoek kiezen en bestellen maar.', 'Tip: combineer met de accessoires set.', 'Cadeautip voor echte keukenprinsen en prinsessen.',
      ['#woodykids', '#speelkeuken', '#houtenspeelgoed', '#naturelspelen', '#kidsroom'],
    ),
    scheduledAt: null,
  },
  {
    id: 'draft-3', state: 'draft', position: 5, isPerson: true,
    source: { kind: 'shopify', productId: 'prod-4', productTitle: 'Stapeltoren regenboog', images: ['https://images.unsplash.com/photo-1551690029-b9e0e30f1e29?w=600'], selectedImageIndices: [0] },
    cropData: defaultCrop,
    caption: makeCaption(
      'Stapelen, omgooien, opnieuw. Herhaal.', 'Elke kleur is een nieuwe uitdaging.', 'Regenboog in de kinderkamer.',
      'Traint de fijne motoriek én het geduld.', 'Elk blokje is iets anders groot.', 'Gemaakt van lindehout, veilig geverfd.',
      'Welke kleur pakt jouw kind als eerste?', 'Cadeau­tip voor 1 t/m 4 jaar.', 'Tip: begin met de grote blokken.',
      ['#woodykids', '#stapeltoren', '#regenboogspelen', '#montessori', '#babyspeelgoed'],
    ),
    scheduledAt: null,
  },

  // ── Conflict post (position 6) ───────────────────────────────
  {
    id: 'conflict-1', state: 'conflict', position: 6, isPerson: true,
    source: { kind: 'shopify', productId: 'prod-3', productTitle: 'Houten bouwblokken', images: ['https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=600', 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=600'], selectedImageIndices: [1] },
    cropData: defaultCrop,
    caption: makeCaption(
      'Bouwen tot het omvalt. Dan opnieuw.', 'De klassieke bouwblokken, maar dan beter.', 'Klein, maar wat kunnen ze er wat mee.',
      'Veilig beuken­hout, geen scherpe kanten.', '42 blokken in 6 vormen.', 'Schuurpapier-glad afgewerkt.',
      'Welk bouwwerk maakt jouw kind?', 'Cadeau­tip voor 2 t/m 6 jaar.', 'Tip: bewaar ze in de houten mand.',
      ['#woodykids', '#bouwblokken', '#houtenspeelgoed', '#duurzaamspeelgoed', '#kidsplay'],
    ),
    scheduledAt: null,
  },

  // ── Locked posts (positions 7-11) ────────────────────────────
  {
    id: 'locked-1', state: 'locked', position: 7, isPerson: false,
    source: { kind: 'shopify', productId: 'prod-5', productTitle: 'Houten verfset', images: ['https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600'], selectedImageIndices: [0] },
    cropData: defaultCrop,
    caption: makeCaption(
      'Kunstenaar in de maak.', 'Kleine handen, groot talent.', 'Van hout naar kunst.',
      'Veilige verf, echte kwasten.', 'Alles zit erin om te beginnen.', 'Compact formaat voor onderweg.',
      'Welk meesterwerk schildert jouw kind?', 'Tip: doe er een schort bij.', 'Cadeau­tip voor kleine Picasso\'s.',
      ['#woodykids', '#verfset', '#kunstenaar', '#kidsart', '#houtenspeelgoed'],
    ),
    scheduledAt: '2026-04-23T10:00:00.000Z',
  },
  {
    id: 'locked-2', state: 'locked', position: 8, isPerson: true,
    source: { kind: 'shopify', productId: 'prod-6', productTitle: 'Hoepel naturel', images: ['https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600'], selectedImageIndices: [0] },
    cropData: defaultCrop,
    caption: makeCaption(
      'Weg van het scherm, met de hoepel erop.', 'Buiten spelen heeft nog nooit zo goed gevoeld.', 'De hoepel is terug.',
      'Naturel berken­hout, super licht.', 'Duurzaam en tijdloos.', 'Goed voor de coördinatie.',
      'Tij­dens de zomer onmisbaar.', 'Tip: ook leuk voor volwassenen.', 'Bestel hem voor het seizoen begint.',
      ['#woodykids', '#hoepel', '#buitenspelen', '#naturelspelen', '#duurzaamspeelgoed'],
    ),
    scheduledAt: '2026-04-22T09:00:00.000Z',
  },
  {
    id: 'locked-3', state: 'locked', position: 9, isPerson: false,
    source: { kind: 'shopify', productId: 'prod-7', productTitle: 'Grijpringen baby', images: ['https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600'], selectedImageIndices: [0] },
    cropData: defaultCrop,
    caption: makeCaption(
      'Eerste speelgoed, voor altijd bijzonder.', 'Kleine handjes, groot plezier.', 'Van dag één speelplezier.',
      'Veilig beuken­hout, spit-proof afgewerkt.', 'Elk ding heeft een andere textuur.', 'BPA-vrij en CE-gecertificeerd.',
      'Tip voor kraamcadeaus: altijd raak.', 'Bestel voor de geboorte.', 'Eerste cadeau, laatste keuze.',
      ['#woodykids', '#babyspeelgoed', '#grijpringen', '#newborn', '#houtenspeelgoed'],
    ),
    scheduledAt: '2026-04-21T11:00:00.000Z',
  },
  {
    id: 'locked-4', state: 'locked', position: 10, isPerson: true,
    source: { kind: 'shopify', productId: 'prod-8', productTitle: 'Houten puzzel dieren', images: ['https://images.unsplash.com/photo-1596460107916-430662021049?w=600'], selectedImageIndices: [0] },
    cropData: defaultCrop,
    caption: makeCaption(
      'Passen en meten, dat doet dit kind al.', 'Welk dier past waar?', 'Puzzelen als pro.',
      'Zes dieren, zes vormen, één plezier.', 'Veilig verf, stevige stukken.', 'Geschikt voor 18 maanden en ouder.',
      'Tip: benoem elk dier hardop.', 'Cadeau­tip voor peuters.', 'Bestel hem nu.',
      ['#woodykids', '#puzzel', '#houtenspeelgoed', '#peuter', '#leren'],
    ),
    scheduledAt: '2026-04-20T11:00:00.000Z',
  },
  {
    id: 'locked-5', state: 'locked', position: 11, isPerson: false,
    source: { kind: 'upload', mediaUrls: ['https://images.unsplash.com/photo-1531315396756-905d68d21b56?w=600'], mediaType: 'image', userPrompt: 'Pasen campagne, 15% korting op alles' },
    cropData: defaultCrop,
    caption: makeCaption(
      'Pasen vieren met houten speelgoed.', 'Dit jaar een ander paasei.', 'Geef iets blijvends.',
      '15% korting op alle producten deze week.', 'Gebruik code PASEN26 bij afrekenen.', 'Tot en met zondag geldig.',
      'Bestel voor zaterdag voor Pasen levering.', 'Tip: combineer twee producten.', 'Fijne Pasen van WoodyKids.',
      ['#woodykids', '#pasen', '#aanbieding', '#houtenspeelgoed', '#kidsofinstagram'],
    ),
    scheduledAt: '2026-04-19T09:00:00.000Z',
  },
]

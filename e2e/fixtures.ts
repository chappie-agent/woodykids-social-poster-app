import type { Post } from '@/lib/types'

const crop = { x: 0, y: 0, scale: 1 }

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

export const SHOPIFY_POST: Post = {
  id: 'test-shopify-1',
  state: 'draft',
  position: 0,
  isPerson: false,
  source: {
    kind: 'shopify',
    productId: 'prod-1',
    productTitle: 'Houten treintje set',
    images: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600',
      'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600',
      'https://images.unsplash.com/photo-1551690029-b9e0e30f1e29?w=600',
    ],
    selectedImageIndices: [0],
  },
  cropData: crop,
  caption: makeCaption(
    'Dit treintje past in iedere speelkamer.', 'Sjoe, dit is een leuke.', 'Kleine ingenieur in de maak.',
    'Gemaakt van duurzaam beukenhout.', 'Elk onderdeel past op een veilige pen.', 'Geen scherpe randjes.',
    'Bestel hem voor je het weet weg is.', 'Tip: combineer met de bouwblokken set.', 'Cadeautip voor kleine treinliefhebbers.',
    ['#woodykids', '#houtenspeelgoed', '#treintje', '#duurzaamspeelgoed', '#kidstoys'],
  ),
  scheduledAt: null,
}

export const UPLOAD_POST: Post = {
  id: 'test-upload-1',
  state: 'draft',
  position: 1,
  isPerson: false,
  source: {
    kind: 'upload',
    mediaUrls: ['https://images.unsplash.com/photo-1531315396756-905d68d21b56?w=600'],
    mediaType: 'image',
    userPrompt: 'Pasen sale, 20% korting',
  },
  cropData: crop,
  caption: makeCaption(
    'Pasen vieren met houten speelgoed.', 'Dit jaar een ander paasei.', 'Geef iets blijvends.',
    '20% korting op alles deze week.', 'Gebruik code PASEN26 bij afrekenen.', 'Tot en met zondag geldig.',
    'Bestel voor zaterdag voor Pasen levering.', 'Tip: combineer twee producten.', 'Fijne Pasen van WoodyKids.',
    ['#woodykids', '#pasen', '#aanbieding', '#houtenspeelgoed', '#kidsofinstagram'],
  ),
  scheduledAt: null,
}

export const EMPTY_POST: Post = {
  id: 'test-empty-1',
  state: 'empty',
  position: 2,
  isPerson: false,
  source: null,
  cropData: crop,
  caption: null,
  scheduledAt: null,
}

export const LOCKED_POST: Post = {
  id: 'test-locked-1',
  state: 'locked',
  position: 3,
  isPerson: false,
  source: {
    kind: 'shopify',
    productId: 'prod-2',
    productTitle: 'Speelkeuken naturel',
    images: ['https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=600'],
    selectedImageIndices: [0],
  },
  cropData: crop,
  caption: makeCaption(
    'De keuken van hun dromen.', 'Koken zonder gas, dat kan ook.', 'Michelin-ster in de maak.',
    'Naturel hout, geen verf.', 'Solide constructie die jaren meegaat.', 'Past naast elk interieur.',
    'Hoek kiezen en bestellen maar.', 'Tip: combineer met de accessoires set.', 'Cadeautip voor echte keukenprinsen.',
    ['#woodykids', '#speelkeuken', '#houtenspeelgoed', '#naturelspelen', '#kidsroom'],
  ),
  scheduledAt: '2026-05-01T10:00:00.000Z',
}

export const CONFLICT_POST: Post = {
  id: 'test-conflict-1',
  state: 'conflict',
  position: 4,
  isPerson: false,
  source: {
    kind: 'shopify',
    productId: 'prod-3',
    productTitle: 'Houten bouwblokken',
    images: ['https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=600'],
    selectedImageIndices: [0],
  },
  cropData: crop,
  caption: makeCaption(
    'Bouwen tot het omvalt. Dan opnieuw.', 'De klassieke bouwblokken, maar dan beter.', 'Klein, maar wat kunnen ze er wat mee.',
    'Veilig beukenhout, geen scherpe kanten.', '42 blokken in 6 vormen.', 'Schuurpapier-glad afgewerkt.',
    'Welk bouwwerk maakt jouw kind?', 'Cadeautip voor 2 t/m 6 jaar.', 'Tip: bewaar ze in de houten mand.',
    ['#woodykids', '#bouwblokken', '#houtenspeelgoed', '#duurzaamspeelgoed', '#kidsplay'],
  ),
  scheduledAt: null,
}

export const ALL_POSTS = [SHOPIFY_POST, UPLOAD_POST, EMPTY_POST, LOCKED_POST, CONFLICT_POST]

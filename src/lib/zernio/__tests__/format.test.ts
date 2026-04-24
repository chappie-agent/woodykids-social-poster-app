import { describe, it, expect } from 'vitest'
import { assembleCaption } from '../format'
import type { PostCaption } from '@/lib/types'

const caption: PostCaption = {
  opener: { variants: ['Hallo wereld', 'Goedemorgen', 'Welkom'], selected: 0 },
  middle: { variants: ['Dit is het middenstuk', 'Meer info hier', 'Bekijk het'], selected: 1 },
  closer: { variants: ['Bestel nu!', 'Shop hier!', 'Ontdek meer!'], selected: 2 },
  hashtags: [
    { text: '#kids', active: true },
    { text: '#speelgoed', active: true },
    { text: '#woodykids', active: true },
    { text: '#nl', active: false },
    { text: '#baby', active: false },
  ],
}

describe('assembleCaption', () => {
  it('joins selected variants and active hashtags with double newlines', () => {
    expect(assembleCaption(caption)).toBe(
      'Hallo wereld\n\nMeer info hier\n\nOntdek meer!\n\n#kids #speelgoed #woodykids',
    )
  })

  it('uses the selected index for each block', () => {
    const c: PostCaption = {
      ...caption,
      opener: { variants: ['A', 'B', 'C'], selected: 2 },
    }
    const result = assembleCaption(c)
    expect(result.startsWith('C\n\n')).toBe(true)
  })

  it('omits inactive hashtags', () => {
    const result = assembleCaption(caption)
    expect(result).not.toContain('#nl')
    expect(result).not.toContain('#baby')
  })

  it('omits hashtag line when all hashtags are inactive', () => {
    const c: PostCaption = {
      ...caption,
      hashtags: caption.hashtags.map(h => ({ ...h, active: false })),
    }
    expect(assembleCaption(c)).toBe('Hallo wereld\n\nMeer info hier\n\nOntdek meer!')
  })
})

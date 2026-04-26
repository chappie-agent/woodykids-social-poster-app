import { describe, it, expect } from 'vitest'
import { sortPostsForFeed, splitFeedZones } from '@/lib/grid/sorting'
import type { Post } from '@/lib/types'

const concept = (id: string): Post => ({
  id, state: 'locked' as never, position: null, source: null,
  cropData: { x: 0, y: 0, scale: 1 }, caption: null,
  scheduledAt: null, isPerson: false,
})

const planned = (id: string, when: string): Post => ({
  ...concept(id), scheduledAt: when, zernioPostId: 'z-' + id,
})

describe('splitFeedZones', () => {
  it('splits posts into concepts (no scheduledAt) and dated (with scheduledAt)', () => {
    const c1 = concept('c1')
    const p1 = planned('p1', '2030-01-01T10:00:00Z')
    const { concepts, dated } = splitFeedZones([p1, c1])
    expect(concepts).toEqual([c1])
    expect(dated).toEqual([p1])
  })
})

describe('sortPostsForFeed', () => {
  it('returns concepts first, then dated posts sorted by scheduledAt descending', () => {
    const now = new Date('2026-04-26T12:00:00Z')
    const c1 = concept('c1')
    const c2 = concept('c2')
    const future1 = planned('future1', '2030-01-01T00:00:00Z')
    const future2 = planned('future2', '2031-01-01T00:00:00Z')
    const past1 = planned('past1', '2020-01-01T00:00:00Z')

    const sorted = sortPostsForFeed([past1, future1, c1, future2, c2], now)

    expect(sorted.map(p => p.id)).toEqual(['c1', 'c2', 'future2', 'future1', 'past1'])
  })

  it('preserves the input order of concepts (no implicit sort)', () => {
    const c1 = concept('c1')
    const c2 = concept('c2')
    const c3 = concept('c3')
    const sorted = sortPostsForFeed([c2, c1, c3], new Date())
    expect(sorted.map(p => p.id)).toEqual(['c2', 'c1', 'c3'])
  })
})

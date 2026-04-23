import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useGridStore } from '../gridStore'

const makeDraft = (id: string, position: number) => ({
  id, state: 'draft' as const, position, isPerson: false,
  source: null, cropData: { x: 0, y: 0, scale: 1 }, caption: null, scheduledAt: null,
})
const makeLocked = (id: string, position: number) => ({
  ...makeDraft(id, position), state: 'locked' as const,
  scheduledAt: '2026-04-20T10:00:00.000Z',
})
const makeEmpty = (id: string, position: number) => ({
  ...makeDraft(id, position), state: 'empty' as const,
})

describe('detectConflicts', () => {
  beforeEach(() => {
    useGridStore.setState({ posts: [], conflictIds: [] })
  })

  it('marks a draft as conflict when a locked post has a lower position', () => {
    const { result } = renderHook(() => useGridStore())
    act(() => {
      result.current.setPosts([
        makeLocked('locked-1', 3),
        makeDraft('draft-1', 4),
      ])
    })
    expect(result.current.conflictIds).toContain('draft-1')
  })

  it('does not conflict when all locked posts have higher positions', () => {
    const { result } = renderHook(() => useGridStore())
    act(() => {
      result.current.setPosts([
        makeDraft('draft-1', 2),
        makeDraft('draft-2', 3),
        makeLocked('locked-1', 5),
        makeLocked('locked-2', 6),
      ])
    })
    expect(result.current.conflictIds).toHaveLength(0)
  })

  it('marks multiple drafts as conflict', () => {
    const { result } = renderHook(() => useGridStore())
    act(() => {
      result.current.setPosts([
        makeLocked('locked-1', 2),
        makeDraft('draft-1', 3),
        makeDraft('draft-2', 4),
        makeLocked('locked-2', 5),
      ])
    })
    expect(result.current.conflictIds).toContain('draft-1')
    expect(result.current.conflictIds).toContain('draft-2')
  })

  it('is idempotent — calling setPosts twice with same data keeps conflictIds stable', () => {
    const { result } = renderHook(() => useGridStore())
    const posts = [makeLocked('locked-1', 3), makeDraft('draft-1', 4)]
    act(() => { result.current.setPosts(posts) })
    const firstConflictIds = [...result.current.conflictIds]
    act(() => { result.current.setPosts(posts) })
    expect(result.current.conflictIds).toEqual(firstConflictIds)
  })

  it('empty slots are never conflicts', () => {
    const { result } = renderHook(() => useGridStore())
    act(() => {
      result.current.setPosts([
        makeLocked('locked-1', 0),
        makeEmpty('empty-1', 1),
      ])
    })
    expect(result.current.conflictIds).not.toContain('empty-1')
  })
})

describe('setOrder', () => {
  it('updates positions to match the provided id order', () => {
    const { result } = renderHook(() => useGridStore())
    act(() => {
      result.current.setPosts([makeDraft('a', 0), makeDraft('b', 1), makeDraft('c', 2)])
      result.current.setOrder(['c', 'a', 'b'])
    })
    const sorted = [...result.current.posts].sort((x, y) => x.position - y.position)
    expect(sorted.map(p => p.id)).toEqual(['c', 'a', 'b'])
  })
})

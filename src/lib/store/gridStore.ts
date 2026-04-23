import { create } from 'zustand'
import type { Post } from '@/lib/types'

type GridStore = {
  posts: Post[]
  conflictIds: string[]
  draggingId: string | null
  setPosts: (posts: Post[]) => void
  setOrder: (ids: string[]) => void
  setDragging: (id: string | null) => void
  updatePost: (id: string, patch: Partial<Post>) => void
  detectConflicts: () => void
}

export const useGridStore = create<GridStore>((set, get) => ({
  posts: [],
  conflictIds: [],
  draggingId: null,

  setPosts: (posts) => {
    set({ posts })
    get().detectConflicts()
  },

  setOrder: (ids) => {
    set(state => ({
      posts: state.posts.map(p => {
        const idx = ids.indexOf(p.id)
        return idx === -1 ? p : { ...p, position: idx }
      }),
    }))
    get().detectConflicts()
  },

  setDragging: (id) => set({ draggingId: id }),

  updatePost: (id, patch) => {
    set(state => ({
      posts: state.posts.map(p => p.id === id ? { ...p, ...patch } : p),
    }))
    get().detectConflicts()
  },

  detectConflicts: () => {
    const { posts } = get()
    const lockedPositions = posts
      .filter(p => p.state === 'locked')
      .map(p => p.position)

    if (lockedPositions.length === 0) {
      set({ conflictIds: [] })
      return
    }

    const minLockedPosition = Math.min(...lockedPositions)

    const conflictIds = posts
      .filter(p => (p.state === 'draft' || p.state === 'conflict') && p.position > minLockedPosition)
      .map(p => p.id)

    // Update state field on the posts themselves
    set(state => ({
      conflictIds,
      posts: state.posts.map(p => {
        if (p.state === 'draft' && conflictIds.includes(p.id)) return { ...p, state: 'conflict' as const }
        if (p.state === 'conflict' && !conflictIds.includes(p.id)) return { ...p, state: 'draft' as const }
        return p
      }),
    }))
  },
}))

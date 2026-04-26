import { create } from 'zustand'
import type { Post } from '@/lib/types'

type GridStore = {
  posts: Post[]
  draggingId: string | null
  setPosts: (posts: Post[]) => void
  addConcepts: (concepts: Post[]) => void
  removePost: (id: string) => void
  reorderConcepts: (orderedIds: string[]) => void
  setDragging: (id: string | null) => void
  updatePost: (id: string, patch: Partial<Post>) => void
}

export const useGridStore = create<GridStore>((set) => ({
  posts: [],
  draggingId: null,

  setPosts: (posts) => {
    const seen = new Set<string>()
    const unique = posts.filter(p => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })
    set({ posts: unique })
  },

  addConcepts: (concepts) => {
    set(state => {
      const existingIds = new Set(state.posts.map(p => p.id))
      const fresh = concepts.filter(c => !existingIds.has(c.id))
      // Concepten vooraan plaatsen — UI sorteert verder met sortPostsForFeed.
      return { posts: [...fresh, ...state.posts] }
    })
  },

  removePost: (id) => {
    set(state => ({ posts: state.posts.filter(p => p.id !== id) }))
  },

  reorderConcepts: (orderedIds) => {
    set(state => {
      const idIndex = new Map(orderedIds.map((id, i) => [id, i]))
      const concepts = state.posts.filter(p => p.scheduledAt === null)
      const dated = state.posts.filter(p => p.scheduledAt !== null)
      const reordered = [...concepts].sort((a, b) => {
        const ai = idIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER
        const bi = idIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER
        return ai - bi
      })
      return { posts: [...reordered, ...dated] }
    })
  },

  setDragging: (id) => set({ draggingId: id }),

  updatePost: (id, patch) => {
    set(state => ({
      posts: state.posts.map(p => p.id === id ? { ...p, ...patch } : p),
    }))
  },
}))

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useGridStore } from '@/lib/store/gridStore'
import { toast } from 'sonner'
import type { Post } from '@/lib/types'

export function FillButton() {
  const { posts, setPosts } = useGridStore()
  const [loading, setLoading] = useState(false)

  const draftCount = posts.filter(p => p.state === 'draft' || p.state === 'conflict').length
  const needed = Math.max(0, 9 - draftCount)

  if (needed === 0) return null

  async function handleFill() {
    setLoading(true)
    try {
      const currentPosts = useGridStore.getState().posts
      const emptyPosts = currentPosts.filter(p => p.state === 'empty')
      const startPosition = emptyPosts.length > 0
        ? Math.min(...emptyPosts.map(p => p.position))
        : Math.max(0, ...currentPosts.map(p => p.position)) + 1

      const existingProductIds = currentPosts
        .map(p => p.source?.kind === 'shopify' ? p.source.productId : null)
        .filter((id): id is string => Boolean(id))

      const res = await fetch('/api/posts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: needed, startPosition, existingProductIds }),
      })
      if (!res.ok) throw new Error('generate failed')
      const newPosts: Post[] = await res.json()

      // Re-read store to avoid stale closure
      const latestEmpties = useGridStore.getState().posts.filter(p => p.state === 'empty')
      const toFill = latestEmpties.slice(0, newPosts.length)

      // Save each generated post into an existing empty DB slot via PUT
      const saved = await Promise.all(
        newPosts.map(async (np, i) => {
          const slot = toFill[i]
          if (!slot) return np // no empty slot — post won't exist in DB, skip

          const putRes = await fetch(`/api/posts/${slot.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              state: 'draft',
              source: np.source,
              isPerson: np.isPerson,
              caption: np.caption,
            }),
          })

          if (putRes.ok) {
            return await putRes.json() as Post
          }
          // Fallback: keep slot ID so subsequent API calls find the right row
          return { ...np, id: slot.id, position: slot.position }
        })
      )

      const withoutEmpties = useGridStore.getState().posts.filter(p => p.state !== 'empty')
      setPosts([...withoutEmpties, ...saved])
      toast.success(`✨ ${saved.length} posts gegenereerd`)

      // Background: genereer captions voor alle nieuwe posts
      for (const post of saved) {
        if (!post.source) continue
        fetch(`/api/posts/${post.id}/generate-caption`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: post.source }),
        })
          .then(r => (r.ok ? r.json() : null))
          .then((updated: Partial<Post> | null) => {
            if (updated?.caption) {
              useGridStore.getState().updatePost(post.id, { caption: updated.caption })
            }
          })
          .catch(() => {})
      }
    } catch {
      toast.error('Genereren mislukt, probeer opnieuw')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleFill}
      disabled={loading}
      size="sm"
      className="bg-woody-cream hover:bg-woody-beige text-woody-bordeaux text-xs font-bold rounded-full px-3 h-7"
    >
      {loading ? '...' : `✨ Vul aan tot 9`}
    </Button>
  )
}

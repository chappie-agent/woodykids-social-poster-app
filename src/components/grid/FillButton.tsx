'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useGridStore } from '@/lib/store/gridStore'
import { toast } from 'sonner'
import type { Post } from '@/lib/types'

export function FillButton() {
  const [loading, setLoading] = useState(false)

  async function handleAdd() {
    setLoading(true)
    try {
      const currentPosts = useGridStore.getState().posts
      const existingProductIds = currentPosts
        .map(p => p.source?.kind === 'shopify' ? p.source.productId : null)
        .filter((id): id is string => Boolean(id))

      const res = await fetch('/api/posts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 9, existingProductIds }),
      })
      if (!res.ok) throw new Error('generate failed')
      const newPosts: Post[] = await res.json()

      useGridStore.getState().addConcepts(newPosts)
      toast.success(`✨ ${newPosts.length} concepten toegevoegd`)

      // Achtergrond: caption-generatie per nieuwe post
      for (const post of newPosts) {
        if (!post.source) continue
        fetch(`/api/posts/${post.id}/generate-caption`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: post.source }),
        })
          .then(r => (r.ok ? r.json() : null))
          .then((updated: { caption?: Post['caption'] } | null) => {
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
      onClick={handleAdd}
      disabled={loading}
      size="sm"
      className="bg-woody-cream hover:bg-woody-beige text-woody-bordeaux text-xs font-bold rounded-full px-3 h-7"
    >
      {loading ? '...' : `✨ Voeg 9 toe`}
    </Button>
  )
}

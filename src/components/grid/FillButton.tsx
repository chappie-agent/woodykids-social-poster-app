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
      const maxPosition = Math.max(0, ...posts.map(p => p.position))
      const emptyPosts = posts.filter(p => p.state === 'empty')
      const startPosition = emptyPosts.length > 0
        ? Math.min(...emptyPosts.map(p => p.position))
        : maxPosition + 1

      const res = await fetch('/api/posts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: needed, startPosition }),
      })
      const newPosts: Post[] = await res.json()

      // Replace empty slots with new posts, append rest
      const withoutEmpties = posts.filter(p => p.state !== 'empty')
      const toFill = emptyPosts.slice(0, newPosts.length)
      const filled = newPosts.map((np, i) => ({ ...np, position: toFill[i]?.position ?? np.position }))
      const remaining = newPosts.slice(toFill.length)

      setPosts([...withoutEmpties, ...filled, ...remaining])
      toast.success(`✨ ${newPosts.length} posts gegenereerd`)
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
      className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-full px-3 h-7"
    >
      {loading ? '...' : `✨ Vul aan tot 9`}
    </Button>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Settings } from 'lucide-react'
import { useGridStore } from '@/lib/store/gridStore'
import { PostGrid } from '@/components/grid/PostGrid'
import { FillButton } from '@/components/grid/FillButton'
import type { Post } from '@/lib/types'

export default function GridPage() {
  const { posts, setPosts } = useGridStore()
  const [loading, setLoading] = useState(posts.length === 0)

  useEffect(() => {
    if (posts.length > 0) return
    fetch('/api/posts')
      .then(r => {
        if (!r.ok) throw new Error(`posts API ${r.status}`)
        return r.json()
      })
      .then((fetched: Post[]) => {
        setPosts(fetched)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <main className="min-h-screen bg-woody-beige">
      <header className="sticky top-0 z-20 bg-woody-bordeaux">
        <div className="flex items-center justify-between px-3 py-2">
          <Image src="/woodykids-logo.png" alt="WoodyKids" width={120} height={52} className="object-contain" unoptimized priority loading="eager" />
          <div className="flex items-center gap-2">
            <FillButton />
            <Link href="/settings" className="p-1 text-woody-cream/70 hover:text-woody-cream">
              <Settings size={18} />
            </Link>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-woody-taupe text-sm">
          Laden...
        </div>
      ) : (
        <PostGrid />
      )}
    </main>
  )
}

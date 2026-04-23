'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Settings } from 'lucide-react'
import { useGridStore } from '@/lib/store/gridStore'
import { PostGrid } from '@/components/grid/PostGrid'
import { ConflictBanner } from '@/components/grid/ConflictBanner'
import { ConflictActionSheet } from '@/components/grid/ConflictActionSheet'
import { FillButton } from '@/components/grid/FillButton'
import type { Post } from '@/lib/types'

export default function GridPage() {
  const { setPosts } = useGridStore()
  const [conflictSheetOpen, setConflictSheetOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/posts')
      .then(r => r.json())
      .then((posts: Post[]) => {
        setPosts(posts)
        setLoading(false)
      })
  }, [setPosts])

  return (
    <main className="min-h-screen bg-[#FFF8F0]">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-sm border-b border-orange-100">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-base font-extrabold text-orange-900">🪵 WoodyKids</span>
          <div className="flex items-center gap-2">
            <FillButton />
            <Link href="/settings" className="p-1 text-orange-400 hover:text-orange-600">
              <Settings size={18} />
            </Link>
          </div>
        </div>
        <ConflictBanner onTap={() => setConflictSheetOpen(true)} />
      </header>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-orange-300 text-sm">
          Laden...
        </div>
      ) : (
        <PostGrid />
      )}

      <ConflictActionSheet
        open={conflictSheetOpen}
        onClose={() => setConflictSheetOpen(false)}
      />
    </main>
  )
}

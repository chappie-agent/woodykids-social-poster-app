'use client'

import { use, useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useGridStore } from '@/lib/store/gridStore'
import { PhotoCrop } from '@/components/editor/PhotoCrop'
import { PhotoSelector } from '@/components/editor/PhotoSelector'
import { CaptionBlock } from '@/components/editor/CaptionBlock'
import { HashtagBadges } from '@/components/editor/HashtagBadges'
import { ScheduleSheet } from '@/components/editor/ScheduleSheet'
import type { Post, CaptionBlock as CaptionBlockType, Hashtag, CropData } from '@/lib/types'

function EditorContent({ postId }: { postId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { posts, updatePost } = useGridStore()

  const post = posts.find(p => p.id === postId)
  const [scheduleOpen, setScheduleOpen] = useState(searchParams.get('schedule') === 'true')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!post) router.replace('/grid')
  }, [post, router])

  if (!post || !post.caption || !post.source) return null

  const imageUrl = post.source.kind === 'shopify'
    ? post.source.images[post.source.selectedImageIndex]
    : post.source.mediaUrl

  const isShopify = post.source.kind === 'shopify'
  const title = post.source.kind === 'shopify' ? post.source.productTitle : 'Eigen post'

  async function save(patch: Partial<Post>) {
    setSaving(true)
    updatePost(postId, patch)
    await fetch(`/api/posts/${postId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    setSaving(false)
  }

  async function handleSchedule(isoDateTime: string) {
    setSaving(true)
    updatePost(postId, { state: 'locked', scheduledAt: isoDateTime })
    await fetch(`/api/posts/${postId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'locked', scheduledAt: isoDateTime }),
    })
    await fetch(`/api/posts/${postId}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduledAt: isoDateTime }),
    })
    setSaving(false)
    toast.success('Ingepland voor Zernio 🎉')
    router.push('/grid')
  }

  return (
    <main className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-gray-100 sticky top-0 z-10 bg-white">
        <button onClick={() => router.push('/grid')} className="flex items-center gap-1 text-orange-500 text-sm font-semibold">
          <ChevronLeft size={18} />
          Terug
        </button>
        <span className="text-xs font-semibold text-gray-500 truncate max-w-[140px]">{title}</span>
        <button
          onClick={() => setScheduleOpen(true)}
          className="text-xs font-bold text-white bg-orange-500 px-3 py-1.5 rounded-full"
        >
          {saving ? '...' : 'Inplannen →'}
        </button>
      </header>

      {/* Photo crop */}
      <PhotoCrop
        imageUrl={imageUrl}
        cropData={post.cropData}
        onChange={(cropData: CropData) => save({ cropData })}
      />

      {/* Photo selector */}
      {isShopify && post.source.kind === 'shopify' && (
        <PhotoSelector
          images={post.source.images}
          selectedIndex={post.source.selectedImageIndex}
          onChange={(selectedImageIndex) => {
            if (post.source?.kind !== 'shopify') return
            save({ source: { ...post.source, selectedImageIndex } })
          }}
        />
      )}

      {/* Caption + hashtags */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <CaptionBlock
          label="Opener"
          block={post.caption.opener}
          onChange={(opener: CaptionBlockType) => save({ caption: { ...post.caption!, opener } })}
        />
        <CaptionBlock
          label="Middenstuk"
          block={post.caption.middle}
          onChange={(middle: CaptionBlockType) => save({ caption: { ...post.caption!, middle } })}
        />
        <CaptionBlock
          label="Afsluiter"
          block={post.caption.closer}
          onChange={(closer: CaptionBlockType) => save({ caption: { ...post.caption!, closer } })}
        />
        <HashtagBadges
          hashtags={post.caption.hashtags}
          onChange={(hashtags: Hashtag[]) => save({ caption: { ...post.caption!, hashtags } })}
        />
      </div>

      <ScheduleSheet
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onConfirm={handleSchedule}
        current={post.scheduledAt}
      />
    </main>
  )
}

export default function EditorPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = use(params)
  return (
    <Suspense>
      <EditorContent postId={postId} />
    </Suspense>
  )
}

// src/app/grid/[postId]/page.tsx
'use client'

import { use, useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useGridStore } from '@/lib/store/gridStore'
import { PhotoCrop } from '@/components/editor/PhotoCrop'
import { MultiPhotoSelector } from '@/components/editor/MultiPhotoSelector'
import { CaptionBlock } from '@/components/editor/CaptionBlock'
import { HashtagBadges } from '@/components/editor/HashtagBadges'
import { ScheduleSheet } from '@/components/editor/ScheduleSheet'
import type { Post, CaptionBlock as CaptionBlockType, Hashtag, CropData, PostCaption } from '@/lib/types'

function EditorContent({ postId }: { postId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { posts, updatePost } = useGridStore()

  const post = posts.find(p => p.id === postId)
  const [scheduleOpen, setScheduleOpen] = useState(searchParams.get('schedule') === 'true')
  const [saving, setSaving] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const INSTAGRAM_CAPTION_LIMIT = 2200

  function assembledLength(caption: PostCaption): number {
    const opener = caption.opener.variants[caption.opener.selected] ?? ''
    const middle = caption.middle.variants[caption.middle.selected] ?? ''
    const closer = caption.closer.variants[caption.closer.selected] ?? ''
    const hashtags = caption.hashtags.filter(h => h.active).map(h => h.text).join(' ')
    const parts: string[] = [opener, middle, closer]
    if (hashtags) parts.push(hashtags)
    return parts.join('\n\n').length
  }

  useEffect(() => {
    if (!post) router.replace('/grid')
  }, [post, router])

  // Poll elke 2 seconden als caption null is, stop na 15 seconden
  useEffect(() => {
    if (!post || post.caption !== null) return

    setIsGenerating(true)
    setGenerateError(null)
    const deadline = Date.now() + 15_000

    pollingRef.current = setInterval(async () => {
      if (Date.now() > deadline) {
        clearInterval(pollingRef.current!)
        setIsGenerating(false)
        setGenerateError('Caption generatie mislukt. Probeer opnieuw.')
        return
      }
      try {
        const res = await fetch(`/api/posts/${post.id}`)
        if (!res.ok) return
        const updated: Post = await res.json()
        if (updated.caption !== null) {
          clearInterval(pollingRef.current!)
          useGridStore.getState().updatePost(post.id, updated)
          setIsGenerating(false)
        }
      } catch {
        // netwerkfout, volgende tick proberen
      }
    }, 2000)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [post?.id, post?.caption === null])

  async function handleRegenerate() {
    if (!post) return
    setIsGenerating(true)
    setGenerateError(null)
    try {
      const res = await fetch(`/api/posts/${post.id}/generate-caption`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: post.source }),
      })
      if (!res.ok) throw new Error('failed')
      const updated = await res.json() as Partial<Post>
      updatePost(post.id, updated)
    } catch {
      setGenerateError('Caption generatie mislukt. Probeer opnieuw.')
    } finally {
      setIsGenerating(false)
    }
  }

  if (!post || !post.source) return null

  const imageUrl = (() => {
    if (post.source.kind === 'shopify') {
      const legacyIndex = (post.source as unknown as { selectedImageIndex?: number }).selectedImageIndex
      const coverIndex = (post.source.selectedImageIndices?.[0]) ?? legacyIndex ?? 0
      return post.source.images[coverIndex] ?? post.source.images[0]
    }
    const legacyUrl = (post.source as unknown as { mediaUrl?: string }).mediaUrl
    return post.source.mediaUrls?.[0] ?? legacyUrl ?? undefined
  })()

  const isShopify = post.source.kind === 'shopify'
  const title = post.source.kind === 'shopify' ? post.source.productTitle : 'Eigen post'

  async function save(patch: Partial<Post>) {
    setSaving(true)
    updatePost(postId, patch)
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? 'Opslaan mislukt')
      }
    } catch {
      toast.error('Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  async function handleSchedule(isoDateTime: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/posts/${postId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: isoDateTime, post }),
      })
      if (!res.ok) throw new Error('publish failed')
      const updated: Post = await res.json()
      updatePost(postId, updated)
      toast.success('Ingepland voor Zernio 🎉')
      router.push('/grid')
    } catch {
      toast.error('Inplannen mislukt. Probeer opnieuw.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-woody-cream flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-woody-taupe/20 sticky top-0 z-10 bg-woody-bordeaux">
        <button onClick={() => router.push('/grid')} className="flex items-center gap-1 text-woody-cream text-sm font-semibold">
          <ChevronLeft size={18} />
          Terug
        </button>
        <span className="text-xs font-semibold text-woody-cream/70 truncate max-w-[140px]">{title}</span>
        <button
          onClick={() => setScheduleOpen(true)}
          className="text-xs font-bold text-woody-bordeaux bg-woody-cream px-3 py-1.5 rounded-full"
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
        <MultiPhotoSelector
          images={post.source.images}
          selectedIndices={post.source.selectedImageIndices ?? [(post.source as unknown as { selectedImageIndex?: number }).selectedImageIndex ?? 0]}
          onChange={(selectedImageIndices) => {
            if (post.source?.kind !== 'shopify') return
            save({ source: { ...post.source, selectedImageIndices } })
          }}
        />
      )}

      {/* Caption + hashtags */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Regenereer knop */}
        <div className="flex flex-col gap-1">
          <button
            onClick={handleRegenerate}
            disabled={isGenerating}
            className="w-full text-xs font-semibold text-woody-bordeaux border border-woody-bordeaux/40 rounded-lg py-2 disabled:opacity-40"
          >
            {isGenerating ? 'Genereren...' : 'Regenereer caption'}
          </button>
          {generateError && (
            <p className="text-xs text-red-600 text-center">{generateError}</p>
          )}
        </div>

        {/* Caption blokken of laadstatus */}
        {isGenerating || !post.caption ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-24 bg-woody-taupe/20 rounded-xl" />
            <div className="h-24 bg-woody-taupe/20 rounded-xl" />
            <div className="h-24 bg-woody-taupe/20 rounded-xl" />
            <div className="flex gap-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-7 w-20 bg-woody-taupe/20 rounded-full" />
              ))}
            </div>
          </div>
        ) : (
          <>
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
            {(() => {
              const count = assembledLength(post.caption)
              return (
                <p className={`text-xs text-right pr-1 ${count > INSTAGRAM_CAPTION_LIMIT ? 'text-red-600 font-semibold' : 'text-woody-taupe'}`}>
                  {count} / {INSTAGRAM_CAPTION_LIMIT} tekens
                </p>
              )
            })()}
          </>
        )}
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

// src/app/grid/[postId]/page.tsx
'use client'

import { use, useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useGridStore } from '@/lib/store/gridStore'
import { PhotoCrop } from '@/components/editor/PhotoCrop'
import { MultiPhotoSelector } from '@/components/editor/MultiPhotoSelector'
import { CaptionBlock } from '@/components/editor/CaptionBlock'
import { HashtagBadges } from '@/components/editor/HashtagBadges'
import { ScheduleSheet } from '@/components/editor/ScheduleSheet'
import { isPlannedPost, isLivePost } from '@/lib/grid/sorting'
import type { Post, CaptionBlock as CaptionBlockType, Hashtag, CropData, PostCaption } from '@/lib/types'

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

function EditorContent({ postId }: { postId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { posts, updatePost, removePost, setPosts } = useGridStore()

  const post = posts.find(p => p.id === postId)
  const [scheduleOpen, setScheduleOpen] = useState(searchParams.get('schedule') === 'true')
  const [busy, setBusy] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  useEffect(() => {
    if (!post) router.replace('/grid')
  }, [post, router])

  if (!post || !post.source) return null

  const planned = isPlannedPost(post)
  const live = isLivePost(post)
  const readOnly = planned || live

  const imageUrl = (() => {
    if (post.source.kind === 'shopify') {
      const coverIndex = post.source.selectedImageIndices?.[0] ?? 0
      return post.source.images[coverIndex] ?? post.source.images[0]
    }
    return post.source.mediaUrls?.[0] ?? undefined
  })()

  const isShopify = post.source.kind === 'shopify'
  const title = post.source.kind === 'shopify' ? post.source.productTitle : 'Eigen post'

  function save(patch: Partial<Post>) {
    if (readOnly) return
    updatePost(postId, patch)
  }

  async function handleRegenerate() {
    if (!post || readOnly) return
    setIsGenerating(true)
    setGenerateError(null)
    try {
      const res = await fetch(`/api/posts/${post.id}/generate-caption`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: post.source }),
      })
      if (!res.ok) throw new Error('failed')
      const updated = await res.json() as { caption?: PostCaption }
      if (updated.caption) updatePost(post.id, { caption: updated.caption })
    } catch {
      setGenerateError('Caption generatie mislukt. Probeer opnieuw.')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleSchedule(isoDateTime: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/posts/${postId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: isoDateTime, post }),
      })
      if (!res.ok) throw new Error('publish failed')
      const created: Post = await res.json()
      // Replace concept met locked-versie in de store
      removePost(postId)
      setPosts([created, ...useGridStore.getState().posts])
      toast.success('Ingepland voor Zernio 🎉')
      router.push('/grid')
    } catch {
      toast.error('Inplannen mislukt. Probeer opnieuw.')
    } finally {
      setBusy(false)
    }
  }

  async function handleUnlock() {
    setBusy(true)
    try {
      const res = await fetch(`/api/posts/${postId}/unlock`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Unlock mislukt')
      }
      const concept: Post = await res.json()
      removePost(postId)
      setPosts([concept, ...useGridStore.getState().posts])
      toast.success('Unlocked — je kunt nu editen')
      router.replace(`/grid/${concept.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unlock mislukt')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-woody-cream flex flex-col">
      <header className="flex items-center justify-between px-3 py-2 border-b border-woody-taupe/20 sticky top-0 z-10 bg-woody-bordeaux">
        <button onClick={() => router.push('/grid')} className="flex items-center gap-1 text-woody-cream text-sm font-semibold">
          <ChevronLeft size={18} /> Terug
        </button>
        <span className="text-xs font-semibold text-woody-cream/70 truncate max-w-[140px]">{title}</span>
        {readOnly ? (
          planned ? (
            <button
              onClick={handleUnlock}
              disabled={busy}
              className="text-xs font-bold text-woody-bordeaux bg-woody-cream px-3 py-1.5 rounded-full"
            >
              {busy ? '...' : 'Unlock'}
            </button>
          ) : (
            <span className="text-xs text-woody-cream/60 px-3 py-1.5">live</span>
          )
        ) : (
          <button
            onClick={() => setScheduleOpen(true)}
            disabled={busy}
            className="text-xs font-bold text-woody-bordeaux bg-woody-cream px-3 py-1.5 rounded-full"
          >
            {busy ? '...' : 'Inplannen →'}
          </button>
        )}
      </header>

      {readOnly && (
        <div className="bg-woody-cream/80 px-3 py-2 flex items-center gap-2 text-[11px] text-woody-bordeaux border-b border-woody-taupe/20">
          <Lock size={12} />
          {live
            ? 'Deze post staat live op Instagram en kan niet meer aangepast worden.'
            : 'Deze post is ingepland. Klik Unlock om te editen — Zernio krijgt automatisch een cancel.'}
        </div>
      )}

      <PhotoCrop
        imageUrl={imageUrl}
        cropData={post.cropData}
        onChange={readOnly ? () => {} : (cropData: CropData) => save({ cropData })}
      />

      {isShopify && post.source.kind === 'shopify' && (
        <MultiPhotoSelector
          images={post.source.images}
          selectedIndices={post.source.selectedImageIndices ?? [0]}
          onChange={readOnly ? () => {} : (selectedImageIndices) => {
            if (post.source?.kind !== 'shopify') return
            save({ source: { ...post.source, selectedImageIndices } })
          }}
        />
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {!readOnly && (
          <div className="flex flex-col gap-1">
            <button
              onClick={handleRegenerate}
              disabled={isGenerating}
              className="w-full text-xs font-semibold text-woody-bordeaux border border-woody-bordeaux/40 rounded-lg py-2 disabled:opacity-40"
            >
              {isGenerating ? 'Genereren...' : 'Regenereer caption'}
            </button>
            {generateError && <p className="text-xs text-red-600 text-center">{generateError}</p>}
          </div>
        )}

        {!post.caption ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-24 bg-woody-taupe/20 rounded-xl" />
            <div className="h-24 bg-woody-taupe/20 rounded-xl" />
            <div className="h-24 bg-woody-taupe/20 rounded-xl" />
          </div>
        ) : (
          <>
            <CaptionBlock label="Opener" block={post.caption.opener} disabled={readOnly}
              onChange={(opener: CaptionBlockType) => save({ caption: { ...post.caption!, opener } })} />
            <CaptionBlock label="Middenstuk" block={post.caption.middle} disabled={readOnly}
              onChange={(middle: CaptionBlockType) => save({ caption: { ...post.caption!, middle } })} />
            <CaptionBlock label="Afsluiter" block={post.caption.closer} disabled={readOnly}
              onChange={(closer: CaptionBlockType) => save({ caption: { ...post.caption!, closer } })} />
            <HashtagBadges hashtags={post.caption.hashtags} disabled={readOnly}
              onChange={(hashtags: Hashtag[]) => save({ caption: { ...post.caption!, hashtags } })} />
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
        open={scheduleOpen && !readOnly}
        onClose={() => setScheduleOpen(false)}
        onConfirm={handleSchedule}
        current={post.scheduledAt}
      />
    </main>
  )
}

export default function EditorPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = use(params)
  return <Suspense><EditorContent postId={postId} /></Suspense>
}

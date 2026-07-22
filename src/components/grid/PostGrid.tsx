'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  DndContext, DragEndEvent, DragStartEvent,
  PointerSensor, useSensor, useSensors,
  closestCenter,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRouter } from 'next/navigation'
import { useGridStore } from '@/lib/store/gridStore'
import { PostCell } from './PostCell'
import { AddTile } from './AddTile'
import { SourcePicker } from '@/components/editor/SourcePicker'
import { ProductPicker } from '@/components/editor/ProductPicker'
import { UploadPicker } from '@/components/editor/UploadPicker'
import { sortPostsForFeed, isPlannedPost } from '@/lib/grid/sorting'
import type { Post } from '@/lib/types'

function SortableConceptCell({ post, onRepick, isRepicking }: {
  post: Post; onRepick?: () => void; isRepicking?: boolean
}) {
  const router = useRouter()
  const { draggingId } = useGridStore()
  const isDragging = draggingId === post.id

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: post.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 'auto' as const,
    touchAction: 'none' as const,
  }

  return (
    <div ref={setNodeRef} style={style} data-testid="grid-cell" data-cell-id={post.id} {...attributes} {...listeners}>
      <PostCell
        post={post}
        isDragging={isDragging}
        onTap={() => router.push(`/grid/${post.id}`)}
        onRepick={onRepick}
        isRepicking={isRepicking}
      />
    </div>
  )
}

export function PostGrid() {
  const router = useRouter()
  const { posts, reorderConcepts, setDragging, updatePost, removePost } = useGridStore()
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false)
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const [uploadPickerOpen, setUploadPickerOpen] = useState(false)
  const [repickingIds, setRepickingIds] = useState<Set<string>>(new Set())
  const [unlockingIds, setUnlockingIds] = useState<Set<string>>(new Set())
  const [firstColumn, setFirstColumn] = useState<1 | 2 | 3>(2)

  useEffect(() => {
    fetch('/api/settings/feed-first-column')
      .then(r => (r.ok ? r.json() : null))
      .then((data: { column?: number } | null) => {
        if (data?.column === 1 || data?.column === 2 || data?.column === 3) {
          setFirstColumn(data.column)
        }
      })
      .catch(() => {})
  }, [])

  // Aantal lege placeholder-cellen tussen AddTile en de eerste post:
  // firstColumn = 1 → 2 fillers (post landt op rij 2, kolom 1)
  // firstColumn = 2 → 0 fillers (post landt naast AddTile)
  // firstColumn = 3 → 1 filler  (post landt op rij 1, kolom 3)
  const fillerCount = (firstColumn + 1) % 3

  const handleRepick = useCallback(async (post: Post) => {
    setRepickingIds(prev => new Set(prev).add(post.id))
    try {
      const current = useGridStore.getState().posts
      const excludeProductIds = current
        .map(p => p.source?.kind === 'shopify' ? p.source.productId : null)
        .filter((id): id is string => Boolean(id))

      const res = await fetch('/api/posts/repick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post.id, excludeProductIds, isPerson: post.isPerson }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Repick failed')
      }
      const newPost: Post = await res.json()
      updatePost(post.id, newPost)
      toast.success('Nieuw product gekozen')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Opnieuw kiezen mislukt')
    } finally {
      setRepickingIds(prev => {
        const next = new Set(prev); next.delete(post.id); return next
      })
    }
  }, [updatePost])

  const handleUnlock = useCallback(async (post: Post) => {
    setUnlockingIds(prev => new Set(prev).add(post.id))
    try {
      const res = await fetch(`/api/posts/${post.id}/unlock`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Unlock mislukt')
      }
      const concept: Post = await res.json()
      removePost(post.id)
      useGridStore.getState().setPosts([concept, ...useGridStore.getState().posts])
      toast.success('Unlocked — je kunt nu editen')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unlock mislukt', { duration: 8000 })
    } finally {
      setUnlockingIds(prev => {
        const next = new Set(prev); next.delete(post.id); return next
      })
    }
  }, [removePost])

  const sorted = sortPostsForFeed(posts)
  const conceptIds = sorted.filter(p => p.scheduledAt === null).map(p => p.id)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragStart(event: DragStartEvent) {
    setDragging(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragging(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = conceptIds.indexOf(active.id as string)
    const newIndex = conceptIds.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(conceptIds, oldIndex, newIndex)
    reorderConcepts(reordered)
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={conceptIds} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 gap-[1px] bg-[#2a2a2a]">
            <div data-testid="grid-cell" data-cell-kind="add">
              <AddTile onTap={() => setSourcePickerOpen(true)} />
            </div>
            {Array.from({ length: fillerCount }, (_, i) => (
              <div
                key={`filler-${i}`}
                data-testid="grid-cell"
                data-cell-kind="filler"
                aria-hidden="true"
                className="aspect-[4/5] bg-woody-beige/40"
              />
            ))}
            {sorted.map(post =>
              post.scheduledAt === null ? (
                <SortableConceptCell
                  key={post.id}
                  post={post}
                  onRepick={() => handleRepick(post)}
                  isRepicking={repickingIds.has(post.id)}
                />
              ) : (
                <div key={post.id} data-testid="grid-cell" data-cell-id={post.id}>
                  <PostCell
                    post={post}
                    onTap={isPlannedPost(post) ? () => router.push(`/grid/${post.id}`) : undefined}
                    onUnlock={isPlannedPost(post) ? () => handleUnlock(post) : undefined}
                    isUnlocking={unlockingIds.has(post.id)}
                  />
                </div>
              )
            )}
          </div>
        </SortableContext>
      </DndContext>

      <SourcePicker
        open={sourcePickerOpen}
        onClose={() => setSourcePickerOpen(false)}
        onChooseProduct={() => { setSourcePickerOpen(false); setProductPickerOpen(true) }}
        onChooseUpload={() => { setSourcePickerOpen(false); setUploadPickerOpen(true) }}
      />

      <ProductPicker
        open={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        onCreated={(newPost) => {
          useGridStore.getState().addConcepts([newPost])
          setProductPickerOpen(false)
        }}
      />

      <UploadPicker
        open={uploadPickerOpen}
        onClose={() => setUploadPickerOpen(false)}
        onCreated={(newPost) => {
          useGridStore.getState().addConcepts([newPost])
          setUploadPickerOpen(false)
        }}
      />
    </>
  )
}

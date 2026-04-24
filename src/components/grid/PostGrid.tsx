'use client'

import { useRef, useState } from 'react'
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
import { SourcePicker } from '@/components/editor/SourcePicker'
import { ProductPicker } from '@/components/editor/ProductPicker'
import { UploadPicker } from '@/components/editor/UploadPicker'
import type { Post } from '@/lib/types'

function SortableCell({ post }: { post: Post }) {
  const router = useRouter()
  const { draggingId } = useGridStore()
  const isDragging = draggingId === post.id
  const prevDraggingId = useRef<string | null>(null)
  const wasDragged = useRef<boolean>(false)

  if (prevDraggingId.current === post.id && draggingId !== post.id) {
    wasDragged.current = true
  }
  prevDraggingId.current = draggingId

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: post.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 'auto' as const,
    touchAction: 'none' as const,
  }

  function handleTap() {
    if (wasDragged.current) {
      wasDragged.current = false
      return
    }
    router.push(`/grid/${post.id}`)
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <PostCell post={post} isDragging={isDragging} onTap={handleTap} />
    </div>
  )
}

export function PostGrid() {
  const { posts, setOrder, setDragging, updatePost } = useGridStore()
  const [sourcePickerPosition, setSourcePickerPosition] = useState<number | null>(null)
  const [productPickerPosition, setProductPickerPosition] = useState<number | null>(null)
  const [uploadPickerPosition, setUploadPickerPosition] = useState<number | null>(null)

  const sorted = [...posts].sort((a, b) => a.position - b.position)
  const draggable = sorted.filter(p => p.state === 'draft' || p.state === 'conflict')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  function handleDragStart(event: DragStartEvent) {
    setDragging(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragging(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = draggable.findIndex(p => p.id === active.id)
    const newIndex = draggable.findIndex(p => p.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(draggable, oldIndex, newIndex)

    let draftCursor = 0
    const merged = sorted.map(p => {
      if (p.state === 'draft' || p.state === 'conflict') return reordered[draftCursor++]
      return p
    })

    const ids = merged.map(p => p.id)
    setOrder(ids)

    fetch('/api/grid/order', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
  }

  function handleCreated(newPost: Post) {
    updatePost(newPost.id, newPost)
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={draggable.map(p => p.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 gap-[1px] bg-[#2a2a2a]">
            {sorted.map(post =>
              post.state === 'draft' || post.state === 'conflict'
                ? <SortableCell key={post.id} post={post} />
                : (
                  <div key={post.id}>
                    <PostCell
                      post={post}
                      onTap={post.state === 'empty'
                        ? () => setSourcePickerPosition(post.position)
                        : undefined}
                    />
                  </div>
                )
            )}
          </div>
        </SortableContext>
      </DndContext>

      <SourcePicker
        open={sourcePickerPosition !== null}
        onClose={() => setSourcePickerPosition(null)}
        onChooseProduct={() => {
          setProductPickerPosition(sourcePickerPosition)
          setSourcePickerPosition(null)
        }}
        onChooseUpload={() => {
          setUploadPickerPosition(sourcePickerPosition)
          setSourcePickerPosition(null)
        }}
      />

      <ProductPicker
        open={productPickerPosition !== null}
        position={productPickerPosition ?? 0}
        onClose={() => setProductPickerPosition(null)}
        onCreated={(newPost) => {
          handleCreated(newPost)
          setProductPickerPosition(null)
        }}
      />

      <UploadPicker
        open={uploadPickerPosition !== null}
        position={uploadPickerPosition ?? 0}
        onClose={() => setUploadPickerPosition(null)}
        onCreated={(newPost) => {
          handleCreated(newPost)
          setUploadPickerPosition(null)
        }}
      />
    </>
  )
}

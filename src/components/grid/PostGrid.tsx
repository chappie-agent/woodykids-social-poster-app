'use client'

import {
  DndContext, DragEndEvent, DragStartEvent,
  MouseSensor, TouchSensor, useSensor, useSensors,
  closestCenter,
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useGridStore } from '@/lib/store/gridStore'
import { PostCell } from './PostCell'
import type { Post } from '@/lib/types'

function SortableCell({ post }: { post: Post }) {
  const router = useRouter()
  const { draggingId } = useGridStore()
  const isDragging = draggingId === post.id

  const {
    attributes, listeners, setNodeRef, transform, transition,
  } = useSortable({
    id: post.id,
    disabled: post.state === 'locked' || post.state === 'empty',
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 'auto' as const,
  }

  function handleTap() {
    if (post.state === 'draft' || post.state === 'conflict') {
      router.push(`/grid/${post.id}`)
    }
  }

  return (
    <motion.div
      layout
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <PostCell post={post} isDragging={isDragging} onTap={handleTap} />
    </motion.div>
  )
}

export function PostGrid() {
  const { posts, setOrder, setDragging } = useGridStore()

  const sorted = [...posts].sort((a, b) => a.position - b.position)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 5 } }),
  )

  function handleDragStart(event: DragStartEvent) {
    setDragging(event.active.id as string)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setDragging(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sorted.findIndex(p => p.id === active.id)
    const newIndex = sorted.findIndex(p => p.id === over.id)

    // Locked posts are not moveable — but drafts can be inserted around them
    const overPost = sorted[newIndex]
    if (overPost.state === 'locked' || overPost.state === 'empty') return

    const newOrder = [...sorted]
    const [moved] = newOrder.splice(oldIndex, 1)
    newOrder.splice(newIndex, 0, moved)

    const ids = newOrder.map(p => p.id)
    setOrder(ids)

    // Persist order to API (fire and forget in MVP)
    fetch('/api/grid/order', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={sorted.map(p => p.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-3 gap-[3px] p-[3px]">
          <AnimatePresence>
            {sorted.map(post => (
              <SortableCell key={post.id} post={post} />
            ))}
          </AnimatePresence>
        </div>
      </SortableContext>
    </DndContext>
  )
}

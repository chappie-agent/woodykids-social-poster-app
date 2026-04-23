'use client'

import { useRef } from 'react'
import { motion, useMotionValue } from 'framer-motion'
import { useGesture } from '@use-gesture/react'
import type { CropData } from '@/lib/types'

type Props = {
  imageUrl: string
  cropData: CropData
  onChange: (crop: CropData) => void
}

export function PhotoCrop({ imageUrl, cropData, onChange }: Props) {
  const x = useMotionValue(cropData.x)
  const y = useMotionValue(cropData.y)
  const scale = useMotionValue(cropData.scale)
  const containerRef = useRef<HTMLDivElement>(null)

  // When `target` is provided, useGesture binds directly to the ref and returns void.
  // We use the ref-free form (no target) so bind() returns spreadable event handlers.
  const bind = useGesture(
    {
      onDrag: ({ offset: [ox, oy] }) => {
        x.set(ox)
        y.set(oy)
      },
      onDragEnd: () => {
        onChange({ x: x.get(), y: y.get(), scale: scale.get() })
      },
      onPinch: ({ offset: [s] }) => {
        const clamped = Math.max(1, Math.min(4, s))
        scale.set(clamped)
      },
      onPinchEnd: () => {
        onChange({ x: x.get(), y: y.get(), scale: scale.get() })
      },
    },
    {
      drag: {
        from: () => [x.get(), y.get()] as [number, number],
      },
      pinch: {
        scaleBounds: { min: 1, max: 4 },
        from: () => [scale.get(), 0] as [number, number],
      },
    },
  )

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden bg-black"
      style={{ aspectRatio: '4/5', touchAction: 'none' }}
      {...bind()}
    >
      <motion.img
        src={imageUrl}
        alt="Crop preview"
        className="w-full h-full object-cover"
        style={{ x, y, scale }}
        draggable={false}
      />
    </div>
  )
}

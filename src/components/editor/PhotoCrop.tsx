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
  const sliderRef = useRef<HTMLInputElement>(null)

  const clampScale = (s: number) => Math.max(1, Math.min(4, s))

  const setScale = (s: number) => {
    scale.set(s)
    if (sliderRef.current) sliderRef.current.value = String(s)
  }

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
        setScale(clampScale(s))
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
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        className="w-full overflow-hidden bg-black cursor-grab active:cursor-grabbing select-none"
        style={{ aspectRatio: '4/5', touchAction: 'pan-x pan-y' }}
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
      <div className="flex items-center gap-3 px-1">
        <button
          type="button"
          className="text-lg leading-none text-muted-foreground hover:text-foreground w-5 text-center"
          onClick={() => {
            const next = clampScale(scale.get() - 0.1)
            setScale(next)
            onChange({ x: x.get(), y: y.get(), scale: next })
          }}
        >
          −
        </button>
        <input
          ref={sliderRef}
          type="range"
          min="1"
          max="4"
          step="0.01"
          defaultValue={cropData.scale}
          className="flex-1 accent-primary h-1"
          onChange={(e) => {
            const val = parseFloat(e.target.value)
            scale.set(val)
            onChange({ x: x.get(), y: y.get(), scale: val })
          }}
        />
        <button
          type="button"
          className="text-lg leading-none text-muted-foreground hover:text-foreground w-5 text-center"
          onClick={() => {
            const next = clampScale(scale.get() + 0.1)
            setScale(next)
            onChange({ x: x.get(), y: y.get(), scale: next })
          }}
        >
          +
        </button>
      </div>
    </div>
  )
}

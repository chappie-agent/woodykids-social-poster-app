'use client'

import { useRef, useEffect } from 'react'
import { motion, useMotionValue } from 'framer-motion'
import { useGesture } from '@use-gesture/react'
import type { CropData } from '@/lib/types'

type Props = {
  imageUrl: string
  cropData: CropData
  onChange: (crop: CropData) => void
}

export function PhotoCrop({ imageUrl, cropData, onChange }: Props) {
  // Motion values are in pixels for smooth animation; cropData x/y are fractions (0..1)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const scale = useMotionValue(cropData.scale)
  const containerRef = useRef<HTMLDivElement>(null)
  const sliderRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    x.set(cropData.x * width)
    y.set(cropData.y * height)
  }, [])

  const clampScale = (s: number) => Math.max(1, Math.min(4, s))

  const setScale = (s: number) => {
    scale.set(s)
    if (sliderRef.current) sliderRef.current.value = String(s)
  }

  function saveCrop(overrideScale?: number) {
    const el = containerRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    onChange({
      x: x.get() / width,
      y: y.get() / height,
      scale: overrideScale ?? scale.get(),
    })
  }

  const bind = useGesture(
    {
      onDrag: ({ offset: [ox, oy] }) => {
        x.set(ox)
        y.set(oy)
      },
      onDragEnd: () => saveCrop(),
      onPinch: ({ offset: [s] }) => {
        setScale(clampScale(s))
      },
      onPinchEnd: () => saveCrop(),
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
      <div className="flex items-center gap-3 px-1">
        <button
          type="button"
          className="text-lg leading-none text-muted-foreground hover:text-foreground w-5 text-center"
          onClick={() => {
            const next = clampScale(scale.get() - 0.1)
            setScale(next)
            saveCrop(next)
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
            saveCrop(val)
          }}
        />
        <button
          type="button"
          className="text-lg leading-none text-muted-foreground hover:text-foreground w-5 text-center"
          onClick={() => {
            const next = clampScale(scale.get() + 0.1)
            setScale(next)
            saveCrop(next)
          }}
        >
          +
        </button>
      </div>
    </div>
  )
}

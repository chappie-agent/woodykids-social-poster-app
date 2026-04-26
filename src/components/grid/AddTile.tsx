'use client'

import { Plus } from 'lucide-react'

type Props = {
  onTap: () => void
}

export function AddTile({ onTap }: Props) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label="Voeg een post toe"
      className="aspect-[4/5] w-full bg-woody-beige/60 border-[1.5px] border-dashed border-woody-taupe/50 hover:border-woody-bordeaux hover:bg-woody-beige transition-colors flex flex-col items-center justify-center gap-1 cursor-pointer"
    >
      <Plus className="w-6 h-6 text-woody-taupe" strokeWidth={2} />
      <span className="text-[9px] font-bold text-woody-taupe uppercase tracking-wider">Voeg toe</span>
    </button>
  )
}

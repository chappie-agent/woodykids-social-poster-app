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
      className="aspect-[4/5] w-full bg-woody-beige border-[1.5px] border-dashed border-woody-bordeaux/60 hover:border-woody-bordeaux hover:bg-woody-cream transition-colors flex flex-col items-center justify-center gap-1.5 cursor-pointer"
    >
      <Plus className="w-7 h-7 text-woody-bordeaux" strokeWidth={2.5} />
      <span className="text-xs font-bold text-woody-bordeaux uppercase tracking-wider">Voeg toe</span>
    </button>
  )
}

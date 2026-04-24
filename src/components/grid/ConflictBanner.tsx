'use client'

import { useGridStore } from '@/lib/store/gridStore'

type Props = { onTap: () => void }

export function ConflictBanner({ onTap }: Props) {
  const { posts, conflictIds } = useGridStore()
  if (conflictIds.length === 0) return null

  const conflictTitles = posts
    .filter(p => conflictIds.includes(p.id))
    .map(p => p.source?.kind === 'shopify' ? p.source.productTitle : 'Eigen post')
    .join(', ')

  return (
    <button
      onClick={onTap}
      className="w-full flex items-start gap-2 px-3 py-2 bg-woody-taupe/20 border-b border-woody-taupe/30 text-left"
    >
      <span className="text-sm mt-0.5 flex-shrink-0">⚠️</span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-woody-bordeaux">
          {conflictIds.length === 1 ? '1 post dreigt te laat' : `${conflictIds.length} posts dreigen te laat`}
        </p>
        <p className="text-[10px] text-woody-brown/70 truncate">{conflictTitles}</p>
      </div>
      <span className="text-woody-bordeaux text-sm flex-shrink-0">›</span>
    </button>
  )
}

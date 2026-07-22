import type { Post } from '@/lib/types'
import { isLivePost, isPlannedPost } from '@/lib/grid/sorting'

type Props = {
  post: Post
  isDragging?: boolean
  onTap?: () => void
  onRepick?: () => void
  isRepicking?: boolean
  onUnlock?: () => void
  isUnlocking?: boolean
}

function getImageUrl(post: Post): string | null {
  if (!post.source) return null
  if (post.source.kind === 'shopify') {
    const coverIndex = post.source.selectedImageIndices?.[0] ?? 0
    return post.source.images[coverIndex] ?? post.source.images[0]
  }
  return post.source.mediaUrls?.[0] ?? null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function PostCell({ post, isDragging, onTap, onRepick, isRepicking, onUnlock, isUnlocking }: Props) {
  const imageUrl = getImageUrl(post)
  const isConcept = post.scheduledAt === null
  const isLive = isLivePost(post)
  const isPlanned = isPlannedPost(post)

  return (
    <div
      className={[
        'aspect-[4/5] relative overflow-hidden select-none',
        post.isPerson ? 'bg-woody-taupe/50' : 'bg-woody-taupe/70',
        isDragging ? 'opacity-40' : '',
        isConcept ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
        isLive ? 'opacity-95' : '',
      ].join(' ')}
      onClick={isConcept || isPlanned ? onTap : undefined}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt={post.source?.kind === 'shopify' ? post.source.productTitle : 'Eigen upload'}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            transform: `translate(${post.cropData.x * 100}%, ${post.cropData.y * 100}%) scale(${post.cropData.scale})`,
            transformOrigin: 'center',
          }}
          draggable={false}
        />
      )}

      {imageUrl && <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/40" />}

      {/* Re-pick (alleen voor concepten op shopify) */}
      {onRepick && isConcept && post.source?.kind === 'shopify' && (
        <button
          type="button"
          aria-label="Ander product kiezen"
          disabled={isRepicking}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onRepick() }}
          className="absolute top-1 right-1 z-20 w-6 h-6 rounded-full bg-black/55 hover:bg-black/75 text-white flex items-center justify-center shadow-md backdrop-blur-sm cursor-pointer"
        >
          {isRepicking ? (
            <span className="block w-3 h-3 border-[1.5px] border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
              <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M3 21v-5h5" />
            </svg>
          )}
        </button>
      )}

      {/* Concept badge */}
      {isConcept && (
        <div className="absolute top-1 left-1 bg-woody-bordeaux/85 rounded-[3px] px-1 py-0.5 text-[7px] font-bold text-woody-cream">
          concept
        </div>
      )}

      {/* Planned: lock icon + date + unlock-knop */}
      {isPlanned && (
        <>
          <div className="absolute top-1 right-1 text-[11px] leading-none">🔒</div>
          {onUnlock && (
            <button
              type="button"
              aria-label="Unlock om te editen"
              disabled={isUnlocking}
              onClick={(e) => { e.stopPropagation(); onUnlock() }}
              className="absolute top-1 left-1 z-20 bg-woody-cream/95 hover:bg-woody-cream rounded-[3px] px-1.5 py-0.5 text-[8px] font-bold text-woody-bordeaux shadow cursor-pointer disabled:opacity-50"
            >
              {isUnlocking ? '...' : 'Unlock'}
            </button>
          )}
          {post.scheduledAt && (
            <div className="absolute bottom-1 left-1 right-1 bg-woody-cream/90 rounded-[3px] px-1 py-0.5 text-[7px] font-bold text-woody-bordeaux text-center truncate">
              {formatDate(post.scheduledAt)}
            </div>
          )}
        </>
      )}

      {/* Live: gepubliceerd-badge */}
      {isLive && (
        <>
          <div className="absolute top-1 right-1 text-[11px] leading-none">✓</div>
          {post.scheduledAt && (
            <div className="absolute bottom-1 left-1 right-1 bg-black/60 rounded-[3px] px-1 py-0.5 text-[7px] font-bold text-white text-center truncate">
              live · {formatDate(post.scheduledAt)}
            </div>
          )}
        </>
      )}

      {!imageUrl && post.source?.kind === 'shopify' && (
        <div className="absolute bottom-1 left-1 right-1 bg-white/60 rounded-[3px] px-1 py-0.5 text-[7px] font-bold text-center truncate">
          {post.source.productTitle}
        </div>
      )}
    </div>
  )
}

import type { Post } from '@/lib/types'

type Props = {
  post: Post
  isDragging?: boolean
  onTap?: () => void
  onRepick?: () => void
  isRepicking?: boolean
}

function getImageUrl(post: Post): string | null {
  if (!post.source) return null
  if (post.source.kind === 'shopify') {
    const legacyIndex = (post.source as unknown as { selectedImageIndex?: number }).selectedImageIndex
    const coverIndex = (post.source.selectedImageIndices?.[0]) ?? legacyIndex ?? 0
    return post.source.images[coverIndex] ?? post.source.images[0]
  }
  const legacyUrl = (post.source as unknown as { mediaUrl?: string }).mediaUrl
  return post.source.mediaUrls?.[0] ?? legacyUrl ?? null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function PostCell({ post, isDragging, onTap, onRepick, isRepicking }: Props) {
  const imageUrl = getImageUrl(post)

  if (post.state === 'empty') {
    return (
      <div className="aspect-[4/5] border-[1.5px] border-dashed border-woody-taupe/50 bg-woody-beige flex items-center justify-center">
        <span className="text-[9px] font-bold text-woody-taupe uppercase tracking-wider">leeg</span>
      </div>
    )
  }

  const isConflict = post.state === 'conflict'
  const isLocked = post.state === 'locked'

  return (
    <div
      className={[
        'aspect-[4/5] relative overflow-hidden select-none',
        isLocked ? (post.isPerson ? 'bg-woody-mint/80' : 'bg-woody-mint') : (post.isPerson ? 'bg-woody-taupe/50' : 'bg-woody-taupe/70'),
        isConflict ? 'ring-[2.5px] ring-woody-bordeaux ring-offset-0' : '',
        isDragging ? 'opacity-40' : '',
        !isLocked ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed',
      ].join(' ')}
      onClick={onTap}
    >
      {/* Background image with crop applied */}
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

      {/* Overlay gradient for readability */}
      {imageUrl && <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/40" />}

      {/* Conflict pulse ring — CSS animation via Tailwind arbitrary */}
      {isConflict && (
        <span className="absolute inset-[-3px] rounded-[7px] border-[2.5px] border-woody-bordeaux animate-pulse pointer-events-none" />
      )}

      {/* ! badge for conflict */}
      {isConflict && (
        <div className="absolute top-[-5px] left-[-5px] z-10 w-4 h-4 rounded-full bg-woody-bordeaux flex items-center justify-center shadow">
          <span className="text-[9px] font-black text-white">!</span>
        </div>
      )}

      {/* Re-pick button — overlay above drag layer */}
      {onRepick && (post.state === 'draft' || post.state === 'conflict') && post.source?.kind === 'shopify' && (
        <button
          type="button"
          aria-label="Ander product kiezen"
          title="Ander product kiezen"
          disabled={isRepicking}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onRepick()
          }}
          className="absolute top-1 right-1 z-20 w-6 h-6 rounded-full bg-black/55 hover:bg-black/75 text-white flex items-center justify-center shadow-md backdrop-blur-sm disabled:opacity-60 disabled:cursor-wait cursor-pointer transition-colors"
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

      {/* Spinner overlay while repicking */}
      {isRepicking && (
        <div className="absolute inset-0 bg-black/30 z-10 pointer-events-none" />
      )}

      {/* Draft chip */}
      {(post.state === 'draft' || post.state === 'conflict') && (
        <div className="absolute top-1 left-1 bg-woody-bordeaux/85 rounded-[3px] px-1 py-0.5 text-[7px] font-bold text-woody-cream">
          concept
        </div>
      )}

      {/* Lock icon for locked */}
      {isLocked && (
        <div className="absolute top-1 right-1 text-[11px] leading-none">🔒</div>
      )}

      {/* Date badge for locked */}
      {isLocked && post.scheduledAt && (
        <div className="absolute bottom-1 left-1 right-1 bg-woody-cream/90 rounded-[3px] px-1 py-0.5 text-[7px] font-bold text-woody-bordeaux text-center truncate">
          {formatDate(post.scheduledAt)}
        </div>
      )}

      {/* Product title for draft (no image) */}
      {!imageUrl && post.source?.kind === 'shopify' && (
        <div className="absolute bottom-1 left-1 right-1 bg-white/60 rounded-[3px] px-1 py-0.5 text-[7px] font-bold text-center truncate">
          {post.source.productTitle}
        </div>
      )}
    </div>
  )
}

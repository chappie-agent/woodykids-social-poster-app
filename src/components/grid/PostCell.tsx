import type { Post } from '@/lib/types'

type Props = {
  post: Post
  isDragging?: boolean
  onTap?: () => void
}

function getImageUrl(post: Post): string | null {
  if (!post.source) return null
  if (post.source.kind === 'shopify') return post.source.images[post.source.selectedImageIndex] ?? post.source.images[0]
  return post.source.mediaUrl
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function PostCell({ post, isDragging, onTap }: Props) {
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

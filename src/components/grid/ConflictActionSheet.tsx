'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useGridStore } from '@/lib/store/gridStore'
import { useRouter } from 'next/navigation'

type Props = {
  open: boolean
  onClose: () => void
}

export function ConflictActionSheet({ open, onClose }: Props) {
  const { posts, conflictIds, setOrder } = useGridStore()
  const router = useRouter()

  const conflictPost = posts.find(p => conflictIds.includes(p.id))
  const title = conflictPost?.source?.kind === 'shopify'
    ? conflictPost.source.productTitle
    : 'Eigen post'

  function handleScheduleNow() {
    onClose()
    if (conflictPost) router.push(`/grid/${conflictPost.id}?schedule=true`)
  }

  function handleMoveUp() {
    if (!conflictPost) return
    // Move conflict post to just before the first locked post
    const byPosition = [...posts].sort((a, b) => a.position - b.position)
    const firstLockedIdx = byPosition.findIndex(p => p.state === 'locked')
    if (firstLockedIdx === -1) return
    const withoutConflict = byPosition.filter(p => p.id !== conflictPost.id)
    withoutConflict.splice(firstLockedIdx, 0, conflictPost)
    setOrder(withoutConflict.map(p => p.id))
    fetch('/api/grid/order', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: withoutConflict.map(p => p.id) }),
    })
    onClose()
  }

  async function handleAutoRemove() {
    if (!conflictPost) return
    await fetch(`/api/posts/${conflictPost.id}`, { method: 'DELETE' })
    const remaining = posts.filter(p => p.id !== conflictPost.id)
    const ids = [...remaining].sort((a, b) => a.position - b.position).map(p => p.id)
    setOrder(ids)
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-left text-sm">⚠️ Post staat ingeklemd</SheetTitle>
          <p className="text-[11px] text-muted-foreground text-left">
            &ldquo;{title}&rdquo; is omringd door al-gepubliceerde posts maar staat zelf nog niet ingepland.
          </p>
        </SheetHeader>
        <div className="space-y-2">
          <ActionRow icon="📅" title="Nu inplannen" desc="Kies datum & tijd in de editor." onTap={handleScheduleNow} />
          <ActionRow icon="↕️" title="Verplaatsen naar het heden" desc="Schuif de post boven de geplande posts." onTap={handleMoveUp} />
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 flex gap-3">
            <span className="text-base flex-shrink-0 mt-0.5">🕐</span>
            <div>
              <p className="text-[11px] font-bold text-gray-500">Niets doen = automatisch verwijderd</p>
              <p className="text-[10px] text-gray-400 leading-relaxed mt-0.5">
                Sluit je deze melding zonder keuze, dan verdwijnt de post uit het grid zodra er een nieuwe geplande post bijkomt.
              </p>
            </div>
          </div>
          <button
            onClick={handleAutoRemove}
            className="w-full text-[11px] text-gray-400 py-2 hover:text-gray-600"
          >
            Nu verwijderen
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ActionRow({ icon, title, desc, onTap }: { icon: string; title: string; desc: string; onTap: () => void }) {
  return (
    <button onClick={onTap} className="w-full flex gap-3 items-start p-3 rounded-xl border border-gray-200 text-left hover:bg-gray-50 active:bg-gray-100">
      <span className="text-lg flex-shrink-0">{icon}</span>
      <div>
        <p className="text-[11px] font-bold text-gray-900">{title}</p>
        <p className="text-[10px] text-gray-500">{desc}</p>
      </div>
    </button>
  )
}

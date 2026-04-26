'use client'

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useGridStore } from '@/lib/store/gridStore'
import type { Post, ShopifyProduct, ShopifyCollection } from '@/lib/types'

type Props = {
  open: boolean
  onClose: () => void
  onCreated: (post: Post) => void
}

export function ProductPicker({ open, onClose, onCreated }: Props) {
  const [products, setProducts] = useState<ShopifyProduct[]>([])
  const [collections, setCollections] = useState<ShopifyCollection[]>([])
  const [search, setSearch] = useState('')
  const [collectionId, setCollectionId] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSearch('')
    setCollectionId('')
    setLoading(true)
    setLoadError(null)
    Promise.all([
      fetch('/api/products').then(r => r.json()),
      fetch('/api/collections').then(r => r.json()),
    ]).then(([prods, cols]: [ShopifyProduct[], ShopifyCollection[]]) => {
      setProducts(prods)
      setCollections(cols)
      setLoading(false)
    }).catch(() => {
      setLoadError('Producten laden mislukt. Probeer opnieuw.')
      setLoading(false)
    })
  }, [open])

  const filtered = products.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase())
    const matchesCollection = !collectionId || p.collectionIds.includes(collectionId)
    return matchesSearch && matchesCollection
  })

  async function handleSelect(product: ShopifyProduct) {
    setCreating(true)
    setCreateError(null)
    try {
      if (product.images.length === 0) throw new Error('Product heeft geen afbeeldingen')
      const source = {
        kind: 'shopify' as const,
        productId: product.id,
        productTitle: product.title,
        images: product.images,
        variants: product.variants,
        selectedImageIndices: [Math.min(1, product.images.length - 1)],
      }
      const post: Post = {
        id: crypto.randomUUID(),
        state: 'locked',
        position: null,
        source,
        cropData: { x: 0, y: 0, scale: 1 },
        caption: null,
        scheduledAt: null,
        isPerson: false,
      }
      onCreated(post)
      // Fire-and-forget: caption genereert op de achtergrond
      fetch(`/api/posts/${post.id}/generate-caption`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      })
        .then(r => (r.ok ? r.json() : null))
        .then((updated: { caption?: Post['caption'] } | null) => {
          if (updated?.caption) {
            useGridStore.getState().updatePost(post.id, { caption: updated.caption })
          }
        })
        .catch(() => {})
      onClose()
    } catch {
      setCreateError('Toevoegen mislukt. Probeer opnieuw.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8 flex flex-col" style={{ height: '80vh' }}>
        <SheetHeader className="mb-3 shrink-0">
          <SheetTitle className="text-sm text-left">Product kiezen</SheetTitle>
        </SheetHeader>

        <div className="flex gap-2 mb-3 shrink-0">
          <input
            type="search"
            placeholder="Zoeken..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 border border-woody-taupe/40 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-woody-bordeaux/30"
          />
          <select
            value={collectionId}
            onChange={e => setCollectionId(e.target.value)}
            className="border border-woody-taupe/40 rounded-lg px-2 py-1.5 text-sm focus:outline-none"
          >
            <option value="">Alle collecties</option>
            {collections.map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>

        {createError && (
          <p className="text-xs text-red-600 mb-2 shrink-0">{createError}</p>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-center text-sm text-gray-400 mt-8">Laden...</p>
          ) : loadError ? (
            <p className="text-center text-sm text-red-500 mt-8">{loadError}</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 mt-8">Geen producten gevonden</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {filtered.map(product => (
                <button
                  key={product.id}
                  onClick={() => handleSelect(product)}
                  disabled={creating}
                  className="text-left rounded-lg overflow-hidden border border-gray-100 active:opacity-60 disabled:opacity-40"
                >
                  {product.images[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.title}
                      className="w-full aspect-square object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-woody-beige" />
                  )}
                  <div className="p-1.5">
                    <p className="text-[10px] font-semibold text-gray-800 leading-tight line-clamp-2">
                      {product.title}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

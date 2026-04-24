'use client'

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { Post, ShopifyProduct, ShopifyCollection } from '@/lib/types'

type Props = {
  open: boolean
  position: number
  onClose: () => void
  onCreated: (post: Post) => void
}

export function ProductPicker({ open, position, onClose, onCreated }: Props) {
  const [products, setProducts] = useState<ShopifyProduct[]>([])
  const [collections, setCollections] = useState<ShopifyCollection[]>([])
  const [search, setSearch] = useState('')
  const [collectionId, setCollectionId] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!open) return
    setSearch('')
    setCollectionId('')
    setLoading(true)
    Promise.all([
      fetch('/api/products').then(r => r.json()),
      fetch('/api/collections').then(r => r.json()),
    ]).then(([prods, cols]: [ShopifyProduct[], ShopifyCollection[]]) => {
      setProducts(prods)
      setCollections(cols)
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
    const res = await fetch('/api/posts/create-product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: product.id, position }),
    })
    const post = await res.json() as Post
    setCreating(false)
    onCreated(post)
    onClose()
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

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-center text-sm text-gray-400 mt-8">Laden...</p>
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

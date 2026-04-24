'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

type Props = {
  open: boolean
  onClose: () => void
  onChooseProduct: () => void
  onChooseUpload: () => void
}

export function SourcePicker({ open, onClose, onChooseProduct, onChooseUpload }: Props) {
  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="mb-4 shrink-0">
          <SheetTitle className="text-sm text-left">Wat wil je toevoegen?</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => { onClose(); onChooseProduct() }}
            className="w-full text-left px-4 py-4 rounded-xl border border-woody-taupe/30 bg-woody-beige text-sm font-semibold text-woody-brown"
          >
            <span aria-hidden="true">🛍 </span>Shopify product
          </button>
          <button
            type="button"
            onClick={() => { onClose(); onChooseUpload() }}
            className="w-full text-left px-4 py-4 rounded-xl border border-woody-taupe/30 bg-woody-beige text-sm font-semibold text-woody-brown"
          >
            <span aria-hidden="true">📷 </span>Eigen foto of video
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

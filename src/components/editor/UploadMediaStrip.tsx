'use client'

import { useRef, useState } from 'react'
import { X, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const MAX_PHOTOS = 10

type Props = {
  mediaUrls: string[]
  disabled?: boolean
  onChange: (urls: string[]) => void
}

/**
 * Carousel-strip voor upload-posts (analoog aan MultiPhotoSelector voor Shopify).
 *
 * - Klik op een thumbnail → wordt cover (eerste in de array).
 * - × verwijdert een thumbnail.
 * - + opent file-picker, upload naar Supabase storage en append.
 *
 * In `disabled`-modus (locked posts): alleen visueel, geen acties.
 */
export function UploadMediaStrip({ mediaUrls, disabled, onChange }: Props) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const atLimit = mediaUrls.length >= MAX_PHOTOS

  function setCover(i: number) {
    if (disabled || i === 0) return
    const next = [...mediaUrls]
    const [item] = next.splice(i, 1)
    next.unshift(item)
    onChange(next)
  }

  function remove(i: number) {
    if (disabled || mediaUrls.length <= 1) return
    onChange(mediaUrls.filter((_, idx) => idx !== i))
  }

  async function handleAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setUploading(true)
    try {
      const supabase = createClient()
      const remaining = MAX_PHOTOS - mediaUrls.length
      const toUpload = files.slice(0, remaining)
      const uploaded = await Promise.all(
        toUpload.map(async (file) => {
          const ext = file.name.split('.').pop() ?? 'bin'
          const path = `${crypto.randomUUID()}.${ext}`
          const { error: upErr } = await supabase.storage.from('post-media').upload(path, file)
          if (upErr) throw upErr
          return supabase.storage.from('post-media').getPublicUrl(path).data.publicUrl
        }),
      )
      onChange([...mediaUrls, ...uploaded])
    } catch {
      // stille fallback — UI laat geen extra item zien als upload faalde
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex gap-2 px-3 py-2 w-max">
        {mediaUrls.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className={[
              'relative flex-shrink-0 w-12 h-16 rounded overflow-hidden border-2 transition-all',
              i === 0 ? 'border-woody-bordeaux opacity-100' : 'border-transparent opacity-70',
            ].join(' ')}
          >
            <button
              type="button"
              onClick={() => setCover(i)}
              disabled={disabled}
              className="absolute inset-0 w-full h-full"
              aria-label={i === 0 ? 'Cover' : 'Maak cover'}
            >
              <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
            </button>
            {i === 0 && (
              <span className="absolute top-0.5 left-0.5 bg-woody-bordeaux text-woody-cream text-[8px] font-bold px-1 rounded">
                cover
              </span>
            )}
            {!disabled && mediaUrls.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Verwijder foto"
                className="absolute top-0.5 right-0.5 bg-black/60 hover:bg-black/80 text-white rounded-full w-4 h-4 flex items-center justify-center"
              >
                <X size={10} strokeWidth={3} />
              </button>
            )}
          </div>
        ))}

        {!disabled && !atLimit && (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex-shrink-0 w-12 h-16 rounded border-2 border-dashed border-woody-taupe/50 hover:border-woody-bordeaux text-woody-taupe hover:text-woody-bordeaux flex items-center justify-center disabled:opacity-50"
              aria-label="Voeg foto toe"
            >
              {uploading ? (
                <span className="block w-3 h-3 border-[1.5px] border-woody-taupe border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus size={16} />
              )}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleAdd}
            />
          </>
        )}
      </div>
    </div>
  )
}

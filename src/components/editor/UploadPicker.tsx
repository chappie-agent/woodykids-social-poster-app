'use client'

import { useState, useRef } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { createClient } from '@/lib/supabase/client'
import type { Post } from '@/lib/types'

type Props = {
  open: boolean
  position: number
  onClose: () => void
  onCreated: (post: Post) => void
}

export function UploadPicker({ open, position, onClose, onCreated }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [userPrompt, setUserPrompt] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setError(null)
    setPreview(URL.createObjectURL(f))
  }

  function reset() {
    setFile(null)
    setPreview(null)
    setUserPrompt('')
    setError(null)
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleAdd() {
    if (!file) return
    setUploading(true)
    setError(null)

    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() ?? 'bin'
      const path = `${crypto.randomUUID()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('post-media')
        .upload(path, file)
      if (uploadError) throw new Error(uploadError.message)

      const { data: { publicUrl } } = supabase.storage
        .from('post-media')
        .getPublicUrl(path)

      const mediaType: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image'

      const res = await fetch('/api/posts/create-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaUrl: publicUrl, mediaType, userPrompt, position }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const post = await res.json() as Post

      fetch(`/api/posts/${post.id}/generate-caption`, { method: 'POST' }).catch(() => {})

      onCreated(post)
      reset()
      onClose()
    } catch {
      setError('Uploaden mislukt. Probeer opnieuw.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) { reset(); onClose() } }}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8 flex flex-col" style={{ height: '70vh' }}>
        <SheetHeader className="mb-4 shrink-0">
          <SheetTitle className="text-sm text-left">Eigen media toevoegen</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto flex flex-col gap-4">
          {!file ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full aspect-square max-h-48 border-2 border-dashed border-woody-taupe/40 rounded-xl flex items-center justify-center text-sm text-woody-taupe"
            >
              Tik om foto of video te kiezen
            </button>
          ) : (
            <div className="relative">
              {file.type.startsWith('video/') ? (
                <div className="w-full aspect-square max-h-48 bg-woody-beige rounded-xl flex items-center justify-center">
                  <p className="text-xs text-woody-taupe text-center px-4"><span aria-hidden="true">🎥 </span>{file.name}</p>
                </div>
              ) : (
                <img
                  src={preview!}
                  alt="Preview"
                  className="w-full aspect-square max-h-48 object-cover rounded-xl"
                />
              )}
              <button
                type="button"
                onClick={() => { setFile(null); setPreview(null); if (inputRef.current) inputRef.current.value = '' }}
                className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full"
              >
                Wijzig
              </button>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <textarea
            placeholder="Beschrijf je post, bijv. 'Pasen sale, 20% korting op alles'"
            value={userPrompt}
            onChange={e => setUserPrompt(e.target.value)}
            rows={3}
            className="w-full border border-woody-taupe/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-woody-bordeaux/30 resize-none"
          />

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={!file || uploading}
          className="mt-4 shrink-0 w-full bg-woody-bordeaux text-woody-cream text-sm font-bold py-3 rounded-xl disabled:opacity-40"
        >
          {uploading ? 'Uploaden...' : 'Toevoegen'}
        </button>
      </SheetContent>
    </Sheet>
  )
}

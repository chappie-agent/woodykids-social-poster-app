'use client'

import { useState, useRef } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { createClient } from '@/lib/supabase/client'
import { useGridStore } from '@/lib/store/gridStore'
import type { Post } from '@/lib/types'

type Props = {
  open: boolean
  onClose: () => void
  onCreated: (post: Post) => void
}

export function UploadPicker({ open, onClose, onCreated }: Props) {
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [overLimitWarning, setOverLimitWarning] = useState(false)
  const [userPrompt, setUserPrompt] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    if (selected.length === 0) return
    setPreviews(prev => { prev.forEach(p => { if (p) URL.revokeObjectURL(p) }); return [] })
    const capped = selected.slice(0, 10)
    setOverLimitWarning(selected.length > 10)
    setFiles(capped)
    setPreviews(capped.map(f => f.type.startsWith('video/') ? '' : URL.createObjectURL(f)))
    setError(null)
  }

  function reset() {
    setPreviews(prev => { prev.forEach(p => { if (p) URL.revokeObjectURL(p) }); return [] })
    setFiles([])
    setOverLimitWarning(false)
    setUserPrompt('')
    setError(null)
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleAdd() {
    if (files.length === 0) return
    setUploading(true)
    setError(null)

    const supabase = createClient()
    const uploads = files.map(file => {
      const ext = file.name.split('.').pop() ?? 'bin'
      return { file, path: `${crypto.randomUUID()}.${ext}` }
    })

    try {
      const mediaUrls = await Promise.all(uploads.map(async ({ file, path }) => {
        const { error: uploadError } = await supabase.storage
          .from('post-media')
          .upload(path, file)
        if (uploadError) throw new Error(uploadError.message)
        return supabase.storage.from('post-media').getPublicUrl(path).data.publicUrl
      }))

      const mediaType: 'image' | 'video' = files[0].type.startsWith('video/') ? 'video' : 'image'
      const source = { kind: 'upload' as const, mediaUrls, mediaType, userPrompt }
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
      reset()
      onClose()
    } catch {
      supabase.storage.from('post-media').remove(uploads.map(u => u.path)).catch(() => {})
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
          {files.length === 0 ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full aspect-square max-h-48 border-2 border-dashed border-woody-taupe/40 rounded-xl flex items-center justify-center text-sm text-woody-taupe"
            >
              {"Tik om foto's of video's te kiezen"}
            </button>
          ) : (
            <div className="relative">
              <div className="w-full overflow-x-auto">
                <div className="flex gap-2 py-2 w-max">
                  {files.map((file, i) => (
                    <div key={i} className="flex-shrink-0 w-20 h-24 rounded-xl overflow-hidden bg-woody-beige">
                      {file.type.startsWith('video/') ? (
                        <div className="w-full h-full flex items-center justify-center px-1">
                          <p className="text-[10px] text-woody-taupe text-center break-all">{file.name}</p>
                        </div>
                      ) : (
                        <img
                          src={previews[i]}
                          alt={`Preview ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={reset}
                className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full"
              >
                Wijzig
              </button>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {overLimitWarning && (
            <p className="text-xs text-woody-taupe">Maximaal 10 bestanden — de rest is weggelaten.</p>
          )}

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
          disabled={files.length === 0 || uploading}
          className="mt-4 shrink-0 w-full bg-woody-bordeaux text-woody-cream text-sm font-bold py-3 rounded-xl disabled:opacity-40"
        >
          {uploading ? 'Uploaden...' : 'Toevoegen'}
        </button>
      </SheetContent>
    </Sheet>
  )
}

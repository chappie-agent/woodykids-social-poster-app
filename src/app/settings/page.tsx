'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

export default function SettingsPage() {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState('')

  useEffect(() => {
    fetch('/api/settings/tone-of-voice')
      .then(r => r.json())
      .then(data => setContent(data.content))

    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? '')
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    await fetch('/api/settings/tone-of-voice', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    setSaving(false)
    toast.success('Tone of voice opgeslagen')
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <main className="min-h-screen bg-[#FFF8F0]">
      <header className="flex items-center gap-2 px-3 py-3 border-b border-orange-100 bg-white/80 backdrop-blur-sm sticky top-0">
        <button onClick={() => router.push('/grid')} className="text-orange-500">
          <ChevronLeft size={20} />
        </button>
        <span className="text-base font-extrabold text-orange-900">Instellingen</span>
      </header>

      <div className="px-4 py-6 space-y-8 max-w-xl mx-auto">
        {/* Tone of voice */}
        <section className="space-y-3">
          <Label className="text-sm font-bold text-orange-900">Tone of voice</Label>
          <p className="text-xs text-gray-500">
            AI gebruikt deze tekst bij elke post-generatie. Pas aan als de toon moet veranderen.
          </p>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={14}
            className="w-full text-[12px] text-gray-800 bg-white border border-orange-200 rounded-xl px-3 py-3 resize-none focus:outline-none focus:ring-1 focus:ring-orange-300 leading-relaxed"
          />
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm"
          >
            {saving ? 'Opslaan...' : 'Opslaan'}
          </Button>
        </section>

        <Separator />

        {/* Account */}
        <section className="space-y-3">
          <p className="text-sm font-bold text-orange-900">Account</p>
          <p className="text-xs text-gray-500">{email}</p>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50 text-sm"
          >
            Uitloggen
          </Button>
        </section>
      </div>
    </main>
  )
}

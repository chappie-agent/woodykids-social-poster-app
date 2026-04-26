'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

type FirstColumn = 1 | 2 | 3

export default function SettingsPage() {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState('')
  const [firstColumn, setFirstColumn] = useState<FirstColumn>(2)
  const [savingColumn, setSavingColumn] = useState(false)

  useEffect(() => {
    fetch('/api/settings/tone-of-voice')
      .then(r => r.json())
      .then(data => setContent(data.content))

    fetch('/api/settings/feed-first-column')
      .then(r => r.json())
      .then((data: { column?: number }) => {
        if (data.column === 1 || data.column === 2 || data.column === 3) {
          setFirstColumn(data.column)
        }
      })

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

  async function pickColumn(col: FirstColumn) {
    setFirstColumn(col)
    setSavingColumn(true)
    try {
      const res = await fetch('/api/settings/feed-first-column', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column: col }),
      })
      if (!res.ok) throw new Error('failed')
      toast.success('Feed-positie opgeslagen')
    } catch {
      toast.error('Opslaan mislukt')
    } finally {
      setSavingColumn(false)
    }
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <main className="min-h-screen bg-woody-beige">
      <header className="flex items-center gap-2 px-3 py-3 sticky top-0 bg-woody-bordeaux">
        <button onClick={() => router.push('/grid')} className="text-woody-cream">
          <ChevronLeft size={20} />
        </button>
        <span className="text-base font-extrabold text-woody-cream">Instellingen</span>
      </header>

      <div className="px-4 py-6 space-y-8 max-w-xl mx-auto">
        {/* Tone of voice */}
        <section className="space-y-3">
          <Label className="text-sm font-bold text-woody-bordeaux">Tone of voice</Label>
          <p className="text-xs text-woody-brown/60">
            AI gebruikt deze tekst bij elke post-generatie. Pas aan als de toon moet veranderen.
          </p>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={14}
            className="w-full text-[12px] text-woody-brown bg-white border border-woody-taupe/40 rounded-xl px-3 py-3 resize-none focus:outline-none focus:ring-1 focus:ring-woody-bordeaux/30 leading-relaxed"
          />
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-woody-bordeaux hover:bg-woody-bordeaux/90 text-woody-cream text-sm"
          >
            {saving ? 'Opslaan...' : 'Opslaan'}
          </Button>
        </section>

        <Separator />

        {/* Feed-positie */}
        <section className="space-y-3">
          <Label className="text-sm font-bold text-woody-bordeaux">Feed-positie eerste post</Label>
          <p className="text-xs text-woody-brown/60">
            Op welke kolom moet de nieuwste post landen? Stel dit zo in dat de
            grid hieronder hetzelfde patroon volgt als je echte Instagram-feed,
            zodat je posts in de juiste rij verschijnen.
          </p>
          <div className="flex items-center gap-2">
            {([1, 2, 3] as const).map(col => (
              <button
                key={col}
                type="button"
                onClick={() => pickColumn(col)}
                disabled={savingColumn}
                aria-pressed={firstColumn === col}
                className={[
                  'w-10 h-10 rounded-md border-2 text-sm font-bold transition-colors disabled:opacity-50',
                  firstColumn === col
                    ? 'bg-woody-bordeaux text-woody-cream border-woody-bordeaux'
                    : 'bg-white text-woody-bordeaux border-woody-taupe/40 hover:border-woody-bordeaux',
                ].join(' ')}
              >
                {col}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-woody-brown/50">
            1 = nieuwe post start linksboven (onder de Voeg toe-tegel) ·
            2 = naast de Voeg toe-tegel · 3 = rechtsboven.
          </p>
        </section>

        <Separator />

        {/* Account */}
        <section className="space-y-3">
          <p className="text-sm font-bold text-woody-bordeaux">Account</p>
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

'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const isUnauthorized = searchParams.get('error') === 'unauthorized'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.endsWith('@woodykids.com')) {
      setError('Alleen @woodykids.com accounts hebben toegang.')
      return
    }
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setLoading(false)
    if (authError) { setError(authError.message); return }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="text-center space-y-2">
        <p className="text-2xl">📬</p>
        <p className="font-semibold text-woody-bordeaux">Check je inbox</p>
        <p className="text-sm text-woody-brown/60">We stuurden een magic link naar {email}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-xs">
      {isUnauthorized && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          Alleen @woodykids.com accounts hebben toegang.
        </p>
      )}
      <div className="space-y-1">
        <Label htmlFor="email">E-mailadres</Label>
        <Input
          id="email"
          type="email"
          placeholder="jij@woodykids.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="border-woody-taupe/40 focus-visible:ring-woody-bordeaux/30"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-woody-bordeaux hover:bg-woody-bordeaux/90 text-woody-cream"
      >
        {loading ? 'Versturen...' : 'Stuur magic link →'}
      </Button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-woody-beige flex flex-col items-center justify-center px-6 gap-8">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-extrabold text-woody-bordeaux">WoodyKids Poster</h1>
        <p className="text-sm text-woody-brown/50">Alleen voor het WoodyKids team</p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  )
}

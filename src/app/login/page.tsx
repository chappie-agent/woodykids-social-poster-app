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
      options: { emailRedirectTo: `${window.location.origin}/grid` },
    })
    setLoading(false)
    if (authError) { setError(authError.message); return }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="text-center space-y-2">
        <p className="text-2xl">📬</p>
        <p className="font-semibold text-orange-900">Check je inbox</p>
        <p className="text-sm text-orange-700/60">We stuurden een magic link naar {email}</p>
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
          className="border-orange-200 focus-visible:ring-orange-300"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white"
      >
        {loading ? 'Versturen...' : 'Stuur magic link →'}
      </Button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#FFF8F0] flex flex-col items-center justify-center px-6 gap-8">
      <div className="text-center space-y-1">
        <div className="text-4xl">🪵</div>
        <h1 className="text-2xl font-extrabold text-orange-900">WoodyKids Poster</h1>
        <p className="text-sm text-orange-700/50">Alleen voor het WoodyKids team</p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  )
}

import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

type RequireUserResult =
  | { user: User; response: null }
  | { user: null; response: NextResponse }

export async function requireUser(): Promise<RequireUserResult> {
  // Pariteit met proxy.ts: e2e-runs slaan auth over.
  if (process.env.E2E_TEST === 'true') {
    return { user: { email: 'e2e@woodykids.com' } as User, response: null }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.email?.toLowerCase().endsWith('@woodykids.com')) {
    return { user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { user, response: null }
}

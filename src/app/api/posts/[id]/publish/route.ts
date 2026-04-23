import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { scheduledAt } = await request.json() as { scheduledAt: string }
  // Real implementation: POST to Zernio API
  console.log(`[stub] Post ${id} queued for Zernio at ${scheduledAt}`)
  return NextResponse.json({ queued: true, id, scheduledAt })
}

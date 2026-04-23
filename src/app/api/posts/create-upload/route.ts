import { NextRequest, NextResponse } from 'next/server'
import type { Post } from '@/lib/types'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  const { mediaUrl, mediaType, userPrompt, position } = await request.json() as {
    mediaUrl: string; mediaType: 'image' | 'video'; userPrompt: string; position: number
  }

  const post: Post = {
    id: randomUUID(),
    state: 'draft',
    position,
    isPerson: false,
    source: { kind: 'upload', mediaUrl, mediaType, userPrompt },
    cropData: { x: 0, y: 0, scale: 1 },
    caption: null,
    scheduledAt: null,
  }

  return NextResponse.json(post)
}

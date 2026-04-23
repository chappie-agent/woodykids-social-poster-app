import { NextResponse } from 'next/server'
import { fakePosts } from '@/lib/fixtures/posts'

export async function GET() {
  return NextResponse.json(fakePosts)
}

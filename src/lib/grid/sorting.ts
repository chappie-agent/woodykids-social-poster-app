import type { Post } from '@/lib/types'

export function splitFeedZones(posts: Post[]): { concepts: Post[]; dated: Post[] } {
  const concepts: Post[] = []
  const dated: Post[] = []
  for (const p of posts) {
    if (p.scheduledAt) dated.push(p)
    else concepts.push(p)
  }
  return { concepts, dated }
}

export function sortPostsForFeed(posts: Post[], _now: Date = new Date()): Post[] {
  const { concepts, dated } = splitFeedZones(posts)
  const datedSorted = [...dated].sort((a, b) => {
    const at = a.scheduledAt ? Date.parse(a.scheduledAt) : 0
    const bt = b.scheduledAt ? Date.parse(b.scheduledAt) : 0
    return bt - at
  })
  return [...concepts, ...datedSorted]
}

export function isLivePost(post: Post, now: Date = new Date()): boolean {
  if (!post.scheduledAt) return false
  return Date.parse(post.scheduledAt) < now.getTime()
}

export function isPlannedPost(post: Post, now: Date = new Date()): boolean {
  if (!post.scheduledAt) return false
  return Date.parse(post.scheduledAt) >= now.getTime()
}

import type { PostCaption } from '@/lib/types'

export function assembleCaption(caption: PostCaption): string {
  const opener = caption.opener.variants[caption.opener.selected]
  const middle = caption.middle.variants[caption.middle.selected]
  const closer = caption.closer.variants[caption.closer.selected]
  const hashtags = caption.hashtags
    .filter(h => h.active)
    .map(h => h.text)
    .join(' ')

  const parts = [opener, middle, closer]
  if (hashtags) parts.push(hashtags)
  return parts.join('\n\n')
}

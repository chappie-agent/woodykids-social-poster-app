'use client'

import type { Hashtag } from '@/lib/types'

type Props = {
  hashtags: Hashtag[]
  onChange: (hashtags: Hashtag[]) => void
}

export function HashtagBadges({ hashtags, onChange }: Props) {
  function toggle(index: number) {
    onChange(hashtags.map((h, i) => i === index ? { ...h, active: !h.active } : h))
  }

  return (
    <div className="space-y-2">
      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Hashtags</p>
      <div className="flex flex-wrap gap-1.5">
        {hashtags.map((tag, i) => (
          <button
            key={tag.text}
            onClick={() => toggle(i)}
            className={[
              'text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors',
              tag.active
                ? 'bg-green-100 text-green-800 border-green-300'
                : 'bg-gray-100 text-gray-400 border-gray-200',
            ].join(' ')}
          >
            {tag.text}
          </button>
        ))}
      </div>
    </div>
  )
}

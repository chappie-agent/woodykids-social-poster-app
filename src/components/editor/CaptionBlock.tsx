'use client'

import type { CaptionBlock as CaptionBlockType } from '@/lib/types'

type Props = {
  label: string
  block: CaptionBlockType
  onChange: (block: CaptionBlockType) => void
}

export function CaptionBlock({ label, block, onChange }: Props) {
  function selectVariant(i: 0 | 1 | 2) {
    onChange({ ...block, selected: i })
  }

  function editText(text: string) {
    const variants = [...block.variants] as [string, string, string]
    variants[block.selected] = text
    onChange({ ...block, variants })
  }

  return (
    <div className="space-y-2">
      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{label}</p>

      {/* Variant selector */}
      <div className="flex gap-1.5">
        {([0, 1, 2] as const).map(i => (
          <button
            key={i}
            onClick={() => selectVariant(i)}
            className={[
              'text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors',
              block.selected === i
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-gray-500 border-gray-200',
            ].join(' ')}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Editable text */}
      <textarea
        value={block.variants[block.selected]}
        onChange={e => editText(e.target.value)}
        rows={2}
        className="w-full text-[12px] text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-orange-300 leading-relaxed"
      />
    </div>
  )
}

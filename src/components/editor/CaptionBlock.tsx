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

      <div className="space-y-1.5">
        {([0, 1, 2] as const).map(i => (
          <div
            key={i}
            onClick={() => selectVariant(i)}
            className={[
              'rounded-lg border px-3 py-2 cursor-pointer transition-colors',
              block.selected === i
                ? 'border-orange-400 bg-orange-50 ring-1 ring-orange-300'
                : 'border-gray-200 bg-gray-50 hover:border-gray-300',
            ].join(' ')}
          >
            <div className="flex items-start gap-2">
              <span className={[
                'text-[9px] font-bold mt-0.5 shrink-0',
                block.selected === i ? 'text-orange-500' : 'text-gray-400',
              ].join(' ')}>
                {i + 1}
              </span>
              {block.selected === i ? (
                <textarea
                  autoFocus
                  value={block.variants[i]}
                  onChange={e => editText(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  rows={1}
                  className="w-full text-[12px] text-gray-800 bg-transparent resize-none focus:outline-none leading-relaxed overflow-hidden"
                  style={{ height: 'auto' }}
                  ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
                  onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }}
                />
              ) : (
                <p className="text-[12px] text-gray-500 leading-relaxed">
                  {block.variants[i]}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

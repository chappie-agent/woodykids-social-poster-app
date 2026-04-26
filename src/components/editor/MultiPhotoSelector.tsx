'use client'

const MAX_PHOTOS = 10

type Props = {
  images: string[]
  selectedIndices: number[]
  onChange: (indices: number[]) => void
}

export function MultiPhotoSelector({ images, selectedIndices, onChange }: Props) {
  const atLimit = selectedIndices.length >= MAX_PHOTOS

  function toggle(i: number) {
    const pos = selectedIndices.indexOf(i)
    if (pos === -1) {
      if (atLimit) return
      onChange([...selectedIndices, i])
    } else {
      onChange(selectedIndices.filter(idx => idx !== i))
    }
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex gap-2 px-3 py-2 w-max">
        {images.map((url, i) => {
          const pos = selectedIndices.indexOf(i)
          const isSelected = pos !== -1
          const isDisabled = atLimit && !isSelected
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              className={[
                'relative flex-shrink-0 w-12 h-16 rounded overflow-hidden border-2 transition-all',
                isSelected ? 'border-woody-bordeaux opacity-100' : 'border-transparent opacity-60',
                isDisabled ? 'opacity-30 pointer-events-none' : '',
              ].join(' ')}
            >
              <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
              {isSelected && (
                <span className="absolute top-0.5 right-0.5 bg-woody-bordeaux text-woody-cream text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {pos + 1}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

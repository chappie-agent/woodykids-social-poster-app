'use client'

type Props = {
  images: string[]
  selectedIndex: number
  onChange: (index: number) => void
}

export function PhotoSelector({ images, selectedIndex, onChange }: Props) {
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex gap-2 px-3 py-2 w-max">
        {images.map((url, i) => (
          <button
            key={i}
            onClick={() => onChange(i)}
            className={[
              'flex-shrink-0 w-12 h-16 rounded overflow-hidden border-2 transition-all',
              i === selectedIndex ? 'border-woody-bordeaux opacity-100' : 'border-transparent opacity-60',
            ].join(' ')}
          >
            <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  )
}

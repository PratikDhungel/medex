import { ChevronDown } from 'lucide-react'
import { useId } from 'react'
import { isSortOption, SORT_OPTIONS, type SortOption } from '@/domain/filters'

interface SortSelectProps {
  value: SortOption
  onChange: (value: SortOption) => void
}

/** A native select: keyboard and screen-reader support, and the platform picker on phones */
export function SortSelect({ value, onChange }: SortSelectProps) {
  const id = useId()
  return (
    <div className="flex items-center gap-2 text-sm">
      {/* Visually hidden on the narrowest screens to fit beside the Filters button; still read out */}
      <label htmlFor={id} className="whitespace-nowrap text-muted-foreground max-[24rem]:sr-only">
        Sort by
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => {
            if (isSortOption(event.target.value)) onChange(event.target.value)
          }}
          className="h-9 appearance-none rounded-full border border-input bg-background py-1 pr-9 pl-4 font-medium shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  )
}

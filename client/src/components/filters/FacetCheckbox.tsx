import type { FacetOption } from '@/domain/filters'
import { cn } from '@/lib/utils'

const numberFormat = new Intl.NumberFormat('en')

interface FacetCheckboxProps<V> {
  option: FacetOption<V>
  onChange: (value: V, selected: boolean) => void
  className?: string
}

/** A checkbox with its label and how many services it would match */
export function FacetCheckbox<V>({ option, onChange, className }: FacetCheckboxProps<V>) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-accent',
        option.disabled && 'cursor-not-allowed text-muted-foreground hover:bg-transparent',
        className,
      )}
    >
      <input
        type="checkbox"
        className="size-4 shrink-0 accent-primary"
        checked={option.selected}
        disabled={option.disabled}
        onChange={(event) => onChange(option.value, event.target.checked)}
      />
      <span className="min-w-0 flex-1 break-words">{option.label}</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {numberFormat.format(option.count)}
        <span className="sr-only"> {option.count === 1 ? 'service' : 'services'}</span>
      </span>
    </label>
  )
}

interface FacetCheckboxListProps<V> {
  options: FacetOption<V>[]
  onChange: (value: V, selected: boolean) => void
}

export function FacetCheckboxList<V>({ options, onChange }: FacetCheckboxListProps<V>) {
  return (
    <ul className="space-y-0.5">
      {options.map((option) => (
        <li key={String(option.value)}>
          <FacetCheckbox option={option} onChange={onChange} />
        </li>
      ))}
    </ul>
  )
}

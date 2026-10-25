import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { FacetOption } from '@/domain/filters'
import { cn } from '@/lib/utils'
import { FacetCheckbox } from './FacetCheckbox'

interface FacetTreeNodeProps<V> {
  option: FacetOption<V>
  childOptions: FacetOption<V>[]
  onChange: (value: V, selected: boolean) => void
  /** Plural noun for the children, e.g. "subcategories" or "cities" */
  childNoun: string
}

/**
 * A parent checkbox with its children behind a disclosure. Selecting the
 * parent covers every child, so the children show as included and locked
 * until the parent is cleared.
 */
export function FacetTreeNode<V>({ option, childOptions, onChange, childNoun }: FacetTreeNodeProps<V>) {
  const listId = useId()
  const anyChildSelected = childOptions.some((child) => child.selected)
  // Starts open when a child is selected, so the selection is visible
  const [open, setOpen] = useState(anyChildSelected)

  return (
    <li>
      <div className="flex items-center gap-1">
        <FacetCheckbox
          option={option}
          onChange={onChange}
          indeterminate={!option.selected && anyChildSelected}
          className="min-w-0 flex-1"
        />
        {childOptions.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            aria-expanded={open}
            aria-controls={listId}
            aria-label={`${open ? 'Hide' : 'Show'} ${option.label} ${childNoun}`}
            onClick={() => setOpen(!open)}
          >
            <ChevronDown aria-hidden className={cn('transition-transform', open && 'rotate-180')} />
          </Button>
        )}
      </div>
      {childOptions.length > 0 && (
        <ul id={listId} hidden={!open} className="ml-5 space-y-0.5 border-l pl-2">
          {childOptions.map((child) => (
            <li key={String(child.value)}>
              <FacetCheckbox option={child} onChange={onChange} included={option.selected} />
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

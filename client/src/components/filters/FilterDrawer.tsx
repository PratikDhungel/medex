import { SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { explore, type ExploreIndex } from '@/domain/engine'
import { clearFilters, countActiveFilters, type FilterState } from '@/domain/filters'
import { FilterSidebar } from './FilterSidebar'

const numberFormat = new Intl.NumberFormat('en')

interface FilterDrawerProps {
  index: ExploreIndex
  /** The filters currently applied to the results */
  filters: FilterState
  categoriesAvailable: boolean
  onApply: (filters: FilterState) => void
}

/**
 * Filters for small screens. Changes are made to a draft, so the results
 * behind the drawer stay put; "Show N results" counts the draft and applies
 * it in one step. Closing the drawer any other way discards the draft.
 */
export function FilterDrawer({ index, filters, categoriesAvailable, onApply }: FilterDrawerProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(filters)
  const preview = useMemo(() => (open ? explore(index, draft) : null), [open, index, draft])

  const applied = countActiveFilters(filters)
  const pending = countActiveFilters(draft)
  const total = preview?.totalServices ?? 0

  const onOpenChange = (next: boolean) => {
    // Every opening starts from what is applied
    if (next) setDraft(filters)
    setOpen(next)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" className="lg:hidden">
          <SlidersHorizontal aria-hidden />
          Filters
          {applied > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">
              {applied}
              <span className="sr-only"> applied</span>
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-full max-w-sm gap-0 sm:max-w-sm">
        <SheetHeader className="border-b">
          <SheetTitle className="font-accent text-lg">Filters</SheetTitle>
          <SheetDescription className="sr-only">Changes apply when you choose Show results.</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {preview && (
            <FilterSidebar
              facets={preview.facets}
              state={draft}
              currency={preview.currency}
              categoriesAvailable={categoriesAvailable}
              onChange={(patch) => setDraft((current) => ({ ...current, page: 1, ...patch }))}
              showHeader={false}
            />
          )}
        </div>

        <SheetFooter className="flex-row border-t">
          <Button
            variant="outline"
            className="flex-1"
            disabled={pending === 0}
            onClick={() => setDraft(clearFilters(draft))}
          >
            Clear all
          </Button>
          <Button
            className="flex-[2]"
            // Applying would only lead to the empty state
            disabled={total === 0}
            onClick={() => {
              onApply(draft)
              setOpen(false)
            }}
          >
            {total === 0 ? 'No matching services' : `Show ${numberFormat.format(total)} ${total === 1 ? 'result' : 'results'}`}
          </Button>
          {/* The button text isn't announced on change; this is */}
          <p role="status" aria-live="polite" className="sr-only">
            {`${numberFormat.format(total)} matching ${total === 1 ? 'service' : 'services'}`}
          </p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

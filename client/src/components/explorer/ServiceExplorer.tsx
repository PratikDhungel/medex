import { useMemo, useState } from 'react'
import { FilterSidebar, FilterSidebarSkeleton } from '@/components/filters/FilterSidebar'
import { SearchBox } from '@/components/filters/SearchBox'
import { SortSelect } from '@/components/filters/SortSelect'
import { buildFacets } from '@/domain/facets'
import { DEFAULT_FILTERS, toggleValue, type FilterState } from '@/domain/filters'
import { groupByProvider } from '@/domain/grouping'
import { useCatalog } from '@/hooks/useCatalog'
import { useElapsed } from '@/hooks/useElapsed'
import { useOnline } from '@/hooks/useOnline'
import { ExplorerView } from './ExplorerView'

/** How long loading may take before we say it's slow */
const SLOW_AFTER_MS = 3000

export function ServiceExplorer() {
  const { status, catalog, failures, retrying, retry } = useCatalog()
  const online = useOnline()
  const slow = useElapsed(status.kind === 'loading', SLOW_AFTER_MS)

  // Moves into the URL in step 6c
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  // Any change other than paging starts again from the first page
  const update = (patch: Partial<FilterState>) => setFilters((current) => ({ ...current, page: 1, ...patch }))

  const groups = useMemo(() => (catalog ? groupByProvider(catalog.services, catalog.providers) : []), [catalog])
  // Counts over the whole catalog until the filter engine (step 7)
  const facets = useMemo(
    () => (catalog ? buildFacets(catalog, filters, () => catalog.services) : null),
    [catalog, filters],
  )
  const ready = status.kind === 'ready' && catalog !== undefined && facets !== null

  return (
    <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start lg:gap-8">
      {/* Desktop only for now; phones get a drawer in step 8 */}
      <aside
        aria-label="Filters"
        className="hidden lg:sticky lg:top-6 lg:block lg:max-h-[calc(100svh-3rem)] lg:overflow-y-auto lg:pr-2 lg:pb-6"
      >
        {ready ? (
          <FilterSidebar
            facets={facets}
            state={filters}
            categoriesAvailable={catalog.categoriesAvailable}
            onChange={update}
          />
        ) : (
          status.kind === 'loading' && <FilterSidebarSkeleton />
        )}
      </aside>

      <div className="min-w-0 space-y-4">
        {ready && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <SearchBox
                value={filters.query}
                onChange={(query) => update({ query })}
                label="Search services"
                placeholder="Search services, providers or categories"
              />
            </div>
            <SortSelect value={filters.sort} onChange={(sort) => update({ sort })} />
          </div>
        )}

        <ExplorerView
          status={status}
          catalog={catalog}
          groups={groups}
          failures={failures}
          retrying={retrying}
          onRetry={retry}
          online={online}
          slow={slow}
          isExpanded={(providerId) => filters.expanded.includes(providerId)}
          onExpandedChange={(providerId, expanded) =>
            setFilters((current) => ({ ...current, expanded: toggleValue(current.expanded, providerId, expanded) }))
          }
        />
      </div>
    </div>
  )
}

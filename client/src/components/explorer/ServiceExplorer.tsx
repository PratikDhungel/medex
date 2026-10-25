import { useMemo } from 'react'
import { FilterSidebar, FilterSidebarSkeleton } from '@/components/filters/FilterSidebar'
import { SearchBox } from '@/components/filters/SearchBox'
import { SortSelect } from '@/components/filters/SortSelect'
import { buildFacets } from '@/domain/facets'
import { toggleValue, type FilterState } from '@/domain/filters'
import { groupByProvider } from '@/domain/grouping'
import { sanitiseFilters } from '@/domain/urlState'
import { useCatalog } from '@/hooks/useCatalog'
import { useElapsed } from '@/hooks/useElapsed'
import { useOnline } from '@/hooks/useOnline'
import { useUrlFilters, type HistoryMode } from '@/hooks/useUrlFilters'
import { ExplorerView } from './ExplorerView'

/** How long loading may take before we say it's slow */
const SLOW_AFTER_MS = 3000

export function ServiceExplorer() {
  const { status, catalog, failures, retrying, retry } = useCatalog()
  const online = useOnline()
  const slow = useElapsed(status.kind === 'loading', SLOW_AFTER_MS)

  const [urlFilters, setUrlFilters] = useUrlFilters()
  // Ids from a shared or hand-edited URL are checked against the catalog
  const filters = useMemo(
    () => (catalog ? sanitiseFilters(urlFilters, catalog) : urlFilters),
    [catalog, urlFilters],
  )
  // Any change other than paging starts again from the first page
  const update = (patch: Partial<FilterState>, mode: HistoryMode = 'push') =>
    setUrlFilters({ ...filters, page: 1, ...patch }, mode)

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
                // One history entry per search, not per keystroke
                onChange={(query) => update({ query }, filters.query ? 'replace' : 'push')}
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
          // Kept on the same page and out of the history: Back shouldn't fold cards one by one
          onExpandedChange={(providerId, expanded) =>
            setUrlFilters({ ...filters, expanded: toggleValue(filters.expanded, providerId, expanded) }, 'replace')
          }
        />
      </div>
    </div>
  )
}

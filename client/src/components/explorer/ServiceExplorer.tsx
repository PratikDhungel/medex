import { useMemo, useRef } from 'react'
import { FilterSidebar, FilterSidebarSkeleton } from '@/components/filters/FilterSidebar'
import { SearchBox } from '@/components/filters/SearchBox'
import { SortSelect } from '@/components/filters/SortSelect'
import { buildIndex, explore, type ExploreIndex } from '@/domain/engine'
import { DEFAULT_FILTERS, toggleValue, type FilterState } from '@/domain/filters'
import { sanitiseFilters } from '@/domain/urlState'
import { useCatalog } from '@/hooks/useCatalog'
import { useElapsed } from '@/hooks/useElapsed'
import { useOnline } from '@/hooks/useOnline'
import { filtersHref, useUrlFilters, type HistoryMode } from '@/hooks/useUrlFilters'
import { ExplorerView } from './ExplorerView'
import { Pagination } from './Pagination'

/** How long loading may take before we say it's slow */
const SLOW_AFTER_MS = 3000

/** Runs the engine, timed as "explore" in the browser's performance tools */
function measuredExplore(index: ExploreIndex, filters: FilterState) {
  const start = performance.now()
  const result = explore(index, filters)
  performance.measure('explore', { start })
  return result
}

export function ServiceExplorer() {
  const { status, catalog, failures, retrying, retry } = useCatalog()
  const online = useOnline()
  const slow = useElapsed(status.kind === 'loading', SLOW_AFTER_MS)
  const resultsHeading = useRef<HTMLHeadingElement>(null)

  const [urlFilters, setUrlFilters] = useUrlFilters()
  // Ids from a shared or hand-edited URL are checked against the catalog
  const filters = useMemo(
    () => (catalog ? sanitiseFilters(urlFilters, catalog) : urlFilters),
    [catalog, urlFilters],
  )
  // Any change other than paging starts again from the first page
  const update = (patch: Partial<FilterState>, mode: HistoryMode = 'push') =>
    setUrlFilters({ ...filters, page: 1, ...patch }, mode)

  const index = useMemo(() => (catalog ? buildIndex(catalog) : null), [catalog])
  const result = useMemo(() => (index ? measuredExplore(index, filters) : null), [index, filters])
  const ready = status.kind === 'ready' && catalog !== undefined && result !== null

  const goToPage = (page: number) => {
    setUrlFilters({ ...filters, page }, 'push')
    // Start the new page at the top, with focus there for keyboard and screen-reader users
    resultsHeading.current?.scrollIntoView({ block: 'start' })
    resultsHeading.current?.focus({ preventScroll: true })
  }

  return (
    <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start lg:gap-8">
      {/* Desktop only for now; phones get a drawer in step 8 */}
      <aside
        aria-label="Filters"
        className="hidden lg:sticky lg:top-6 lg:block lg:max-h-[calc(100svh-3rem)] lg:overflow-y-auto lg:pr-2 lg:pb-6"
      >
        {ready ? (
          <FilterSidebar
            facets={result.facets}
            state={filters}
            currency={result.currency}
            categoriesAvailable={catalog.categoriesAvailable}
            onChange={update}
          />
        ) : (
          status.kind === 'loading' && <FilterSidebarSkeleton />
        )}
      </aside>

      <div className="min-w-0 space-y-4">
        <h2 ref={resultsHeading} tabIndex={-1} className="sr-only scroll-mt-6">
          Results
        </h2>

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
          groups={result?.groups ?? []}
          totals={{ services: result?.totalServices ?? 0, providers: result?.totalProviders ?? 0 }}
          mixedCurrencies={result?.mixedCurrencies ?? false}
          onClearFilters={() => update({ ...DEFAULT_FILTERS, sort: filters.sort })}
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

        {ready && (
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            hrefFor={(page) => filtersHref({ ...filters, page })}
            onPageChange={goToPage}
          />
        )}
      </div>
    </div>
  )
}

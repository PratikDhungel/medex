import { CloudOff, Info, SearchX, TriangleAlert, WifiOff } from 'lucide-react'
import { failureMessage } from '@/api/failureMessage'
import { RetryButton } from '@/components/common/RetryButton'
import { Button } from '@/components/ui/button'
import type { Catalog } from '@/domain/catalog'
import type { ProviderGroup } from '@/domain/grouping'
import type { CatalogFailure } from '@/hooks/useCatalog'
import type { CatalogStatus } from '@/hooks/catalogStatus'
import { ProviderCard, ProviderCardSkeleton } from './ProviderCard'
import { StatePanel } from './StatePanel'

const SKELETON_CARDS = 4
const numberFormat = new Intl.NumberFormat('en')

export interface ExplorerViewProps {
  status: CatalogStatus
  catalog: Catalog | undefined
  /** Provider cards on the current page */
  groups: ProviderGroup[]
  /** Matching services and providers across every page */
  totals: { services: number; providers: number }
  /** Sorted by price across currencies, so prices are grouped by currency */
  mixedCurrencies: boolean
  /** Clears the search and filters; offered when nothing matches */
  onClearFilters: () => void
  failures: CatalogFailure[]
  retrying: boolean
  onRetry: () => void
  online: boolean
  /** Loading has taken longer than usual */
  slow: boolean
  isExpanded: (providerId: number) => boolean
  onExpandedChange: (providerId: number, expanded: boolean) => void
}

function countText(status: CatalogStatus, totals: ExplorerViewProps['totals'], slow: boolean): string {
  switch (status.kind) {
    case 'loading':
      return slow ? 'Still loading services. This is taking longer than usual.' : 'Loading services…'
    case 'ready': {
      const { services, providers } = totals
      if (services === 0) return 'No matching services'
      return `${numberFormat.format(services)} ${services === 1 ? 'service' : 'services'} from ${providers} ${
        providers === 1 ? 'provider' : 'providers'
      }`
    }
    default:
      return ''
  }
}

export function ExplorerView(props: ExplorerViewProps) {
  const { status, totals, mixedCurrencies, retrying, onRetry, online, slow } = props

  return (
    <div className="space-y-4">
      {/* Always mounted so screen readers announce every change in the count */}
      <p role="status" aria-live="polite" className="min-h-6 text-sm text-muted-foreground">
        {countText(status, totals, slow)}
      </p>

      {!online && status.kind === 'ready' && (
        <div className="flex items-start gap-3 rounded-xl border bg-muted/50 px-4 py-3 text-sm">
          <WifiOff aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>You're offline. You can keep browsing the services already loaded.</p>
        </div>
      )}

      {status.kind === 'ready' && status.missing.includes('categories') && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p>Categories couldn't be loaded, so category details are hidden and you can't filter by category yet.</p>
          </div>
          <RetryButton retrying={retrying} onRetry={onRetry} variant="outline" />
        </div>
      )}

      {status.kind === 'ready' && mixedCurrencies && totals.services > 0 && (
        <div className="flex items-start gap-3 rounded-xl border bg-muted/50 px-4 py-3 text-sm">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>
            Prices are in different currencies, so they're sorted within each currency. Choose a currency under Price to
            compare like for like.
          </p>
        </div>
      )}

      <ExplorerBody {...props} />
    </div>
  )
}

function ExplorerBody({
  status,
  catalog,
  groups,
  totals,
  onClearFilters,
  failures,
  retrying,
  onRetry,
  isExpanded,
  onExpandedChange,
}: ExplorerViewProps) {
  switch (status.kind) {
    case 'loading':
      return (
        <ul aria-busy="true" aria-label="Loading services" className="space-y-4">
          {Array.from({ length: SKELETON_CARDS }, (_, index) => (
            <li key={index}>
              <ProviderCardSkeleton />
            </li>
          ))}
        </ul>
      )

    case 'offline':
      return (
        <StatePanel icon={WifiOff} title="You're offline" role="status">
          Services will load as soon as you're back online.
        </StatePanel>
      )

    case 'error': {
      const message = failureMessage(failures.map((failure) => failure.error))
      return (
        <StatePanel
          icon={CloudOff}
          title={message.title}
          tone="error"
          role="alert"
          action={<RetryButton retrying={retrying} onRetry={onRetry} />}
        >
          {message.body}
        </StatePanel>
      )
    }

    case 'ready':
      if (catalog && catalog.services.length > 0 && totals.services === 0) {
        return (
          <StatePanel
            icon={SearchX}
            title="No services match your search"
            action={
              <Button variant="outline" onClick={onClearFilters}>
                Clear search and filters
              </Button>
            }
          >
            Try fewer filters or a different search term.
          </StatePanel>
        )
      }
      if (!catalog || groups.length === 0) {
        return (
          <StatePanel icon={SearchX} title="No services available right now">
            Please check back later.
          </StatePanel>
        )
      }
      return (
        <ul className="space-y-4">
          {groups.map((group) => (
            <li key={group.provider.id}>
              <ProviderCard
                group={group}
                categories={catalog.categories}
                expanded={isExpanded(group.provider.id)}
                onExpandedChange={(expanded) => onExpandedChange(group.provider.id, expanded)}
              />
            </li>
          ))}
        </ul>
      )
  }
}

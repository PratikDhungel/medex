import { useMemo, useState } from 'react'
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

  // Moves into the URL with the rest of the state in step 6
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set())

  const groups = useMemo(() => (catalog ? groupByProvider(catalog.services, catalog.providers) : []), [catalog])

  return (
    <ExplorerView
      status={status}
      catalog={catalog}
      groups={groups}
      failures={failures}
      retrying={retrying}
      onRetry={retry}
      online={online}
      slow={slow}
      isExpanded={(providerId) => expanded.has(providerId)}
      onExpandedChange={(providerId, isOpen) =>
        setExpanded((current) => {
          const next = new Set(current)
          if (isOpen) next.add(providerId)
          else next.delete(providerId)
          return next
        })
      }
    />
  )
}

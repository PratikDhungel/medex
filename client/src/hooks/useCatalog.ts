import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import { categoriesQuery, providersQuery, servicesQuery, type CatalogResource } from '@/api/catalog'
import { buildCatalog, type Catalog } from '@/domain/catalog'

export interface CatalogFailure {
  resource: CatalogResource
  error: Error
}

export interface CatalogState {
  /** Built once all three resources have loaded */
  catalog: Catalog | undefined
  /** Some resource hasn't loaded yet and hasn't failed */
  pending: boolean
  /** Waiting for a connection before fetching (TanStack pauses when offline) */
  paused: boolean
  failures: CatalogFailure[]
  /** Refetches only the resources that failed */
  retry: () => void
}

const RESOURCES: CatalogResource[] = ['categories', 'providers', 'services']

export function useCatalog(): CatalogState {
  const results = useQueries({ queries: [categoriesQuery, providersQuery, servicesQuery] })
  const [categories, providers, services] = results

  const catalog = useMemo(
    () =>
      categories.data && providers.data && services.data
        ? buildCatalog({ categories: categories.data, providers: providers.data, services: services.data })
        : undefined,
    [categories.data, providers.data, services.data],
  )

  const failures = results.flatMap((result, index) =>
    result.error ? [{ resource: RESOURCES[index], error: result.error }] : [],
  )

  const retry = () => {
    for (const result of results) {
      if (result.isError) void result.refetch()
    }
  }

  return {
    catalog,
    pending: results.some((result) => result.isPending && !result.isError),
    paused: results.some((result) => result.fetchStatus === 'paused'),
    failures,
    retry,
  }
}

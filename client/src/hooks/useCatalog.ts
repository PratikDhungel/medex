import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import { categoriesQuery, providersQuery, servicesQuery, type CatalogResource } from '@/api/catalog'
import { buildCatalog, type Catalog } from '@/domain/catalog'
import { deriveCatalogStatus, type CatalogStatus } from './catalogStatus'

export interface CatalogFailure {
  resource: CatalogResource
  error: Error
}

export interface CatalogState {
  status: CatalogStatus
  /** Built once services and providers load, and categories load or fail */
  catalog: Catalog | undefined
  failures: CatalogFailure[]
  /** A retry of a failed resource is in flight */
  retrying: boolean
  /** Refetches only the resources that failed */
  retry: () => void
}

const RESOURCES: CatalogResource[] = ['categories', 'providers', 'services']

export function useCatalog(): CatalogState {
  const results = useQueries({ queries: [categoriesQuery, providersQuery, servicesQuery] })
  const [categories, providers, services] = results

  const status = deriveCatalogStatus(
    { categories: categories.status, providers: providers.status, services: services.status },
    results.some((result) => result.fetchStatus === 'paused'),
  )

  const categoriesSettled = categories.data !== undefined || categories.isError
  const catalog = useMemo(
    () =>
      providers.data && services.data && categoriesSettled
        ? buildCatalog({
            categories: categories.data ?? null,
            providers: providers.data,
            services: services.data,
          })
        : undefined,
    [categories.data, categoriesSettled, providers.data, services.data],
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
    status,
    catalog,
    failures,
    retrying: results.some((result) => result.isError && result.isFetching),
    retry,
  }
}

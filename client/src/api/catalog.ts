import { queryOptions } from '@tanstack/react-query'
import type { RawCategory, RawProvider, RawService } from '@/domain/raw'
import { getJsonArray } from './client'

// One query per resource, so each loads, fails and retries on its own.
// The data is static for a session, so it never goes stale.

export type CatalogResource = 'categories' | 'providers' | 'services'

export const categoriesQuery = queryOptions({
  queryKey: ['categories'],
  queryFn: ({ signal }) => getJsonArray<RawCategory>('/category/active', signal),
  staleTime: Infinity,
})

export const providersQuery = queryOptions({
  queryKey: ['providers'],
  queryFn: ({ signal }) => getJsonArray<RawProvider>('/providers', signal),
  staleTime: Infinity,
})

export const servicesQuery = queryOptions({
  queryKey: ['services'],
  queryFn: ({ signal }) => getJsonArray<RawService>('/service', signal),
  staleTime: Infinity,
})

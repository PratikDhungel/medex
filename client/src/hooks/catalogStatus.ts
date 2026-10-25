import type { CatalogResource } from '@/api/catalog'

export type ResourceState = 'pending' | 'error' | 'success'

export type CatalogStatus =
  /** Still loading; the page decides when that counts as slow */
  | { kind: 'loading' }
  /** Waiting for a connection with nothing to show yet */
  | { kind: 'offline' }
  /** Results can't be shown without these */
  | { kind: 'error'; failed: CatalogResource[] }
  /** Results can be shown; `missing` lists resources that failed anyway */
  | { kind: 'ready'; missing: CatalogResource[] }

// Services and providers are needed for any result: visibility, prices and
// currencies all depend on the provider. Categories only refine results.
const REQUIRED: CatalogResource[] = ['services', 'providers']

/**
 * Combines the three resource states into what the page shows. Required
 * failures win over loading, so an error isn't hidden behind a skeleton
 * while another resource is still on its way.
 */
export function deriveCatalogStatus(
  states: Record<CatalogResource, ResourceState>,
  paused: boolean,
): CatalogStatus {
  const resources = Object.keys(states) as CatalogResource[]
  const failed = resources.filter((resource) => states[resource] === 'error')

  if (REQUIRED.some((resource) => states[resource] === 'error')) {
    return { kind: 'error', failed }
  }
  if (resources.some((resource) => states[resource] === 'pending')) {
    return paused ? { kind: 'offline' } : { kind: 'loading' }
  }
  return { kind: 'ready', missing: failed }
}

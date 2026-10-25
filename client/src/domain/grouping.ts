import type { Provider, Service } from './model'

export interface ProviderGroup {
  provider: Provider
  services: Service[]
}

/**
 * Groups services under their provider. Groups appear in the order of each
 * provider's first service, and services keep their order within a group,
 * so sorting the services first sorts both.
 */
export function groupByProvider(services: readonly Service[], providers: Map<number, Provider>): ProviderGroup[] {
  const groups = new Map<number, ProviderGroup>()
  for (const service of services) {
    let group = groups.get(service.providerId)
    if (!group) {
      const provider = providers.get(service.providerId)
      if (!provider) continue
      group = { provider, services: [] }
      groups.set(service.providerId, group)
    }
    group.services.push(service)
  }
  return [...groups.values()]
}

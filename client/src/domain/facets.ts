import type { Catalog } from './catalog'
import { buildCategoryTree } from './categories'
import {
  facetOption,
  type CategoryFacetGroup,
  type Facets,
  type FacetOption,
  type FilterState,
  type LocationFacetGroup,
  type PriceBounds,
} from './filters'
import type { Provider, Service } from './model'
import { compareServiceTypes, serviceTypeLabel } from './serviceTypes'

export type FacetKey = keyof Facets

/**
 * Which services a facet counts. Each facet counts the services that match
 * every filter except its own, so its options show what selecting them
 * would give. Until the filter engine exists, every pool is the whole catalog.
 */
export type FacetPool = (facet: FacetKey) => readonly Service[]

const byLabel = <V>(a: FacetOption<V>, b: FacetOption<V>) => a.label.localeCompare(b.label)

function countBy<K>(services: readonly Service[], key: (service: Service) => K | null | undefined): Map<K, number> {
  const counts = new Map<K, number>()
  for (const service of services) {
    const value = key(service)
    if (value === null || value === undefined) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return counts
}

/**
 * Options come from the whole catalog, so an option never disappears when
 * other filters leave it with no results: it is shown disabled instead.
 * Counts come from each facet's pool.
 */
export function buildFacets(catalog: Catalog, state: FilterState, pool: FacetPool): Facets {
  const providerOf = (service: Service): Provider | undefined => catalog.providers.get(service.providerId)
  // Providers with at least one visible service
  const providers = [...new Set(catalog.services.map((service) => service.providerId))]
    .map((id) => catalog.providers.get(id))
    .filter((provider): provider is Provider => provider !== undefined)

  const types = (() => {
    const counts = countBy(pool('types'), (service) => service.type)
    return [...new Set(catalog.services.map((service) => service.type))]
      .sort(compareServiceTypes)
      .map((type) => facetOption(type, serviceTypeLabel(type), counts.get(type) ?? 0, state.types.includes(type)))
  })()

  const categories = ((): CategoryFacetGroup[] => {
    if (!catalog.categoriesAvailable) return []
    const services = pool('categories')
    const parentCounts = countBy(services, (service) => service.categoryId)
    const childCounts = countBy(services, (service) => service.subCategoryId)
    const option = (id: string, title: string, counts: Map<string, number>) =>
      facetOption(id, title, counts.get(id) ?? 0, state.categoryIds.includes(id))

    return buildCategoryTree(catalog.categories).map((group) => ({
      type: group.type,
      label: group.label,
      nodes: group.nodes.map(({ category, children }) => ({
        option: option(category.id, category.title, parentCounts),
        children: children.map((child) => option(child.id, child.title, childCounts)),
      })),
    }))
  })()

  const providerOptions = (() => {
    const counts = countBy(pool('providers'), (service) => service.providerId)
    return providers
      .map((provider) =>
        facetOption(provider.id, provider.name, counts.get(provider.id) ?? 0, state.providerIds.includes(provider.id)),
      )
      .sort(byLabel)
  })()

  const locations = ((): LocationFacetGroup[] => {
    const services = pool('locations')
    const countryCounts = countBy(services, (service) => providerOf(service)?.country?.code)
    const cityCounts = countBy(services, (service) => providerOf(service)?.city?.slug)

    const countries = new Map<string, { name: string; cities: Map<string, string> }>()
    for (const provider of providers) {
      if (!provider.country) continue
      const country = countries.get(provider.country.code) ?? { name: provider.country.name, cities: new Map() }
      if (provider.city) country.cities.set(provider.city.slug, provider.city.name)
      countries.set(provider.country.code, country)
    }

    return [...countries]
      .map(([code, { name, cities }]) => ({
        country: facetOption(code, name, countryCounts.get(code) ?? 0, state.countries.includes(code)),
        cities: [...cities]
          .map(([slug, cityName]) => facetOption(slug, cityName, cityCounts.get(slug) ?? 0, state.cities.includes(slug)))
          .sort(byLabel),
      }))
      .sort((a, b) => byLabel(a.country, b.country))
  })()

  const currencies = (() => {
    const counts = countBy(pool('currencies'), (service) => providerOf(service)?.currency)
    return [...new Set(providers.map((provider) => provider.currency))]
      .filter((currency): currency is string => currency !== null)
      .sort()
      .map((currency) => facetOption(currency, currency, counts.get(currency) ?? 0, state.currency === currency))
  })()

  const price = ((): PriceBounds | null => {
    if (state.currency === null) return null
    const prices = pool('price')
      .filter((service) => providerOf(service)?.currency === state.currency)
      .map((service) => service.minPrice)
      .filter((value): value is number => value !== null)
    if (prices.length === 0) return null
    return { currency: state.currency, min: Math.min(...prices), max: Math.max(...prices) }
  })()

  const homeTest = facetOption(
    true,
    'Home test available',
    pool('homeTest').filter((service) => service.homeTest.available).length,
    state.homeTest,
  )

  return { types, categories, providers: providerOptions, locations, currencies, price, homeTest }
}

import type { Catalog } from './catalog'
import { matchesCategories } from './categories'
import { buildFacets, type FacetKey } from './facets'
import type { Facets, FilterState } from './filters'
import { groupByProvider, type ProviderGroup } from './grouping'
import type { Provider, Service } from './model'
import { normaliseSearch } from './text'

/** Provider cards per page */
export const PAGE_SIZE = 10

/**
 * Reviews a rating needs before it counts at face value. Below that it is
 * pulled towards the average, so 5.0 from 2 reviews doesn't outrank 4.7 from 1,200.
 */
const RATING_CONFIDENCE = 25

interface IndexedService {
  service: Service
  provider: Provider
  /** Position in the catalog, the final tie-break */
  order: number
  /** Search text, normalised; the title padded with spaces to find word starts */
  title: string
  category: string
  providerName: string
}

/** Precomputed per catalog so each filter change only does the cheap work */
export interface ExploreIndex {
  catalog: Catalog
  services: IndexedService[]
  /** Review-weighted rating per provider, for relevance */
  providerScore: Map<number, number>
}

export function buildIndex(catalog: Catalog): ExploreIndex {
  const services: IndexedService[] = []
  catalog.services.forEach((service, order) => {
    const provider = catalog.providers.get(service.providerId)
    if (!provider) return
    const categoryTitles = [service.categoryId, service.subCategoryId]
      .map((id) => (id ? catalog.categories.get(id)?.title : undefined))
      .filter(Boolean)
      .join(' ')
    services.push({
      service,
      provider,
      order,
      title: ` ${normaliseSearch(service.title)} `,
      category: normaliseSearch(categoryTitles),
      providerName: normaliseSearch(provider.name),
    })
  })

  const rated = [...catalog.providers.values()].filter((provider) => provider.rating !== null)
  const reviews = rated.reduce((sum, provider) => sum + provider.reviewCount, 0)
  const average = reviews > 0 ? rated.reduce((sum, p) => sum + p.rating! * p.reviewCount, 0) / reviews : 0
  const providerScore = new Map<number, number>()
  for (const provider of catalog.providers.values()) {
    const n = provider.rating === null ? 0 : provider.reviewCount
    providerScore.set(
      provider.id,
      ((provider.rating ?? 0) * n + average * RATING_CONFIDENCE) / (n + RATING_CONFIDENCE),
    )
  }

  return { catalog, services, providerScore }
}

/** Search relevance of one service, 0 when any word is missing */
export function searchScore(entry: IndexedService, words: readonly string[]): number {
  let score = 0
  for (const word of words) {
    if (entry.title.includes(` ${word}`)) score += 4
    else if (entry.title.includes(word)) score += 3
    else if (entry.category.includes(word)) score += 2
    else if (entry.providerName.includes(word)) score += 1
    else return 0
  }
  return score
}

// One bit per filter that has a facet; a service's mask holds the filters it fails
const BIT: Record<FacetKey, number> = {
  types: 1,
  categories: 2,
  providers: 4,
  locations: 8,
  currencies: 16,
  price: 32,
  homeTest: 64,
}

/**
 * Filters each facet's counts ignore: its own, so its options show what
 * selecting them would give. The currency facet also ignores the price
 * range, which is cleared whenever the currency changes.
 */
const IGNORED: Record<FacetKey, number> = {
  ...BIT,
  currencies: BIT.currencies | BIT.price,
}
const FACET_KEYS = Object.keys(BIT) as FacetKey[]

function failedFilters(entry: IndexedService, state: FilterState, ctx: FilterContext): number {
  const { service, provider } = entry
  let failed = 0
  if (ctx.types.size && !ctx.types.has(service.type)) failed |= BIT.types
  if (ctx.categoriesOn && !matchesCategories(service, ctx.categories)) failed |= BIT.categories
  if (ctx.providers.size && !ctx.providers.has(service.providerId)) failed |= BIT.providers
  if (
    (ctx.countries.size || ctx.cities.size) &&
    !ctx.countries.has(provider.country?.code ?? '') &&
    !ctx.cities.has(provider.city?.slug ?? '')
  ) {
    failed |= BIT.locations
  }
  if (state.currency !== null && provider.currency !== state.currency) failed |= BIT.currencies
  if (ctx.priceOn) {
    const price = service.minPrice
    if (
      price === null ||
      (state.priceMin !== null && price < state.priceMin) ||
      (state.priceMax !== null && price > state.priceMax)
    ) {
      failed |= BIT.price
    }
  }
  if (state.homeTest && !service.homeTest.available) failed |= BIT.homeTest
  return failed
}

interface FilterContext {
  types: Set<string>
  categories: Set<string>
  categoriesOn: boolean
  providers: Set<number>
  countries: Set<string>
  cities: Set<string>
  /** A range only applies with a currency */
  priceOn: boolean
}

export interface ExploreResult {
  /** Provider cards on the current page */
  groups: ProviderGroup[]
  totalServices: number
  totalProviders: number
  /** The requested page, clamped to the pages that exist */
  page: number
  pageCount: number
  facets: Facets
  /**
   * The chosen currency, or the only one left in the results when none is
   * chosen. Lets the price filter preselect it without writing the URL.
   */
  currency: string | null
  /** Sorted by price across currencies: grouped by currency, then by price */
  mixedCurrencies: boolean
}

export function explore(index: ExploreIndex, state: FilterState): ExploreResult {
  const { catalog } = index
  const ctx: FilterContext = {
    types: new Set(state.types),
    categories: new Set(state.categoryIds),
    // Category ids can't be checked while categories are unavailable
    categoriesOn: catalog.categoriesAvailable && state.categoryIds.length > 0,
    providers: new Set(state.providerIds),
    countries: new Set(state.countries),
    cities: new Set(state.cities),
    priceOn: state.currency !== null && (state.priceMin !== null || state.priceMax !== null),
  }
  const words = normaliseSearch(state.query).split(' ').filter(Boolean)

  const matches: IndexedService[] = []
  const scores = new Map<IndexedService, number>()
  const pools = new Map<FacetKey, Service[]>(FACET_KEYS.map((key) => [key, []]))

  // One pass: a service counts towards a facet when the only filters it
  // fails are ones that facet ignores
  for (const entry of index.services) {
    if (words.length) {
      const score = searchScore(entry, words)
      if (score === 0) continue
      scores.set(entry, score)
    }
    const failed = failedFilters(entry, state, ctx)
    if (failed === 0) matches.push(entry)
    for (const key of FACET_KEYS) {
      if ((failed & ~IGNORED[key]) === 0) pools.get(key)!.push(entry.service)
    }
  }

  const resultCurrencies = new Set(pools.get('currencies')!.map((s) => catalog.providers.get(s.providerId)?.currency))
  const currency = state.currency ?? (resultCurrencies.size === 1 ? ([...resultCurrencies][0] ?? null) : null)

  const matchCurrencies = new Set(matches.map((entry) => entry.provider.currency))
  const byPrice = state.sort === 'price-asc' || state.sort === 'price-desc'
  const mixedCurrencies = byPrice && matchCurrencies.size > 1

  const sorted = sortMatches(matches, state, index, scores, mixedCurrencies)
  const allGroups = groupByProvider(
    sorted.map((entry) => entry.service),
    catalog.providers,
  )
  const pageCount = Math.max(1, Math.ceil(allGroups.length / PAGE_SIZE))
  const page = Math.min(Math.max(1, state.page), pageCount)

  return {
    groups: allGroups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    totalServices: matches.length,
    totalProviders: allGroups.length,
    page,
    pageCount,
    facets: buildFacets(catalog, { ...state, currency }, (key) => pools.get(key)!),
    currency,
    mixedCurrencies,
  }
}

/**
 * Orders matching services. Grouping keeps each provider where its first
 * service lands, so this orders the provider cards too.
 */
function sortMatches(
  matches: IndexedService[],
  state: FilterState,
  index: ExploreIndex,
  scores: Map<IndexedService, number>,
  mixedCurrencies: boolean,
): IndexedService[] {
  const providerScore = (entry: IndexedService) => index.providerScore.get(entry.provider.id) ?? 0
  const byOrder = (a: IndexedService, b: IndexedService) => a.order - b.order

  switch (state.sort) {
    case 'relevance':
      // Best search match first; with no search, the best-reviewed providers
      return [...matches].sort(
        (a, b) =>
          (scores.get(b) ?? 0) - (scores.get(a) ?? 0) || providerScore(b) - providerScore(a) || byOrder(a, b),
      )

    case 'price-asc':
    case 'price-desc': {
      const direction = state.sort === 'price-asc' ? 1 : -1
      return [...matches].sort((a, b) => {
        if (mixedCurrencies) {
          const byCurrency = (a.provider.currency ?? '￿').localeCompare(b.provider.currency ?? '￿')
          if (byCurrency) return byCurrency
        }
        const pa = a.service.minPrice
        const pb = b.service.minPrice
        // Price on request always last
        if (pa === null || pb === null) return (pa === null ? 1 : 0) - (pb === null ? 1 : 0) || byOrder(a, b)
        return (pa - pb) * direction || byOrder(a, b)
      })
    }

    case 'rating':
      // Highest rated first, more reviews breaking ties, unrated last
      return [...matches].sort(
        (a, b) =>
          (b.provider.rating ?? -1) - (a.provider.rating ?? -1) ||
          b.provider.reviewCount - a.provider.reviewCount ||
          a.provider.id - b.provider.id ||
          byOrder(a, b),
      )
  }
}

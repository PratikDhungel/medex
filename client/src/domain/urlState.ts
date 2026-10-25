import type { Catalog } from './catalog'
import { sanitiseCategoryIds } from './categories'
import { DEFAULT_FILTERS, isSortOption, parsePriceInput, type FilterState } from './filters'

// The filter state lives in the URL so a search can be shared, bookmarked and
// walked through with Back. Lists are comma-separated; defaults are left out.
const PARAMS = {
  query: 'q',
  types: 'type',
  categoryIds: 'category',
  providerIds: 'provider',
  countries: 'country',
  cities: 'city',
  currency: 'currency',
  priceMin: 'min',
  priceMax: 'max',
  homeTest: 'home',
  sort: 'sort',
  page: 'page',
  expanded: 'open',
} as const satisfies Record<keyof FilterState, string>

/** Longer search text is cut off; nothing in the catalog is this long */
const MAX_QUERY_LENGTH = 200
const CURRENCY_PATTERN = /^[A-Z]{3}$/

const list = (params: URLSearchParams, key: string): string[] => [
  ...new Set(
    (params.get(key) ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  ),
]

const ids = (params: URLSearchParams, key: string): number[] =>
  list(params, key)
    .filter((value) => /^\d+$/.test(value))
    .map(Number)
    .filter((value) => Number.isSafeInteger(value) && value > 0)

const price = (params: URLSearchParams, key: string): number | null => {
  const value = parsePriceInput(params.get(key) ?? '')
  return value === 'invalid' ? null : value
}

/**
 * Reads the filter state from the URL. Malformed values fall back to their
 * defaults; nothing here throws. Whether ids exist is checked separately
 * against the catalog (sanitiseFilters).
 */
export function parseFilters(params: URLSearchParams): FilterState {
  const currency = params.get(PARAMS.currency)?.trim().toUpperCase() ?? ''
  const sort = params.get(PARAMS.sort) ?? ''
  const page = Number(params.get(PARAMS.page))

  return {
    query: (params.get(PARAMS.query) ?? '').slice(0, MAX_QUERY_LENGTH),
    types: list(params, PARAMS.types),
    categoryIds: list(params, PARAMS.categoryIds),
    providerIds: ids(params, PARAMS.providerIds),
    countries: list(params, PARAMS.countries).map((code) => code.toUpperCase()),
    cities: list(params, PARAMS.cities),
    currency: CURRENCY_PATTERN.test(currency) ? currency : null,
    priceMin: price(params, PARAMS.priceMin),
    priceMax: price(params, PARAMS.priceMax),
    homeTest: params.get(PARAMS.homeTest) === '1',
    sort: isSortOption(sort) ? sort : DEFAULT_FILTERS.sort,
    page: Number.isSafeInteger(page) && page >= 1 ? page : DEFAULT_FILTERS.page,
    expanded: ids(params, PARAMS.expanded),
  }
}

/**
 * Writes the filter state into a copy of `params`, leaving out defaults.
 * Params the explorer doesn't own (such as the mock-network flags) are kept.
 */
export function serialiseFilters(state: FilterState, params: URLSearchParams = new URLSearchParams()): URLSearchParams {
  const next = new URLSearchParams(params)
  for (const key of Object.values(PARAMS)) next.delete(key)

  const set = (key: string, value: string) => {
    if (value) next.set(key, value)
  }
  set(PARAMS.query, state.query)
  set(PARAMS.types, state.types.join(','))
  set(PARAMS.categoryIds, state.categoryIds.join(','))
  set(PARAMS.providerIds, state.providerIds.join(','))
  set(PARAMS.countries, state.countries.join(','))
  set(PARAMS.cities, state.cities.join(','))
  set(PARAMS.currency, state.currency ?? '')
  set(PARAMS.priceMin, state.priceMin === null ? '' : String(state.priceMin))
  set(PARAMS.priceMax, state.priceMax === null ? '' : String(state.priceMax))
  set(PARAMS.homeTest, state.homeTest ? '1' : '')
  set(PARAMS.sort, state.sort === DEFAULT_FILTERS.sort ? '' : state.sort)
  set(PARAMS.page, state.page === DEFAULT_FILTERS.page ? '' : String(state.page))
  set(PARAMS.expanded, state.expanded.join(','))
  return next
}

/**
 * Drops what the catalog doesn't know: unknown types, categories, providers,
 * places and currencies. Children covered by a selected parent are dropped,
 * a price range needs a currency, and a reversed range is swapped.
 * With categories unavailable, category ids are kept as they are so a retry
 * can still apply them.
 */
export function sanitiseFilters(state: FilterState, catalog: Catalog): FilterState {
  const types = new Set<string>()
  const providerIds = new Set<number>()
  for (const service of catalog.services) {
    types.add(service.type)
    providerIds.add(service.providerId)
  }
  const providers = [...providerIds].map((id) => catalog.providers.get(id)).filter((provider) => provider !== undefined)
  const countries = new Set(providers.map((provider) => provider.country?.code))
  const currencies = new Set(providers.map((provider) => provider.currency))
  const cityCountry = new Map(providers.map((provider) => [provider.city?.slug, provider.country?.code]))

  const categoryIds = catalog.categoriesAvailable
    ? sanitiseCategoryIds(state.categoryIds, catalog.categories)
    : state.categoryIds
  const selectedCategories = new Set(categoryIds)
  const countryList = state.countries.filter((code) => countries.has(code))

  const currency = state.currency !== null && currencies.has(state.currency) ? state.currency : null
  let [priceMin, priceMax] = currency === null ? [null, null] : [state.priceMin, state.priceMax]
  if (priceMin !== null && priceMax !== null && priceMin > priceMax) [priceMin, priceMax] = [priceMax, priceMin]

  return {
    ...state,
    types: state.types.filter((type) => types.has(type)),
    categoryIds: categoryIds.filter((id) => {
      const parentId = catalog.categories.get(id)?.parentId
      return !parentId || !selectedCategories.has(parentId)
    }),
    providerIds: state.providerIds.filter((id) => providerIds.has(id)),
    countries: countryList,
    cities: state.cities.filter((slug) => cityCountry.has(slug) && !countryList.includes(cityCountry.get(slug) ?? '')),
    currency,
    priceMin,
    priceMax,
    expanded: state.expanded.filter((id) => providerIds.has(id)),
  }
}

// What the user has chosen (FilterState) and what each filter offers
// (Facets). The URL stores FilterState; the filter engine produces Facets.

export const SORT_OPTIONS = [
  { value: 'relevance', label: 'Most relevant' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
] as const

export type SortOption = (typeof SORT_OPTIONS)[number]['value']

export interface FilterState {
  /** Free text over service title, provider name and category */
  query: string
  types: string[]
  /** Category or subcategory ids; a parent includes its subcategories */
  categoryIds: string[]
  providerIds: number[]
  /** Alpha codes; a country includes all of its cities */
  countries: string[]
  /** City slugs */
  cities: string[]
  /** The price range only applies once a currency is chosen */
  currency: string | null
  priceMin: number | null
  priceMax: number | null
  /** Only services that offer a home test */
  homeTest: boolean
  sort: SortOption
  /** 1-based page of provider cards */
  page: number
  /** Provider ids whose cards show all services */
  expanded: number[]
}

export const DEFAULT_FILTERS: FilterState = {
  query: '',
  types: [],
  categoryIds: [],
  providerIds: [],
  countries: [],
  cities: [],
  currency: null,
  priceMin: null,
  priceMax: null,
  homeTest: false,
  sort: 'relevance',
  page: 1,
  expanded: [],
}

export interface FacetOption<V> {
  value: V
  label: string
  /** Matching services if this option were selected, given every other filter */
  count: number
  selected: boolean
  /** No results and not selected. Selected options stay enabled so they can be cleared. */
  disabled: boolean
}

export interface CategoryFacetNode {
  option: FacetOption<string>
  children: FacetOption<string>[]
}

export interface CategoryFacetGroup {
  /** Service type, e.g. "lab_test" */
  type: string
  label: string
  nodes: CategoryFacetNode[]
}

export interface LocationFacetGroup {
  country: FacetOption<string>
  cities: FacetOption<string>[]
}

export interface PriceBounds {
  currency: string
  min: number
  max: number
}

export interface Facets {
  types: FacetOption<string>[]
  /** Empty when categories failed to load */
  categories: CategoryFacetGroup[]
  providers: FacetOption<number>[]
  locations: LocationFacetGroup[]
  currencies: FacetOption<string>[]
  /** Price range of the matching services in the chosen currency; null with none chosen */
  price: PriceBounds | null
  homeTest: FacetOption<boolean>
}

/**
 * Reads a typed price bound. Empty means no bound; thousands separators and
 * spaces are allowed. Negative or non-numeric text is invalid.
 */
export function parsePriceInput(text: string): number | null | 'invalid' {
  const cleaned = text.replace(/[\s,]/g, '')
  if (cleaned === '') return null
  const value = Number(cleaned)
  return Number.isFinite(value) && value >= 0 ? value : 'invalid'
}

export function facetOption<V>(value: V, label: string, count: number, selected: boolean): FacetOption<V> {
  return { value, label, count, selected, disabled: count === 0 && !selected }
}

/**
 * How many filters are applied, for the "Filters (3)" button and "Clear all".
 * Each selected option counts once; a price range counts once. Search, sort,
 * paging and expanded cards are not filters.
 */
export function countActiveFilters(state: FilterState): number {
  return (
    state.types.length +
    state.categoryIds.length +
    state.providerIds.length +
    state.countries.length +
    state.cities.length +
    (state.currency !== null ? 1 : 0) +
    (state.priceMin !== null || state.priceMax !== null ? 1 : 0) +
    (state.homeTest ? 1 : 0)
  )
}

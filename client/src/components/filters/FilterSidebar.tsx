import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  countActiveFilters,
  DEFAULT_FILTERS,
  toggleParent,
  toggleValue,
  type Facets,
  type FilterState,
} from '@/domain/filters'
import { CategoryFacet } from './CategoryFacet'
import { FacetCheckbox, FacetCheckboxList } from './FacetCheckbox'
import { FilterSection } from './FilterSection'
import { LocationFacet } from './LocationFacet'
import { PriceFacet } from './PriceFacet'
import { ProviderFacet } from './ProviderFacet'

interface FilterSidebarProps {
  facets: Facets
  state: FilterState
  categoriesAvailable: boolean
  onChange: (patch: Partial<FilterState>) => void
}

/** Every filter except search and sort, which sit above the results */
export function FilterSidebar({ facets, state, categoriesAvailable, onChange }: FilterSidebarProps) {
  const active = countActiveFilters(state)

  // Subcategory ids for a top-level category; undefined for a subcategory
  const childrenOf = (id: string) =>
    facets.categories
      .flatMap((group) => group.nodes)
      .find((node) => node.option.value === id)
      ?.children.map((child) => child.value)
  const citiesOf = (code: string) =>
    facets.locations.find((group) => group.country.value === code)?.cities.map((city) => city.value) ?? []

  const clearAll = () => {
    const { query, sort, expanded } = state
    onChange({ ...DEFAULT_FILTERS, query, sort, expanded })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-accent text-base font-semibold">Filters</h2>
        {active > 0 && (
          <Button type="button" variant="link" size="sm" className="h-auto px-1" onClick={clearAll}>
            Clear all ({active})
          </Button>
        )}
      </div>

      <FilterSection title="Service type">
        <FacetCheckboxList
          options={facets.types}
          onChange={(type, selected) => onChange({ types: toggleValue(state.types, type, selected) })}
        />
      </FilterSection>

      <FilterSection title="Category">
        <CategoryFacet
          groups={facets.categories}
          available={categoriesAvailable}
          onChange={(id, selected) => {
            const children = childrenOf(id)
            onChange({
              categoryIds: children
                ? toggleParent(state.categoryIds, id, children, selected)
                : toggleValue(state.categoryIds, id, selected),
            })
          }}
        />
      </FilterSection>

      <FilterSection title="Price">
        <PriceFacet
          currencies={facets.currencies}
          currency={state.currency}
          // A range in one currency means nothing in another
          onCurrencyChange={(currency) => onChange({ currency, priceMin: null, priceMax: null })}
          bounds={facets.price}
          min={state.priceMin}
          max={state.priceMax}
          onRangeChange={({ min, max }) => onChange({ priceMin: min, priceMax: max })}
        />
      </FilterSection>

      <FilterSection title="Location">
        <LocationFacet
          groups={facets.locations}
          onCountryChange={(code, selected) => {
            const cities = citiesOf(code)
            onChange({
              countries: toggleValue(state.countries, code, selected),
              // A selected country covers its cities
              cities: selected ? state.cities.filter((city) => !cities.includes(city)) : state.cities,
            })
          }}
          onCityChange={(slug, selected) => onChange({ cities: toggleValue(state.cities, slug, selected) })}
        />
      </FilterSection>

      <FilterSection title="Provider">
        <ProviderFacet
          options={facets.providers}
          onChange={(id, selected) => onChange({ providerIds: toggleValue(state.providerIds, id, selected) })}
        />
      </FilterSection>

      <FilterSection title="Home test">
        <FacetCheckbox option={facets.homeTest} onChange={(_, selected) => onChange({ homeTest: selected })} />
      </FilterSection>
    </div>
  )
}

/** Placeholder while the catalog loads, so the results don't jump sideways */
export function FilterSidebarSkeleton() {
  return (
    <div aria-hidden className="space-y-6">
      <Skeleton className="h-5 w-20" />
      {Array.from({ length: 4 }, (_, section) => (
        <div key={section} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: 3 }, (_, row) => (
            <Skeleton key={row} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  )
}

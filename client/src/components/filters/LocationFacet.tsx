import type { LocationFacetGroup } from '@/domain/filters'
import { FacetTreeNode } from './FacetTree'

interface LocationFacetProps {
  groups: LocationFacetGroup[]
  onCountryChange: (code: string, selected: boolean) => void
  onCityChange: (slug: string, selected: boolean) => void
}

/** Countries with their cities. A selected country covers all of its cities. */
export function LocationFacet({ groups, onCountryChange, onCityChange }: LocationFacetProps) {
  return (
    <ul className="space-y-0.5">
      {groups.map((group) => (
        <FacetTreeNode
          key={group.country.value}
          option={group.country}
          childOptions={group.cities}
          // Country codes and city slugs are separate keys in the filter state
          onChange={(value, selected) =>
            value === group.country.value ? onCountryChange(value, selected) : onCityChange(value, selected)
          }
          childNoun="cities"
        />
      ))}
    </ul>
  )
}

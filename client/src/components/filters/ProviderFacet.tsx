import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { FacetOption } from '@/domain/filters'
import { normaliseSearch } from '@/domain/text'
import { FacetCheckboxList } from './FacetCheckbox'
import { SearchBox } from './SearchBox'

/** Providers listed before "Show all" */
export const COLLAPSED_PROVIDER_COUNT = 8

interface ProviderFacetProps {
  options: FacetOption<number>[]
  onChange: (providerId: number, selected: boolean) => void
}

/**
 * A long list of providers, searchable by name. Selected providers come
 * first so they stay visible when the list is collapsed.
 */
export function ProviderFacet({ options, onChange }: ProviderFacetProps) {
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)

  const needle = normaliseSearch(query)
  const selected = options.filter((option) => option.selected)
  const ordered = [...selected, ...options.filter((option) => !option.selected)]
  const matches = needle ? ordered.filter((option) => normaliseSearch(option.label).includes(needle)) : ordered

  const limit = Math.max(COLLAPSED_PROVIDER_COUNT, selected.length)
  // A search shows every match
  const collapsible = !needle && matches.length > limit
  const shown = collapsible && !showAll ? matches.slice(0, limit) : matches

  return (
    <div className="space-y-2">
      <SearchBox value={query} onChange={setQuery} label="Search providers" placeholder="Search providers" />
      {matches.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">No providers match “{query.trim()}”.</p>
      ) : (
        <FacetCheckboxList options={shown} onChange={onChange} />
      )}
      {collapsible && (
        <Button type="button" variant="link" size="sm" className="h-auto px-1" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show fewer' : `Show all ${options.length} providers`}
        </Button>
      )}
    </div>
  )
}

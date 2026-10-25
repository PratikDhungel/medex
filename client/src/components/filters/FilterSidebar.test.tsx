/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { buildCatalog, type RawCatalog } from '@/domain/catalog'
import { buildFacets } from '@/domain/facets'
import { DEFAULT_FILTERS, type FilterState } from '@/domain/filters'
import { FilterSidebar } from './FilterSidebar'

const catalog = buildCatalog(
  JSON.parse(
    readFileSync(new URL('../../../../server/data/task1-service-explorer.json', import.meta.url), 'utf8'),
  ) as RawCatalog,
)

const render = (state: FilterState) =>
  renderToStaticMarkup(
    <FilterSidebar
      facets={buildFacets(catalog, state, () => catalog.services)}
      state={state}
      categoriesAvailable
      onChange={() => {}}
    />,
  )

describe('FilterSidebar', () => {
  it('has a section for every filter', () => {
    const legends = [...render(DEFAULT_FILTERS).matchAll(/<legend[^>]*>([^<]+)<\/legend>/g)].map((m) => m[1])
    expect(legends).toEqual(['Service type', 'Category', 'Price', 'Location', 'Provider', 'Home test'])
  })

  it('offers "Clear all" only with filters applied', () => {
    expect(render(DEFAULT_FILTERS)).not.toContain('Clear all')
    expect(render({ ...DEFAULT_FILTERS, types: ['lab_test'], homeTest: true })).toContain('Clear all (2)')
  })
})

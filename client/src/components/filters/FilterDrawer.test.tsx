/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { buildCatalog, type RawCatalog } from '@/domain/catalog'
import { buildIndex } from '@/domain/engine'
import { DEFAULT_FILTERS, type FilterState } from '@/domain/filters'
import { FilterDrawer } from './FilterDrawer'

const catalog = buildCatalog(
  JSON.parse(
    readFileSync(new URL('../../../../server/data/task1-service-explorer.json', import.meta.url), 'utf8'),
  ) as RawCatalog,
)
const index = buildIndex(catalog)

const render = (filters: FilterState) =>
  renderToStaticMarkup(<FilterDrawer index={index} filters={filters} categoriesAvailable onApply={() => {}} />)

// The drawer's content is portalled and only mounted while open, so only the trigger renders here
describe('FilterDrawer', () => {
  it('opens from a Filters button, hidden on large screens', () => {
    const html = render(DEFAULT_FILTERS)
    const button = html.match(/<button[^>]*>/)?.[0] ?? ''
    expect(button).toContain('aria-haspopup="dialog"')
    expect(button).toContain('lg:hidden')
    expect(html).not.toContain('applied')
  })

  it('shows how many filters are applied', () => {
    expect(render({ ...DEFAULT_FILTERS, types: ['lab_test'], countries: ['TH'] })).toContain(
      '2<span class="sr-only"> applied</span>',
    )
  })
})

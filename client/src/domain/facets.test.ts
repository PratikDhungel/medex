/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildCatalog, type RawCatalog } from './catalog'
import { buildFacets } from './facets'
import { DEFAULT_FILTERS } from './filters'

const raw = JSON.parse(
  readFileSync(new URL('../../../server/data/task1-service-explorer.json', import.meta.url), 'utf8'),
) as RawCatalog
const catalog = buildCatalog(raw)
const everything = () => catalog.services

describe('buildFacets over the whole catalog', () => {
  const facets = buildFacets(catalog, DEFAULT_FILTERS, everything)
  const total = catalog.services.length

  it('counts every visible service once per single-choice facet', () => {
    const sum = (counts: number[]) => counts.reduce((a, b) => a + b, 0)
    expect(sum(facets.types.map((o) => o.count))).toBe(total)
    expect(sum(facets.currencies.map((o) => o.count))).toBe(total)
    expect(sum(facets.locations.map((g) => g.country.count))).toBe(total)
    expect(sum(facets.providers.map((o) => o.count))).toBe(total)
  })

  it('lists types in display order and only providers with visible services', () => {
    expect(facets.types[0].label).toBe('Packages')
    expect(facets.providers).toHaveLength(64)
    expect(facets.currencies.map((o) => o.value)).toEqual(['INR', 'NPR', 'THB'])
  })

  it('tells the two Ultrasound categories apart by type', () => {
    const ultrasounds = facets.categories.flatMap((group) =>
      group.nodes.filter((node) => node.option.label === 'Ultrasound').map(() => group.label),
    )
    expect(ultrasounds.sort()).toEqual(['Lab Tests', 'Packages'])
  })

  it('has price bounds only once a currency is chosen', () => {
    expect(facets.price).toBeNull()
    const thb = buildFacets(catalog, { ...DEFAULT_FILTERS, currency: 'THB' }, everything).price
    expect(thb?.currency).toBe('THB')
    expect(thb!.min).toBeLessThan(thb!.max)
  })

  it('has no categories when they failed to load', () => {
    const partial = buildCatalog({ ...raw, categories: null })
    expect(buildFacets(partial, DEFAULT_FILTERS, () => partial.services).categories).toEqual([])
  })

  it('keeps an option with no results, disabled', () => {
    const facets = buildFacets(catalog, DEFAULT_FILTERS, (facet) => (facet === 'types' ? [] : catalog.services))
    expect(facets.types.length).toBeGreaterThan(0)
    expect(facets.types.every((o) => o.disabled)).toBe(true)
  })
})

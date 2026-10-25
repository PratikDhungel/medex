import { describe, expect, it } from 'vitest'
import { countActiveFilters, DEFAULT_FILTERS, facetOption } from './filters'

describe('facetOption', () => {
  it('disables an option with no results', () => {
    expect(facetOption('lab_test', 'Lab Tests', 0, false).disabled).toBe(true)
    expect(facetOption('lab_test', 'Lab Tests', 4, false).disabled).toBe(false)
  })

  it('keeps a selected option enabled so it can be cleared', () => {
    expect(facetOption('lab_test', 'Lab Tests', 0, true).disabled).toBe(false)
  })
})

describe('countActiveFilters', () => {
  it('is zero by default', () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0)
  })

  it('counts each selected option, and a price range once', () => {
    expect(
      countActiveFilters({
        ...DEFAULT_FILTERS,
        types: ['lab_test', 'package'],
        cities: ['bangkok'],
        currency: 'THB',
        priceMin: 500,
        priceMax: 2000,
        homeTest: true,
      }),
    ).toBe(6)
  })

  it('ignores search, sort, page and expanded cards', () => {
    expect(
      countActiveFilters({ ...DEFAULT_FILTERS, query: 'thyroid', sort: 'rating', page: 3, expanded: [48] }),
    ).toBe(0)
  })
})

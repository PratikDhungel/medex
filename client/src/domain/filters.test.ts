import { describe, expect, it } from 'vitest'
import { countActiveFilters, DEFAULT_FILTERS, facetOption, parsePriceInput } from './filters'

describe('parsePriceInput', () => {
  it('reads numbers with separators, and empty as no bound', () => {
    expect(parsePriceInput(' 1,500 ')).toBe(1500)
    expect(parsePriceInput('99.5')).toBe(99.5)
    expect(parsePriceInput('0')).toBe(0)
    expect(parsePriceInput('  ')).toBeNull()
  })

  it('rejects negative and non-numeric text', () => {
    expect(parsePriceInput('-5')).toBe('invalid')
    expect(parsePriceInput('abc')).toBe('invalid')
    expect(parsePriceInput('1e400')).toBe('invalid')
  })
})

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

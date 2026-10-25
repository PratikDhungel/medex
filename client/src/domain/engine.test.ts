/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildCatalog, type RawCatalog } from './catalog'
import { buildIndex, explore, PAGE_SIZE } from './engine'
import { DEFAULT_FILTERS, type FilterState } from './filters'

const raw = JSON.parse(
  readFileSync(new URL('../../../server/data/task1-service-explorer.json', import.meta.url), 'utf8'),
) as RawCatalog
const catalog = buildCatalog(raw)
const index = buildIndex(catalog)
const run = (patch: Partial<FilterState> = {}) => explore(index, { ...DEFAULT_FILTERS, ...patch })
const services = (patch: Partial<FilterState>) => {
  const result = run({ ...patch, page: 1 })
  // Every page, so totals can be checked against the cards
  return Array.from({ length: result.pageCount }, (_, i) => run({ ...patch, page: i + 1 }).groups)
    .flat()
    .flatMap((group) => group.services)
}

describe('explore', () => {
  it('shows everything with no filters', () => {
    const result = run()
    expect(result.totalServices).toBe(2853)
    expect(result.totalProviders).toBe(64)
    expect(result.pageCount).toBe(Math.ceil(64 / PAGE_SIZE))
    expect(result.groups).toHaveLength(PAGE_SIZE)
  })

  it('applies every filter together', () => {
    const patch: Partial<FilterState> = { types: ['lab_test'], countries: ['TH'], homeTest: true }
    const matched = services(patch)
    expect(matched.length).toBe(run(patch).totalServices)
    expect(matched.length).toBeGreaterThan(0)
    for (const service of matched) {
      expect(service.type).toBe('lab_test')
      expect(service.homeTest.available).toBe(true)
      expect(catalog.providers.get(service.providerId)?.country?.code).toBe('TH')
    }
  })

  it('treats country and city as one location filter (either matches)', () => {
    const both = run({ countries: ['NP'], cities: ['bangkok'] }).totalServices
    expect(both).toBe(run({ countries: ['NP'] }).totalServices + run({ cities: ['bangkok'] }).totalServices)
  })

  it('filters a price range in the chosen currency on the "From" price', () => {
    const matched = services({ currency: 'THB', priceMin: 500, priceMax: 2000 })
    expect(matched.length).toBeGreaterThan(0)
    for (const service of matched) {
      expect(catalog.providers.get(service.providerId)?.currency).toBe('THB')
      expect(service.minPrice).toBeGreaterThanOrEqual(500)
      expect(service.minPrice).toBeLessThanOrEqual(2000)
    }
  })

  it('clamps the page to the pages that exist', () => {
    expect(run({ page: 999 }).page).toBe(run().pageCount)
    expect(run({ types: ['insurance'], page: 5 }).page).toBe(1)
  })
})

describe('facet counts with several filters active', () => {
  // Each option's count must equal the results of selecting only that option,
  // keeping every other filter as it is
  const state: FilterState = {
    ...DEFAULT_FILTERS,
    query: 'test',
    types: ['lab_test', 'package'],
    countries: ['TH'],
    homeTest: true,
  }
  const { facets } = explore(index, state)
  const total = (patch: Partial<FilterState>) => explore(index, { ...state, ...patch }).totalServices

  it('counts types', () => {
    for (const option of facets.types) expect(option.count).toBe(total({ types: [option.value] }))
  })

  it('counts categories and subcategories', () => {
    for (const node of facets.categories.flatMap((group) => group.nodes)) {
      expect(node.option.count).toBe(total({ categoryIds: [node.option.value] }))
      for (const child of node.children) expect(child.count).toBe(total({ categoryIds: [child.value] }))
    }
  })

  it('counts providers, places and home test', () => {
    for (const option of facets.providers) expect(option.count).toBe(total({ providerIds: [option.value] }))
    for (const group of facets.locations) {
      expect(group.country.count).toBe(total({ countries: [group.country.value], cities: [] }))
      for (const city of group.cities) expect(city.count).toBe(total({ countries: [], cities: [city.value] }))
    }
    expect(facets.homeTest.count).toBe(total({ homeTest: true }))
  })

  it('counts currencies ignoring the price range', () => {
    const priced = { ...state, currency: 'THB', priceMin: 100, priceMax: 900 }
    for (const option of explore(index, priced).facets.currencies) {
      expect(option.count).toBe(explore(index, { ...priced, currency: option.value, priceMin: null, priceMax: null }).totalServices)
    }
  })
})

describe('currency', () => {
  it('picks the only currency left in the results', () => {
    const result = run({ countries: ['NP'] })
    expect(result.currency).toBe('NPR')
    expect(result.facets.currencies.find((o) => o.value === 'NPR')?.selected).toBe(true)
    expect(result.facets.price?.currency).toBe('NPR')
  })

  it('leaves the choice open with several currencies', () => {
    expect(run().currency).toBeNull()
    expect(run().facets.price).toBeNull()
  })
})

describe('search', () => {
  it('needs every word, ignoring case and accents', () => {
    const matched = services({ query: 'THYROID panel' })
    expect(matched.length).toBeGreaterThan(0)
    expect(matched.every((s) => /thyroid/i.test(s.title) || /panel/i.test(s.title))).toBe(true)
    expect(run({ query: 'thyroid zzzz' }).totalServices).toBe(0)
  })

  it('also matches category and provider names', () => {
    const provider = catalog.providers.get(catalog.services[0].providerId)!
    const matched = services({ query: provider.name })
    expect(matched.some((s) => s.providerId === provider.id)).toBe(true)
  })

  it('ranks title matches above category matches', () => {
    // "thyroid" is both in titles and a subcategory name
    const matched = services({ query: 'thyroid' })
    expect(matched.some((s) => !/thyroid/i.test(s.title))).toBe(true)
    expect(matched[0].title.toLowerCase()).toContain('thyroid')
  })

  it('still finds services by category alone', () => {
    // No visible service has "ultrasound" in its title
    const matched = services({ query: 'ultrasound' })
    expect(matched.length).toBeGreaterThan(0)
    expect(matched.every((s) => !/ultrasound/i.test(s.title))).toBe(true)
  })
})

describe('sorting', () => {
  it('sorts by price within one currency, price on request last', () => {
    const state = { currency: 'THB', sort: 'price-asc' } as const
    // Cards order by their cheapest service, and services by price within a card
    const groups = Array.from({ length: run(state).pageCount }, (_, i) => run({ ...state, page: i + 1 }).groups).flat()
    const firsts = groups.map((g) => g.services[0].minPrice ?? Infinity)
    expect(firsts).toEqual([...firsts].sort((a, b) => a - b))
    for (const { services } of groups) {
      const prices = services.map((s) => s.minPrice ?? Infinity)
      expect(prices).toEqual([...prices].sort((a, b) => a - b))
    }
    // Vitamin D Test has no usable price
    const vitaminD = groups.flatMap((g) => g.services).find((s) => s.title === 'Vitamin D Test')
    const card = groups.find((g) => g.services.includes(vitaminD!))!
    expect(card.services.at(-1)).toBe(vitaminD)
    expect(run(state).mixedCurrencies).toBe(false)
  })

  it('groups by currency when sorting prices across currencies', () => {
    const result = run({ sort: 'price-desc' })
    expect(result.mixedCurrencies).toBe(true)
    const currencies = services({ sort: 'price-desc' }).map((s) => catalog.providers.get(s.providerId)?.currency)
    expect(currencies).toEqual([...currencies].sort())
  })

  it('puts higher-rated providers first, unrated last', () => {
    const ratings = services({ sort: 'rating' }).map((s) => catalog.providers.get(s.providerId)?.rating ?? -1)
    expect(ratings).toEqual([...ratings].sort((a, b) => b - a))
  })

  it('without a search, ranks well-reviewed providers above thinly reviewed perfect scores', () => {
    const [top] = run().groups
    expect(top.provider.reviewCount).toBeGreaterThan(25)
  })
})

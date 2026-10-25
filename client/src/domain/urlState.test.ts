/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildCatalog, type RawCatalog } from './catalog'
import { DEFAULT_FILTERS, type FilterState } from './filters'
import { parseFilters, sanitiseFilters, serialiseFilters } from './urlState'

const parse = (search: string) => parseFilters(new URLSearchParams(search))

describe('parseFilters', () => {
  it('gives the defaults for an empty URL', () => {
    expect(parse('')).toEqual(DEFAULT_FILTERS)
  })

  it('reads every filter', () => {
    expect(
      parse(
        'q=thyroid&type=lab_test,package&category=a,b&provider=12,48&country=th&city=bangkok' +
          '&currency=thb&min=500&max=2000&home=1&sort=price-asc&page=3&open=48',
      ),
    ).toEqual({
      query: 'thyroid',
      types: ['lab_test', 'package'],
      categoryIds: ['a', 'b'],
      providerIds: [12, 48],
      countries: ['TH'],
      cities: ['bangkok'],
      currency: 'THB',
      priceMin: 500,
      priceMax: 2000,
      homeTest: true,
      sort: 'price-asc',
      page: 3,
      expanded: [48],
    } satisfies FilterState)
  })

  it('falls back to defaults for malformed values', () => {
    expect(
      parse('type=,,&provider=abc,-1,1.5,7,7&currency=baht&min=-5&max=lots&home=yes&sort=cheapest&page=0&open=x'),
    ).toEqual({ ...DEFAULT_FILTERS, providerIds: [7] })
    expect(parse('page=2.5').page).toBe(1)
  })
})

describe('serialiseFilters', () => {
  it('leaves defaults out of the URL', () => {
    expect(serialiseFilters(DEFAULT_FILTERS).toString()).toBe('')
  })

  it('round-trips through the URL', () => {
    const state: FilterState = {
      ...DEFAULT_FILTERS,
      query: 'blood & urine',
      types: ['lab_test'],
      providerIds: [3, 9],
      currency: 'NPR',
      priceMax: 1500,
      sort: 'rating',
      page: 2,
    }
    expect(parseFilters(serialiseFilters(state))).toEqual(state)
  })

  it('keeps params it does not own, such as the mock flags', () => {
    const params = serialiseFilters({ ...DEFAULT_FILTERS, homeTest: true }, new URLSearchParams('mockFail=categories&page=4'))
    expect(params.toString()).toBe('mockFail=categories&home=1')
  })
})

describe('sanitiseFilters', () => {
  const raw = JSON.parse(
    readFileSync(new URL('../../../server/data/task1-service-explorer.json', import.meta.url), 'utf8'),
  ) as RawCatalog
  const catalog = buildCatalog(raw)
  const service = catalog.services[0]
  const provider = catalog.providers.get(service.providerId)!
  const parent = [...catalog.categories.values()].find((c) => c.active && c.parentId === null)!
  const child = [...catalog.categories.values()].find((c) => c.active && c.parentId === parent.id)

  it('keeps known values', () => {
    const state: FilterState = {
      ...DEFAULT_FILTERS,
      types: [service.type],
      categoryIds: [parent.id],
      providerIds: [provider.id],
      countries: [provider.country!.code],
      currency: provider.currency,
      priceMin: 100,
    }
    expect(sanitiseFilters(state, catalog)).toEqual(state)
  })

  it('drops unknown values', () => {
    const state: FilterState = {
      ...DEFAULT_FILTERS,
      types: ['spaceflight'],
      categoryIds: ['nope'],
      providerIds: [999999],
      countries: ['ZZ'],
      cities: ['atlantis'],
      currency: 'EUR',
      priceMin: 100,
      expanded: [999999],
    }
    expect(sanitiseFilters(state, catalog)).toEqual(DEFAULT_FILTERS)
  })

  it('drops children covered by a selected parent', () => {
    expect(child).toBeDefined()
    const state = { ...DEFAULT_FILTERS, categoryIds: [child!.id, parent.id] }
    expect(sanitiseFilters(state, catalog).categoryIds).toEqual([parent.id])

    const cities = { ...DEFAULT_FILTERS, countries: [provider.country!.code], cities: [provider.city!.slug] }
    expect(sanitiseFilters(cities, catalog).cities).toEqual([])
  })

  it('swaps a reversed price range', () => {
    const state = { ...DEFAULT_FILTERS, currency: provider.currency, priceMin: 900, priceMax: 100 }
    expect(sanitiseFilters(state, catalog)).toMatchObject({ priceMin: 100, priceMax: 900 })
  })

  it('keeps category ids when categories failed to load', () => {
    const partial = buildCatalog({ ...raw, categories: null })
    expect(sanitiseFilters({ ...DEFAULT_FILTERS, categoryIds: ['x'] }, partial).categoryIds).toEqual(['x'])
  })
})

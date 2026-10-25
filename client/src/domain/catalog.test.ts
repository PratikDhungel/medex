/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildCatalog, type RawCatalog } from './catalog'
import { indexCategories } from './categories'
import type { HiddenReason } from './model'
import type { RawCategory, RawProvider, RawService } from './raw'

const provider = (overrides: Partial<RawProvider> = {}, info: Partial<NonNullable<RawProvider['providerInformation']>> = {}): RawProvider => ({
  id: 1,
  name: 'Clinic',
  username: 'clinic',
  status: 'active',
  providerInformation: {
    companyName: 'Clinic',
    slug: 'clinic',
    types: ['lab_test'],
    currency: 'THB',
    city: { id: 'c1', name: 'Bangkok', slug: 'bangkok' },
    country: { id: 1, name: 'Thailand', alphaCode: 'TH' },
    rating: 4.5,
    reviewCount: 10,
    ...info,
  },
  ...overrides,
})

const category = (overrides: Partial<RawCategory> = {}): RawCategory => ({
  id: 'cat',
  title: 'Blood Tests',
  slug: 'blood-tests',
  type: 'lab_test',
  position: 1,
  status: true,
  parentId: null,
  children: [{ id: 'sub', title: 'Thyroid', slug: 'thyroid', type: 'lab_test', position: 1, status: true, parentId: 'cat' }],
  ...overrides,
})

const service = (overrides: Partial<RawService> = {}): RawService => ({
  id: 's1',
  title: 'Thyroid Panel',
  slug: 'thyroid-panel',
  type: 'lab_test',
  userId: 1,
  categoryId: 'cat',
  subCategoryId: 'sub',
  price: '1000.00',
  discount: '0.00',
  discountType: 'amount',
  serviceCharge: '0.00',
  serviceChargeType: 'amount',
  status: true,
  testAtHome: false,
  homeTestCharge: null,
  wellnessPricing: [],
  createdAt: '2025-01-01T00:00:00.000Z',
  ...overrides,
})

const build = (raw: Partial<RawCatalog>) =>
  buildCatalog({ categories: [category()], providers: [provider()], services: [service()], ...raw })

describe('indexCategories', () => {
  it('indexes parents and children by id', () => {
    const index = indexCategories([category()])
    expect(index.get('sub')).toMatchObject({ slug: 'thyroid', parentId: 'cat', active: true })
  })

  it('keeps categories that share a slug apart', () => {
    const index = indexCategories([
      category({ id: 'us-pkg', slug: 'ultrasound', type: 'package', children: [] }),
      category({ id: 'us-lab', slug: 'ultrasound', type: 'lab_test', children: [] }),
    ])
    expect(index.get('us-pkg')?.type).toBe('package')
    expect(index.get('us-lab')?.type).toBe('lab_test')
  })

  it('makes a child inactive when its parent is', () => {
    expect(indexCategories([category({ status: false })]).get('sub')?.active).toBe(false)
  })
})

describe('buildCatalog visibility', () => {
  it('keeps a fully active service', () => {
    expect(build({}).services).toHaveLength(1)
  })

  it.each([
    ['service-inactive', { services: [service({ status: false })] }],
    ['provider-inactive', { providers: [provider({ status: 'inactive' })] }],
    ['provider-missing', { services: [service({ userId: 99 })] }],
    ['category-inactive', { categories: [category({ status: false })] }],
    ['category-missing', { services: [service({ categoryId: 'gone', subCategoryId: null })] }],
  ] satisfies [HiddenReason, Partial<RawCatalog>][])('hides and counts %s', (reason, raw) => {
    const catalog = build(raw)
    expect(catalog.services).toHaveLength(0)
    expect(catalog.hidden[reason]).toBe(1)
  })

  it('hides a service under an inactive subcategory', () => {
    const inactiveChild = category({
      children: [{ id: 'sub', title: 'Thyroid', slug: 'thyroid', type: 'lab_test', position: 1, status: false, parentId: 'cat' }],
    })
    expect(build({ categories: [inactiveChild] }).hidden['category-inactive']).toBe(1)
  })

  it('shows an uncategorised service', () => {
    expect(build({ services: [service({ categoryId: null, subCategoryId: null })] }).services).toHaveLength(1)
  })

  it('accepts provider status in any case', () => {
    expect(build({ providers: [provider({ status: ' Active ' })] }).services).toHaveLength(1)
  })

  it('drops duplicate service ids', () => {
    const catalog = build({ services: [service(), service({ title: 'Copy' })] })
    expect(catalog.services.map((s) => s.title)).toEqual(['Thyroid Panel'])
    expect(catalog.issues).toContainEqual({ entity: 'service', id: 's1', code: 'duplicate-id' })
  })
})

describe('buildCatalog normalisation', () => {
  it('prices a fixed service', () => {
    const [s] = build({}).services
    expect(s.pricing).toMatchObject({ kind: 'fixed', price: { final: 1000 } })
    expect(s.minPrice).toBe(1000)
  })

  it('prices wellness by duration, shortest first, with the cheapest as minPrice', () => {
    const tier = { discount: '0.00', discountType: 'amount', serviceCharge: '0.00', serviceChargeType: 'amount' } as const
    const [s] = build({
      services: [
        service({
          type: 'wellness',
          price: null,
          discount: null,
          discountType: null,
          serviceCharge: null,
          serviceChargeType: null,
          wellnessPricing: [
            { ...tier, id: 't90', durationInMinutes: 90, price: '2400.00', discount: '15.00', discountType: 'percent' },
            { ...tier, id: 't60', durationInMinutes: 60, price: '1800.00' },
          ],
        }),
      ],
    }).services
    expect(s.pricing.kind === 'tiers' && s.pricing.tiers.map((t) => t.durationMinutes)).toEqual([60, 90])
    expect(s.minPrice).toBe(1800)
  })

  it('falls back to price on request without a usable price or currency', () => {
    expect(build({ services: [service({ price: 'abc' })] }).services[0].pricing.kind).toBe('none')
    expect(build({ providers: [provider({}, { currency: 'baht' })] }).services[0].pricing.kind).toBe('none')
  })

  it('tidies titles and flags them', () => {
    const catalog = build({ services: [service({ title: '  hba1c   TEST (Diabetes) ' })] })
    expect(catalog.services[0].title).toBe('hba1c TEST (Diabetes)')
    expect(catalog.issues.map((i) => i.code)).toContain('untidy-title')
  })

  it('treats a rating with no reviews as unrated', () => {
    const catalog = build({ providers: [provider({}, { rating: null, reviewCount: 0 })] })
    expect(catalog.providers.get(1)?.rating).toBeNull()
    expect(build({ providers: [provider({}, { rating: 4, reviewCount: 0 })] }).providers.get(1)?.rating).toBeNull()
  })

  it('only keeps a home-test fee when home testing is offered', () => {
    expect(build({ services: [service({ testAtHome: true, homeTestCharge: '331.00' })] }).services[0].homeTest).toEqual({
      available: true,
      fee: 331,
    })
    const catalog = build({ services: [service({ testAtHome: false, homeTestCharge: '50.00' })] })
    expect(catalog.services[0].homeTest).toEqual({ available: false, fee: null })
    expect(catalog.issues.map((i) => i.code)).toContain('home-fee-without-home-test')
  })
})

describe('buildCatalog on the real data', () => {
  const raw = JSON.parse(
    readFileSync(new URL('../../../server/data/task1-service-explorer.json', import.meta.url), 'utf8'),
  ) as RawCatalog
  const catalog = buildCatalog(raw)

  it('applies the visibility rules', () => {
    expect(catalog.services).toHaveLength(2853)
    expect(catalog.hidden).toEqual({
      'service-inactive': 198,
      'provider-missing': 0,
      'provider-inactive': 108,
      'category-missing': 0,
      'category-inactive': 41,
    })
  })

  it('prices every visible service', () => {
    expect(catalog.services.filter((s) => s.pricing.kind === 'none')).toHaveLength(0)
  })
})

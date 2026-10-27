/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { CartIssue } from './model'
import { normaliseCart, normaliseLine } from './normalise'
import type { RawCart, RawCartLine } from './raw'

const { serverCart } = JSON.parse(
  readFileSync(new URL('../../../../server/data/task2-cart.json', import.meta.url), 'utf8'),
) as { serverCart: RawCart }

const FACIAL_LINE = 'e38e2e25-84d4-4843-85e8-a362c3dec25a'
const REMOVED_LINE = '7a15eb5e-0e1b-4cb1-9cf6-bd4344b569be'

const product = (overrides: Record<string, unknown> = {}) => ({
  id: 'p1',
  title: 'CBC Profile',
  type: 'lab_test',
  currency: 'THB',
  providerId: 1,
  providerName: 'Lotus Pathology',
  price: 100,
  ...overrides,
})

const wellness = (overrides: Record<string, unknown> = {}) =>
  product({
    type: 'wellness',
    price: null,
    priceUnknown: true,
    wellnessPricing: [
      { id: 'w90', durationInMinutes: 90, amount_after_service_charge: 2040 },
      { id: 'w60', durationInMinutes: 60, amount_after_service_charge: 1800 },
    ],
    ...overrides,
  })

function line(raw: RawCartLine, groupType = 'lab_test') {
  const issues: CartIssue[] = []
  return { line: normaliseLine(raw, groupType, issues), issues }
}

describe('normaliseCart with the server cart from the data file', () => {
  const cart = normaliseCart(serverCart)

  it('keeps the groups, bookable first in service-type order, removed services last', () => {
    expect(cart.groups.map((g) => [g.type, g.bookable, g.ready])).toEqual([
      ['package', true, true],
      ['lab_test', true, true],
      ['wellness', true, false],
      ['unknown', false, false],
    ])
    expect(cart.itemCount).toBe(8)
  })

  it('shows a subtotal per currency and matches the server', () => {
    const subtotals = Object.fromEntries(cart.groups.map((g) => [g.type, g.subtotals]))
    expect(subtotals.lab_test).toEqual([
      { currency: 'NPR', amount: 12520 },
      { currency: 'THB', amount: 1677 },
    ])
    expect(subtotals.package).toEqual([
      { currency: 'INR', amount: 23009.5 },
      { currency: 'THB', amount: 15230 },
    ])
    expect(cart.issues.filter((i) => i.code === 'subtotal-mismatch')).toEqual([])
  })

  it('blocks the wellness group until a duration is chosen, with no subtotal', () => {
    const group = cart.groups.find((g) => g.type === 'wellness')!
    expect(group.subtotals).toEqual([])
    expect(group.blockers).toEqual([{ lineId: FACIAL_LINE, reason: 'needs-duration' }])
    expect(group.lines[0].durations.map((d) => d.minutes)).toEqual([60, 90])
  })

  it('marks the removed service as unavailable and leaves it out of any order', () => {
    const group = cart.groups.find((g) => g.type === 'unknown')!
    expect(group.lines[0]).toMatchObject({ id: REMOVED_LINE, title: null, status: { kind: 'unavailable' } })
    expect(group.excludedLineIds).toEqual([REMOVED_LINE])
  })

  it('lists the distinct providers in a group', () => {
    expect(cart.groups.find((g) => g.type === 'lab_test')!.providers.map((p) => p.name)).toEqual([
      'Lotus Pathology',
      'Lalit Diagnostics',
      'Himal Neo Clinic',
    ])
  })
})

describe('normaliseLine', () => {
  it('prices a line as unit price × quantity, in cents', () => {
    expect(line({ id: 'l', quantity: 3, product: product({ price: 0.1 }) }).line?.status).toEqual({
      kind: 'priced',
      unitPrice: 0.1,
      total: 0.3,
    })
  })

  it('accepts money sent as a string', () => {
    expect(line({ id: 'l', quantity: 1, product: product({ price: '4760.00' }) }).line?.status).toMatchObject({
      kind: 'priced',
      unitPrice: 4760,
    })
  })

  it('prices a wellness line from its chosen duration only', () => {
    const chosen = line({ id: 'l', quantity: 2, wellnessPricingId: 'w90', product: wellness() }, 'wellness').line
    expect(chosen?.status).toEqual({ kind: 'priced', unitPrice: 2040, total: 4080 })

    const notChosen = line({ id: 'l', quantity: 1, product: wellness() }, 'wellness').line
    expect(notChosen?.status).toEqual({ kind: 'blocked', reason: 'needs-duration' })
  })

  it('ignores a fixed price on a wellness service and flags it', () => {
    const { line: result, issues } = line({ id: 'l', quantity: 1, product: wellness({ price: 999 }) }, 'wellness')
    expect(result?.status).toEqual({ kind: 'blocked', reason: 'needs-duration' })
    expect(issues.map((i) => i.code)).toContain('wellness-price-ignored')
  })

  it('treats a selected duration the product no longer offers as not chosen', () => {
    const { line: result, issues } = line({ id: 'l', quantity: 1, wellnessPricingId: 'w30', product: wellness() }, 'wellness')
    expect(result?.selectedDurationId).toBeNull()
    expect(issues.map((i) => i.code)).toContain('unknown-duration-selected')
  })

  it('drops broken duration options and blocks when none are left', () => {
    const { line: result, issues } = line(
      {
        id: 'l',
        quantity: 1,
        product: wellness({
          wellnessPricing: [
            { id: 'a', durationInMinutes: 60, amount_after_service_charge: null },
            { id: 'b', durationInMinutes: 0, amount_after_service_charge: 100 },
            { durationInMinutes: 30, amount_after_service_charge: 100 },
          ],
        }),
      },
      'wellness',
    )
    expect(result?.durations).toEqual([])
    expect(result?.status).toEqual({ kind: 'blocked', reason: 'no-durations' })
    expect(issues.filter((i) => i.code === 'invalid-duration-option')).toHaveLength(3)
  })

  it.each([
    ['a missing price', { price: null }, 'price-missing'],
    ['a malformed price', { price: '1,200' }, 'price-missing'],
    ['a negative price', { price: -5 }, 'price-missing'],
    ['a malformed currency', { currency: 'baht' }, 'price-missing'],
  ])('blocks a line with %s rather than counting it as zero', (_, overrides, reason) => {
    expect(line({ id: 'l', quantity: 1, product: product(overrides) }).line?.status).toEqual({ kind: 'blocked', reason })
  })

  it('accepts a lower-case currency code', () => {
    expect(line({ id: 'l', quantity: 1, product: product({ currency: ' thb ' }) }).line?.currency).toBe('THB')
  })

  it.each([0, -1, 1.5, '2', null])('blocks a quantity of %j', (quantity) => {
    expect(line({ id: 'l', quantity, product: product() }).line?.status).toEqual({
      kind: 'blocked',
      reason: 'invalid-quantity',
    })
  })

  it('treats a product without an id as removed', () => {
    expect(line({ id: 'l', quantity: 1, product: { title: 'Ghost' } }).line?.status).toEqual({ kind: 'unavailable' })
    expect(line({ id: 'l', quantity: 1, product: null }).line?.status).toEqual({ kind: 'unavailable' })
  })

  it('skips a line without an id, since nothing can be done with it', () => {
    const { line: result, issues } = line({ quantity: 1, product: product() })
    expect(result).toBeNull()
    expect(issues.map((i) => i.code)).toEqual(['line-without-id'])
  })

  it('flags a product whose type differs from its group, but keeps it in the group', () => {
    const { line: result, issues } = line({ id: 'l', quantity: 1, product: product({ type: 'package' }) })
    expect(result?.status.kind).toBe('priced')
    expect(issues.map((i) => i.code)).toEqual(['type-differs-from-group'])
  })

  it('tidies the title and falls back when it is missing', () => {
    expect(line({ id: 'l', quantity: 1, product: product({ title: '  CBC   Profile ' }) }).line?.title).toBe('CBC Profile')
    expect(line({ id: 'l', quantity: 1, product: product({ title: '' }) }).line?.title).toBe('Unnamed service')
  })
})

describe('normaliseCart with messy groups', () => {
  it('recomputes totals and flags server subtotals that disagree', () => {
    const cart = normaliseCart({
      groups: [{ type: 'lab_test', subtotals: { THB: 999 }, items: [{ id: 'l', quantity: 2, product: product() }] }],
    })
    expect(cart.groups[0].subtotals).toEqual([{ currency: 'THB', amount: 200 }])
    expect(cart.issues.map((i) => i.code)).toEqual(['subtotal-mismatch'])
  })

  it('keeps an unavailable line in a typed group out of the order without blocking it', () => {
    const cart = normaliseCart({
      groups: [
        {
          type: 'lab_test',
          subtotals: { THB: 100 },
          items: [
            { id: 'a', quantity: 1, product: product() },
            { id: 'b', quantity: 1, product: {} },
          ],
        },
      ],
    })
    expect(cart.groups[0]).toMatchObject({ ready: true, blockers: [], excludedLineIds: ['b'] })
  })

  it('merges a repeated group type and drops empty or malformed groups', () => {
    const cart = normaliseCart({
      groups: [
        { type: 'lab_test', items: [{ id: 'a', quantity: 1, product: product() }] },
        { type: 'lab_test', items: [{ id: 'b', quantity: 1, product: product() }] },
        { type: 'package', items: [] },
        { type: 'service' },
      ],
    })
    expect(cart.groups.map((g) => [g.type, g.lines.map((l) => l.id)])).toEqual([['lab_test', ['a', 'b']]])
    expect(cart.issues.map((i) => i.code)).toEqual(['duplicate-group', 'malformed-group'])
  })
})

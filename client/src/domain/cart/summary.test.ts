/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { normaliseCart } from './normalise'
import type { RawCart } from './raw'
import { checkoutItems, summariseCart } from './summary'
import { totalsByCurrency } from './totals'

const { serverCart } = JSON.parse(
  readFileSync(new URL('../../../../server/data/task2-cart.json', import.meta.url), 'utf8'),
) as { serverCart: RawCart }

describe('summariseCart with the server cart from the data file', () => {
  it('totals each currency across groups without adding currencies together', () => {
    expect(summariseCart(normaliseCart(serverCart))).toEqual({
      totals: [
        { currency: 'INR', amount: 23009.5 },
        { currency: 'NPR', amount: 12520 },
        { currency: 'THB', amount: 1677 + 15230 },
      ],
      orderCount: 3,
      readyOrderCount: 2,
      unpricedCount: 1,
      unavailableCount: 1,
    })
  })

  it('adds the facial once its duration is chosen', () => {
    const groups = structuredClone(serverCart.groups)
    groups[1].items = (groups[1].items as object[]).map((item) => ({
      ...item,
      wellnessPricingId: 'a1b2c3d4-0000-4000-8000-000000000060',
    }))
    const summary = summariseCart(normaliseCart({ ...serverCart, groups }))
    expect(summary.totals.find((t) => t.currency === 'THB')?.amount).toBe(1677 + 15230 + 1800)
    expect(summary).toMatchObject({ readyOrderCount: 3, unpricedCount: 0 })
  })
})

describe('checkoutItems', () => {
  const cart = normaliseCart(serverCart)

  it('sends every line of a ready group as the customer sees it', () => {
    expect(checkoutItems(cart.groups.find((g) => g.type === 'lab_test')!)).toEqual([
      { lineId: 'dbd4cac2-eb2b-4dc7-867e-0d5c13226036', quantity: 1, wellnessPricingId: null },
      { lineId: '76d58b51-449b-4f90-a936-1b6008dcf67d', quantity: 2, wellnessPricingId: null },
      { lineId: '6caa435e-3e83-4c53-9e92-80b0f006a6eb', quantity: 1, wellnessPricingId: null },
    ])
  })

  it('refuses a group that is not ready', () => {
    expect(() => checkoutItems(cart.groups.find((g) => g.type === 'wellness')!)).toThrow(/not ready/)
  })
})

describe('totalsByCurrency', () => {
  it('sums in cents and sorts by currency', () => {
    expect(
      totalsByCurrency([
        { currency: 'THB', amount: 0.1 },
        { currency: 'INR', amount: 5 },
        { currency: 'THB', amount: 0.2 },
      ]),
    ).toEqual([
      { currency: 'INR', amount: 5 },
      { currency: 'THB', amount: 0.3 },
    ])
  })
})

import { describe, expect, it } from 'vitest'
import { loadCartData } from '../cartData.js'
import { buildCart, unitPrice } from './cart.js'
import { CartStore, MAX_QUANTITY } from './cartStore.js'
import type { CartLine } from './types.js'

const { serverLines } = loadCartData()

const LIVER_PROFILE = '76d58b51-449b-4f90-a936-1b6008dcf67d'
const FACIAL = 'e38e2e25-84d4-4843-85e8-a362c3dec25a'
const REMOVED = '7a15eb5e-0e1b-4cb1-9cf6-bd4344b569be'
const FACIAL_90 = 'a1b2c3d4-0000-4000-8000-000000000090'

describe('buildCart', () => {
  it('reproduces the groups and totals of the seed cart', () => {
    const cart = buildCart(serverLines)
    expect(cart.groups.map((g) => [g.type, g.itemCount, g.unpricedItems, g.subtotals])).toEqual([
      ['lab_test', 4, 0, { THB: 1677, NPR: 12520 }],
      ['wellness', 1, 1, {}],
      ['package', 2, 0, { THB: 15230, INR: 23009.5 }],
      ['unknown', 1, 1, {}],
    ])
    expect(cart.totalItems).toBe(8)
  })

  it('never adds currencies together and sums fractions exactly', () => {
    const line = (id: string, currency: string, price: number, quantity: number): CartLine => ({
      id,
      productId: id,
      quantity,
      product: { id, title: id, type: 'package', currency, providerId: 1, providerName: 'P', price },
    })
    const cart = buildCart([line('a', 'INR', 0.1, 3), line('b', 'INR', 0.2, 1), line('c', 'THB', 5, 2)])
    expect(cart.groups[0].subtotals).toEqual({ INR: 0.5, THB: 10 })
  })

  it('leaves a wellness line unpriced until a duration is chosen, never zero', () => {
    const facial = serverLines.find((l) => l.id === FACIAL)!
    expect(facial.wellnessPricingId).toBeNull()
    expect(unitPrice(facial)).toBeNull()
    expect(unitPrice({ ...facial, wellnessPricingId: FACIAL_90 })).toBe(2040)
  })
})

describe('CartStore', () => {
  it('prices the wellness group once a duration is chosen', () => {
    const store = new CartStore(serverLines)
    store.selectWellnessOption(FACIAL, FACIAL_90)
    const wellness = store.cart.groups.find((g) => g.type === 'wellness')!
    expect(wellness).toMatchObject({ unpricedItems: 0, subtotals: { THB: 2040 } })
  })

  it('refuses quantities above the limit with a 409', () => {
    const store = new CartStore(serverLines)
    expect(() => store.setQuantity(LIVER_PROFILE, MAX_QUANTITY + 1)).toThrow(
      expect.objectContaining({ status: 409, code: 'quantity_limit' }),
    )
    store.setQuantity(LIVER_PROFILE, MAX_QUANTITY)
    expect(store.line(LIVER_PROFILE)?.quantity).toBe(MAX_QUANTITY)
  })

  it('only lets a removed product be deleted', () => {
    const store = new CartStore(serverLines)
    expect(() => store.setQuantity(REMOVED, 2)).toThrow(expect.objectContaining({ status: 409, code: 'unavailable' }))
    store.remove(REMOVED)
    store.remove(REMOVED)
    expect(store.cart.groups.map((g) => g.type)).not.toContain('unknown')
  })

  it('rejects a duration the product does not offer', () => {
    const store = new CartStore(serverLines)
    expect(() => store.selectWellnessOption(FACIAL, 'nope')).toThrow(
      expect.objectContaining({ status: 409, code: 'option_unavailable' }),
    )
  })

  it('reset restores the seed even after changes', () => {
    const store = new CartStore(serverLines)
    store.setQuantity(LIVER_PROFILE, 5)
    store.remove(FACIAL)
    store.reset()
    expect(store.cart).toEqual(buildCart(serverLines))
  })
})

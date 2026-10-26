import { beforeEach, describe, expect, it } from 'vitest'
import { loadCartData } from '../cartData.js'
import { CartStore } from './cartStore.js'
import { mergeGuestCart } from './merge.js'
import type { CartLine } from './types.js'

const { catalog: products, serverLines, guestCart } = loadCartData()
const catalog = new Map(products.map((product) => [product.id, product]))

const LIVER_PROFILE = '7bcdaf5b-7874-4061-83ee-ef9c954ffcaf'
const LIPID_PROFILE = '6a92d368-a25a-4e00-89ce-77d69da06b45'
const FACIAL = '5f0c1a52-6b1e-4c1f-9a51-000000000003'
const FACIAL_LINE = 'e38e2e25-84d4-4843-85e8-a362c3dec25a'
const FACIAL_60 = 'a1b2c3d4-0000-4000-8000-000000000060'
const FACIAL_90 = 'a1b2c3d4-0000-4000-8000-000000000090'
const NOT_IN_CATALOG = '6b572fa4-4559-4dfd-a276-9c1400ce208e'

let cart: CartStore
let ids: number

const merge = (items: unknown[]) => mergeGuestCart(cart, catalog, items, () => `new-${++ids}`)
const linesOf = (productId: string): CartLine[] =>
  cart.cart.groups.flatMap((g) => g.items).filter((line) => line.productId === productId)

beforeEach(() => {
  cart = new CartStore(serverLines)
  ids = 0
})

describe('mergeGuestCart with the guest cart from the data file', () => {
  it('reports one change per overlap', () => {
    expect(merge(guestCart)).toEqual([
      {
        kind: 'kept_larger_quantity',
        productId: LIVER_PROFILE,
        lineId: '76d58b51-449b-4f90-a936-1b6008dcf67d',
        title: 'Liver Function Profile',
        quantity: 3,
        accountQuantity: 2,
        guestQuantity: 3,
      },
      { kind: 'added', productId: LIPID_PROFILE, lineId: 'new-1', title: 'Lipid Profile', quantity: 1 },
      {
        kind: 'duration_applied',
        productId: FACIAL,
        lineId: FACIAL_LINE,
        title: 'Signature Facial',
        wellnessPricingId: FACIAL_90,
        durationInMinutes: 90,
      },
      { kind: 'not_offered', productId: NOT_IN_CATALOG },
    ])
  })

  it('leaves a cart with the right groups and totals', () => {
    merge(guestCart)
    const groups = Object.fromEntries(cart.cart.groups.map((g) => [g.type, g]))
    expect(groups.lab_test).toMatchObject({ itemCount: 6, subtotals: { THB: 1677 + 984.4, NPR: 4760 * 3 + 3000 } })
    expect(groups.wellness).toMatchObject({ itemCount: 1, unpricedItems: 0, subtotals: { THB: 2040 } })
    expect(linesOf(FACIAL)).toHaveLength(1)
  })

  it('is safe to repeat: a second merge changes nothing', () => {
    merge(guestCart)
    const after = cart.cart
    const again = merge(guestCart)
    expect(cart.cart).toEqual(after)
    expect(again.map((c) => c.kind)).toEqual(['already_in_cart', 'already_in_cart', 'already_in_cart', 'not_offered'])
  })
})

describe('mergeGuestCart edge cases', () => {
  it('keeps the account quantity when it is the larger one', () => {
    expect(merge([{ productId: LIVER_PROFILE, quantity: 1 }])).toMatchObject([{ kind: 'already_in_cart', quantity: 2 }])
    expect(linesOf(LIVER_PROFILE)[0].quantity).toBe(2)
  })

  it('keeps two different durations of the same service as separate bookings', () => {
    cart.selectWellnessOption(FACIAL_LINE, FACIAL_60)
    expect(merge([{ productId: FACIAL, quantity: 1, wellnessPricingId: FACIAL_90 }])).toMatchObject([{ kind: 'added' }])
    expect(linesOf(FACIAL).map((l) => l.wellnessPricingId)).toEqual([FACIAL_60, FACIAL_90])
  })

  it('folds a guest item without a duration into the existing line', () => {
    cart.selectWellnessOption(FACIAL_LINE, FACIAL_60)
    expect(merge([{ productId: FACIAL, quantity: 1 }])).toMatchObject([{ kind: 'already_in_cart', lineId: FACIAL_LINE }])
  })

  it('adds a service with a duration that is no longer offered, and asks for a new choice', () => {
    cart.remove(FACIAL_LINE)
    expect(merge([{ productId: FACIAL, quantity: 1, wellnessPricingId: 'gone' }])).toMatchObject([
      { kind: 'added', lineId: 'new-1' },
      { kind: 'duration_not_offered', lineId: 'new-1' },
    ])
    expect(linesOf(FACIAL)[0].wellnessPricingId).toBeNull()
  })

  it('caps a quantity above the booking limit', () => {
    expect(merge([{ productId: LIVER_PROFILE, quantity: 50 }])).toMatchObject([
      { kind: 'kept_larger_quantity', quantity: 10, guestQuantity: 50 },
      { kind: 'quantity_capped', requested: 50, quantity: 10 },
    ])
  })

  it('skips unreadable items without blocking the rest', () => {
    const changes = merge([null, { productId: LIPID_PROFILE, quantity: 0 }, { quantity: 1 }, { productId: LIPID_PROFILE, quantity: 1 }])
    expect(changes.map((c) => c.kind)).toEqual(['invalid_item', 'invalid_item', 'invalid_item', 'added'])
    expect(changes[1]).toEqual({ kind: 'invalid_item', index: 1, productId: LIPID_PROFILE })
  })

  it('merges duplicate guest items with the same rule', () => {
    merge([
      { productId: LIPID_PROFILE, quantity: 2 },
      { productId: LIPID_PROFILE, quantity: 4 },
    ])
    expect(linesOf(LIPID_PROFILE)).toMatchObject([{ quantity: 4 }])
  })
})

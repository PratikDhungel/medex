import { beforeEach, describe, expect, it } from 'vitest'
import { loadCartData } from '../cartData.js'
import { CartStore } from './cartStore.js'
import { OrderService, type CheckoutRequest, type Settlement } from './orders.js'

const { serverLines } = loadCartData()

const PACKAGE_LINES = ['41441093-cddb-4322-9bc8-d4f4959646c1', '13068e11-594e-4a03-a7ec-2f0f8fc2dd01']
const FACIAL = 'e38e2e25-84d4-4843-85e8-a362c3dec25a'

let cart: CartStore
let orders: OrderService
let settlement: Settlement
let pending: (() => void)[]

/** Runs the payment provider's callbacks, as if its delay had passed */
const settleAll = () => pending.splice(0).forEach((run) => run())

const packageCheckout = (overrides: Partial<CheckoutRequest> = {}): CheckoutRequest => ({
  groupType: 'package',
  items: PACKAGE_LINES.map((lineId) => ({ lineId, quantity: 1 })),
  paymentMethod: 'card',
  idempotencyKey: 'key-package-1',
  ...overrides,
})

beforeEach(() => {
  cart = new CartStore(serverLines)
  settlement = { outcome: 'paid', afterMs: 0 }
  pending = []
  orders = new OrderService(cart, () => settlement, (run) => pending.push(run))
})

describe('OrderService.checkout', () => {
  it('creates a pending order, takes its lines out of the cart, then settles', () => {
    const result = orders.checkout(packageCheckout())
    expect(result.status).toBe('pending')
    expect(cart.cart.groups.map((g) => g.type)).not.toContain('package')
    expect(orders.order(result.orderId)?.totals).toEqual({ THB: 15230, INR: 23009.5 })

    settleAll()
    expect(orders.order(result.orderId)?.status).toBe('paid')
  })

  it('returns the same order for a repeated key and never creates a second one', () => {
    const first = orders.checkout(packageCheckout())
    const again = orders.checkout(packageCheckout())
    expect(again).toEqual(first)
    expect(pending).toHaveLength(1)

    settleAll()
    expect(orders.checkout(packageCheckout())).toEqual({ orderId: first.orderId, status: 'paid' })
  })

  it('refuses a key reused for a different request', () => {
    orders.checkout(packageCheckout())
    cart.reset()
    expect(() => orders.checkout(packageCheckout({ paymentMethod: 'pay_at_clinic' }))).toThrow(
      expect.objectContaining({ status: 409, code: 'idempotency_key_reused' }),
    )
  })

  it('treats the same items in a different order as the same request', () => {
    const first = orders.checkout(packageCheckout())
    const reordered = packageCheckout()
    reordered.items.reverse()
    expect(orders.checkout(reordered)).toEqual(first)
  })

  it('lists every item that no longer matches the cart, and stores nothing', () => {
    const request = packageCheckout({
      items: [
        { lineId: PACKAGE_LINES[0], quantity: 2 },
        { lineId: 'gone', quantity: 1 },
        { lineId: FACIAL, quantity: 1 },
      ],
    })
    expect(() => orders.checkout(request)).toThrow(
      expect.objectContaining({
        status: 409,
        code: 'cart_changed',
        details: {
          mismatches: [
            { lineId: PACKAGE_LINES[0], reason: 'quantity_changed' },
            { lineId: 'gone', reason: 'not_in_cart' },
            { lineId: FACIAL, reason: 'wrong_group' },
          ],
        },
      }),
    )
    // The same key works once the request is fixed
    expect(orders.checkout(packageCheckout()).status).toBe('pending')
  })

  it('refuses a wellness item until its duration is chosen', () => {
    const request: CheckoutRequest = {
      groupType: 'wellness',
      items: [{ lineId: FACIAL, quantity: 1, wellnessPricingId: null }],
      paymentMethod: 'pay_at_clinic',
      idempotencyKey: 'key-wellness-1',
    }
    expect(() => orders.checkout(request)).toThrow(
      expect.objectContaining({ details: { mismatches: [{ lineId: FACIAL, reason: 'price_unknown' }] } }),
    )
  })

  it('puts the lines back in the cart when a card payment fails', () => {
    settlement = { outcome: 'failed', afterMs: 0 }
    const { orderId } = orders.checkout(packageCheckout())
    settleAll()
    expect(orders.order(orderId)?.status).toBe('failed')
    expect(cart.cart.groups.find((g) => g.type === 'package')?.items.map((l) => l.id)).toEqual(PACKAGE_LINES)
  })

  it('keeps pay-at-clinic orders pending, since payment happens at the visit', () => {
    const { orderId } = orders.checkout(packageCheckout({ paymentMethod: 'pay_at_clinic' }))
    expect(pending).toHaveLength(0)
    expect(orders.order(orderId)?.status).toBe('pending')
  })
})

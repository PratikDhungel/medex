import { Router, type Request, type Response } from 'express'
import type { CartStore } from './cart/cartStore.js'
import { ApiError } from './cart/errors.js'
import { mergeGuestCart } from './cart/merge.js'
import type { CheckoutItem, CheckoutRequest, OrderService } from './cart/orders.js'
import type { GuestCartItem, PaymentMethod, Product } from './cart/types.js'
import { mockNetwork } from './mock.js'
import { parseMockConfig, sendInjectedFailure, type MockRules } from './mockRules.js'

interface CartRouterDeps {
  cart: CartStore
  orders: OrderService
  rules: MockRules
  catalog: ReadonlyMap<string, Product>
  guestCart: GuestCartItem[]
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isPositiveInteger = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 1

const badRequest = (message: string) => new ApiError(400, 'invalid_request', message)

/**
 * Sends a success response, unless a mock rule asked for this request to fail
 * after its work was done (see MockRules).
 */
function send(req: Request, res: Response, status: number, body?: unknown) {
  const failAfter = res.locals.failAfter as number | undefined
  if (failAfter !== undefined) return sendInjectedFailure(req, res, failAfter)
  if (body === undefined) res.status(status).end()
  else res.status(status).json(body)
}

function parseCheckout(body: unknown): CheckoutRequest {
  if (!isObject(body)) throw badRequest('Expected a JSON object')
  const { groupType, items, paymentMethod, idempotencyKey } = body

  if (typeof groupType !== 'string' || groupType === '') throw badRequest('"groupType" is required')
  if (paymentMethod !== 'card' && paymentMethod !== 'pay_at_clinic') {
    throw badRequest('"paymentMethod" must be "card" or "pay_at_clinic"')
  }
  if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8) {
    throw badRequest('"idempotencyKey" must be a string of at least 8 characters')
  }
  if (!Array.isArray(items) || items.length === 0) throw badRequest('"items" must be a non-empty array')

  const parsed: CheckoutItem[] = items.map((item, index) => {
    if (!isObject(item) || typeof item.lineId !== 'string' || !isPositiveInteger(item.quantity)) {
      throw badRequest(`items[${index}] needs a "lineId" and a positive whole "quantity"`)
    }
    const { wellnessPricingId } = item
    if (wellnessPricingId !== undefined && wellnessPricingId !== null && typeof wellnessPricingId !== 'string') {
      throw badRequest(`items[${index}].wellnessPricingId must be a string or null`)
    }
    return { lineId: item.lineId, quantity: item.quantity, wellnessPricingId }
  })
  if (new Set(parsed.map((item) => item.lineId)).size !== parsed.length) {
    throw badRequest('Each cart line can appear only once in "items"')
  }

  return { groupType, items: parsed, paymentMethod: paymentMethod as PaymentMethod, idempotencyKey }
}

export function createCartRouter({ cart, orders, rules, catalog, guestCart }: CartRouterDeps): Router {
  const router = Router()

  router.get('/cart', mockNetwork('cart'), rules.middleware('getCart'), (req, res) => {
    send(req, res, 200, { cart: cart.cart })
  })

  router.patch('/cart/items/:lineId', mockNetwork('cart'), rules.middleware('updateLine'), (req, res) => {
    if (!isObject(req.body)) throw badRequest('Expected a JSON object')
    const { quantity, wellnessPricingId } = req.body
    if (quantity === undefined && wellnessPricingId === undefined) {
      throw badRequest('Send "quantity", "wellnessPricingId" or both')
    }
    if (quantity !== undefined && !isPositiveInteger(quantity)) {
      throw badRequest('"quantity" must be a whole number of at least 1; use DELETE to remove an item')
    }
    if (wellnessPricingId !== undefined && typeof wellnessPricingId !== 'string') {
      throw badRequest('"wellnessPricingId" must be a string')
    }

    const lineId = String(req.params.lineId)
    if (wellnessPricingId !== undefined) cart.selectWellnessOption(lineId, wellnessPricingId)
    if (quantity !== undefined) cart.setQuantity(lineId, quantity)
    send(req, res, 200, { cart: cart.cart })
  })

  router.delete('/cart/items/:lineId', mockNetwork('cart'), rules.middleware('removeLine'), (req, res) => {
    cart.remove(String(req.params.lineId))
    send(req, res, 204)
  })

  // Items are checked one by one in mergeGuestCart, so one bad item doesn't block the rest
  router.post('/cart/merge', mockNetwork('cart'), rules.middleware('mergeCart'), (req, res) => {
    if (!isObject(req.body) || !Array.isArray(req.body.items)) throw badRequest('"items" must be an array')
    const changes = mergeGuestCart(cart, catalog, req.body.items)
    send(req, res, 200, { cart: cart.cart, changes })
  })

  router.post('/checkout', mockNetwork('checkout'), rules.middleware('checkout'), (req, res) => {
    send(req, res, 201, orders.checkout(parseCheckout(req.body)))
  })

  router.get('/orders/:orderId', mockNetwork('orders'), rules.middleware('getOrder'), (req, res) => {
    const order = orders.order(String(req.params.orderId))
    if (!order) throw new ApiError(404, 'order_not_found', 'We could not find this order.')
    send(req, res, 200, order)
  })

  /** Products a customer can add; the client uses it to show a guest's cart, which holds only product ids */
  router.get('/catalog', mockNetwork('catalog'), (_req, res) => {
    res.json([...catalog.values()])
  })

  // Dev-only controls for the mock, used by the client's dev panel
  router.get('/__mock/config', (_req, res) => {
    res.json(rules.current)
  })

  router.put('/__mock/config', (req, res) => {
    const config = parseMockConfig(req.body)
    if (typeof config === 'string') throw badRequest(config)
    rules.set(config)
    res.json(rules.current)
  })

  /** Restores the seed cart and forgets all orders. Rules are kept. */
  router.post('/__mock/reset', (_req, res) => {
    cart.reset()
    orders.reset()
    res.status(204).end()
  })

  /** The guest cart from the data file, so the client can seed "this device" with it */
  router.get('/__mock/guest-cart', (_req, res) => {
    res.json(guestCart)
  })

  return router
}

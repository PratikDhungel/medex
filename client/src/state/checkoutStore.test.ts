import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api/client'
import type { CheckoutRequest } from '@/api/orders'
import type { NewOrder } from '@/domain/checkout/machine'
import type { PlacedOrder } from '@/domain/checkout/model'
import { STORAGE_KEY, type SessionStorageLike } from '@/domain/checkout/storage'
import { CheckoutStore } from './checkoutStore'

const items = [{ lineId: 'l1', quantity: 1, wellnessPricingId: null }]
const newOrder = (groupType: string, paymentMethod: NewOrder['paymentMethod'] = 'card'): NewOrder => ({
  groupType,
  providers: [],
  items,
  totals: [{ currency: 'THB', amount: 100 }],
  paymentMethod,
})

function memoryStorage(): SessionStorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

/** A store whose server answers come from `respond`, with every request recorded */
function setup(
  respond: (request: CheckoutRequest, attempt: number) => PlacedOrder | Error,
  storage = memoryStorage(),
  network: { online: boolean; reconnect?: () => void } = { online: true },
) {
  const requests: CheckoutRequest[] = []
  const statuses = new Map<string, PlacedOrder['status']>()
  let keys = 0
  let cartChanges = 0
  /** Status checks wait here until the test lets them through */
  const sleepers: (() => void)[] = []

  const store = new CheckoutStore({
    storage,
    placeOrder: async (request) => {
      requests.push(request)
      const result = respond(request, requests.filter((r) => r.groupType === request.groupType).length)
      if (result instanceof Error) throw result
      statuses.set(result.orderId, result.status)
      return result
    },
    getOrder: async (orderId) => ({ orderId, status: statuses.get(orderId) ?? 'pending' }),
    newKey: () => `key-${++keys}`,
    now: () => '2026-10-26T00:00:00Z',
    onCartChanged: () => void (cartChanges += 1),
    sleep: () => new Promise<void>((resolve) => sleepers.push(resolve)),
    isOnline: () => network.online,
    onOnline: (callback) => {
      network.reconnect = callback
    },
  })

  const phases = () => Object.fromEntries(store.getSnapshot()!.orders.map((o) => [o.groupType, o.phase.kind]))
  const settle = async () => {
    for (let i = 0; i < 10; i += 1) await tick()
  }
  const wakePollers = async () => {
    sleepers.splice(0).forEach((wake) => wake())
    await settle()
  }
  return { store, requests, statuses, storage, phases, settle, wakePollers, cartChanges: () => cartChanges }
}

const placed = (orderId: string, status: PlacedOrder['status'] = 'pending'): PlacedOrder => ({ orderId, status })
const serverError = () => new ApiError('http', '/checkout', 'boom', 500)

describe('CheckoutStore', () => {
  it('places every order, one at a time, in order', async () => {
    const { store, requests, phases, settle, cartChanges } = setup((r) => placed(`o-${r.groupType}`))
    store.start([newOrder('lab_test'), newOrder('package'), newOrder('wellness', 'pay_at_clinic')])
    await settle()

    expect(requests.map((r) => r.groupType)).toEqual(['lab_test', 'package', 'wellness'])
    expect(new Set(requests.map((r) => r.idempotencyKey)).size).toBe(3)
    expect(phases()).toEqual({ lab_test: 'confirming', package: 'confirming', wellness: 'booked' })
    expect(cartChanges()).toBe(3)
  })

  it('carries on past a failure, then retries only that order with the same key', async () => {
    const { store, requests, phases, settle } = setup((r, attempt) =>
      r.groupType === 'package' && attempt === 1 ? serverError() : placed(`o-${r.groupType}`, 'paid'),
    )
    store.start([newOrder('lab_test'), newOrder('package'), newOrder('wellness')])
    await settle()
    expect(phases()).toEqual({ lab_test: 'paid', package: 'interrupted', wellness: 'paid' })

    store.retry('package')
    await settle()
    expect(phases().package).toBe('paid')
    expect(requests.map((r) => r.groupType)).toEqual(['lab_test', 'package', 'wellness', 'package'])
    expect(requests[3].idempotencyKey).toBe(requests[1].idempotencyKey)
  })

  it('uses a new key after a decline, with the method the customer switched to', async () => {
    const { store, requests, settle } = setup((_, attempt) =>
      attempt === 1 ? new ApiError('http', '/checkout', 'declined', 402, { code: 'payment_declined' }) : placed('o1'),
    )
    store.start([newOrder('lab_test')])
    await settle()
    store.setMethod('lab_test', 'pay_at_clinic')
    store.retry('lab_test')
    await settle()

    expect(requests.map((r) => [r.paymentMethod, r.idempotencyKey])).toEqual([
      ['card', 'key-2'],
      ['pay_at_clinic', 'key-3'],
    ])
  })

  it('saves the session before the request goes out', async () => {
    const storage = memoryStorage()
    let savedWhenSent: string | undefined
    const { store, settle } = setup(() => {
      savedWhenSent = JSON.parse(storage.data.get(STORAGE_KEY)!).orders[0].phase.kind
      return placed('o1')
    }, storage)
    store.start([newOrder('lab_test')])
    await settle()
    expect(savedWhenSent).toBe('submitting')
  })

  it('checks a card payment until it settles, and reloads the cart if it failed', async () => {
    const { store, statuses, phases, settle, wakePollers, cartChanges } = setup(() => placed('o1'))
    store.start([newOrder('lab_test')])
    await settle()
    expect(phases().lab_test).toBe('confirming')

    await wakePollers()
    expect(phases().lab_test).toBe('confirming')

    statuses.set('o1', 'failed')
    await wakePollers()
    expect(phases().lab_test).toBe('payment_failed')
    expect(cartChanges()).toBe(2)
  })

  it('resumes from storage: resends a request that was cut off, with the same key, and checks a confirming payment', async () => {
    const storage = memoryStorage()
    // The package request never answers: the page goes away while it's out
    const first = setup((r) => (r.groupType === 'lab_test' ? placed('o1') : (new Promise(() => {}) as never)), storage)
    first.store.start([newOrder('lab_test'), newOrder('package')])
    await first.settle()
    const cutOffKey = first.requests[1].idempotencyKey

    // A new page load reads what the old one saved, and sorts it out by itself
    const second = setup(() => placed('o2', 'paid'), storage)
    second.statuses.set('o1', 'paid')
    await second.settle()
    expect(second.requests.map((r) => [r.groupType, r.idempotencyKey])).toEqual([['package', cutOffKey]])
    expect(second.phases()).toEqual({ lab_test: 'confirming', package: 'paid' })

    await second.wakePollers()
    expect(second.phases().lab_test).toBe('paid')
  })

  it('waits for a connection before resending, then resends on reconnect', async () => {
    const storage = memoryStorage()
    const first = setup(() => new Promise(() => {}) as never, storage)
    first.store.start([newOrder('lab_test')])
    await first.settle()

    const network = { online: false, reconnect: undefined as (() => void) | undefined }
    const second = setup(() => placed('o1', 'paid'), storage, network)
    await second.settle()
    expect(second.requests).toHaveLength(0)
    expect(second.phases().lab_test).toBe('interrupted')

    network.online = true
    network.reconnect?.()
    await second.settle()
    expect(second.phases().lab_test).toBe('paid')
  })

  it('resends an order that failed because the customer was offline, once back online', async () => {
    const network = { online: true, reconnect: undefined as (() => void) | undefined }
    const { store, phases, settle, requests } = setup(
      (_, attempt) => (attempt === 1 ? new ApiError('offline', '/checkout', 'offline') : placed('o1', 'paid')),
      memoryStorage(),
      network,
    )
    store.start([newOrder('lab_test')])
    await settle()
    expect(phases().lab_test).toBe('interrupted')

    network.reconnect?.()
    await settle()
    expect(phases().lab_test).toBe('paid')
    expect(requests[1].idempotencyKey).toBe(requests[0].idempotencyKey)
  })

  it('leaves a server error for the customer to retry', async () => {
    const { store, phases, settle, requests } = setup(() => serverError())
    store.start([newOrder('lab_test')])
    await settle()
    store.resume()
    await settle()
    expect(phases().lab_test).toBe('interrupted')
    expect(requests).toHaveLength(1)
  })

  it('forgets the session when cleared', async () => {
    const { store, storage, settle } = setup(() => placed('o1', 'paid'))
    store.start([newOrder('lab_test')])
    await settle()
    store.clear()
    expect(store.getSnapshot()).toBeNull()
    expect(storage.data.size).toBe(0)
  })
})

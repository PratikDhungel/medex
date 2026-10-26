import { describe, expect, it } from 'vitest'
import {
  canChangeMethod,
  checkoutReducer,
  classifyCheckoutError,
  createSession,
  isRunning,
  nextQueued,
  type CheckoutEvent,
  type CheckoutSession,
  type GroupOrder,
} from './machine'

const items = [{ lineId: 'l1', quantity: 1, wellnessPricingId: null }]
const totals = [{ currency: 'THB', amount: 100 }]

const start = () =>
  createSession('s1', '2026-10-26T00:00:00Z', [
    { groupType: 'lab_test', items, totals, paymentMethod: 'card' },
    { groupType: 'package', items, totals, paymentMethod: 'card' },
    { groupType: 'wellness', items, totals, paymentMethod: 'pay_at_clinic' },
  ])

const run = (session: CheckoutSession, ...events: CheckoutEvent[]) => events.reduce(checkoutReducer, session)
const order = (session: CheckoutSession, groupType: string) => session.orders.find((o) => o.groupType === groupType)!

const submit = (groupType: string, newKey = `key-${groupType}`): CheckoutEvent => ({ type: 'submitting', groupType, newKey })
const placed = (groupType: string, status: 'pending' | 'paid' | 'failed' = 'pending'): CheckoutEvent => ({
  type: 'placed',
  groupType,
  order: { orderId: `order-${groupType}`, status },
})
const failed = (groupType: string, failure: Extract<CheckoutEvent, { type: 'failed' }>['failure']): CheckoutEvent => ({
  type: 'failed',
  groupType,
  failure,
})

describe('checkoutReducer: the happy path', () => {
  it('submits orders one at a time, in order', () => {
    let session = start()
    expect(nextQueued(session)?.groupType).toBe('lab_test')
    session = run(session, submit('lab_test'), placed('lab_test'))
    expect(nextQueued(session)?.groupType).toBe('package')
  })

  it('confirms a card payment, then marks it paid', () => {
    const session = run(start(), submit('lab_test'), placed('lab_test'))
    expect(order(session, 'lab_test').phase).toEqual({ kind: 'confirming', orderId: 'order-lab_test' })
    expect(order(run(session, { type: 'status', groupType: 'lab_test', status: 'paid' }), 'lab_test').phase).toEqual({
      kind: 'paid',
      orderId: 'order-lab_test',
    })
  })

  // The runner decides the order (nextQueued); the reducer only checks each order's own phase
  it('treats a pending pay-at-clinic order as booked', () => {
    const session = run(
      start(),
      submit('lab_test'),
      placed('lab_test'),
      submit('package'),
      placed('package'),
      submit('wellness'),
      placed('wellness'),
    )
    expect(order(session, 'wellness').phase).toEqual({ kind: 'booked', orderId: 'order-wellness' })
    expect(isRunning(session)).toBe(false)
  })
})

describe('checkoutReducer: the second of three fails', () => {
  const session = run(
    start(),
    submit('lab_test'),
    placed('lab_test', 'paid'),
    submit('package'),
    failed('package', { kind: 'interrupted', reason: 'server' }),
  )

  it('keeps the first order and moves on to the third', () => {
    expect(order(session, 'lab_test').phase.kind).toBe('paid')
    expect(order(session, 'package').phase).toEqual({ kind: 'interrupted', reason: 'server' })
    expect(nextQueued(session)?.groupType).toBe('wellness')
  })

  it('retries only the failed order, with the same key, so it cannot become a second order', () => {
    const retried = run(session, { type: 'retry', groupType: 'package' }, submit('package', 'a-new-key'))
    expect(order(retried, 'package')).toMatchObject({ idempotencyKey: 'key-package', attempts: 2 })
    expect(order(retried, 'lab_test').phase.kind).toBe('paid')
  })

  it('locks the payment method while that key is outstanding', () => {
    const retried = run(session, { type: 'retry', groupType: 'package' })
    expect(canChangeMethod(order(retried, 'package'))).toBe(false)
    expect(order(run(retried, { type: 'set_method', groupType: 'package', method: 'pay_at_clinic' }), 'package').paymentMethod).toBe('card')
  })
})

describe('checkoutReducer: key rules', () => {
  it.each<[string, Extract<CheckoutEvent, { type: 'failed' }>['failure']]>([
    ['declined', { kind: 'declined' }],
    ['cart changed', { kind: 'cart_changed', mismatches: [] }],
    ['rejected', { kind: 'rejected', code: 'invalid_request' }],
  ])('spends the key when %s, so the next attempt is a new order', (_, failure) => {
    const session = run(start(), submit('lab_test'), failed('lab_test', failure))
    expect(order(session, 'lab_test').idempotencyKey).toBeNull()
  })

  it.each(['server', 'network', 'offline'] as const)('keeps the key after a %s interruption', (reason) => {
    const session = run(start(), submit('lab_test'), failed('lab_test', { kind: 'interrupted', reason }))
    expect(order(session, 'lab_test').idempotencyKey).toBe('key-lab_test')
  })

  it('gives a declined order a new key and lets the method change before retrying', () => {
    const declined = run(start(), submit('lab_test'), failed('lab_test', { kind: 'declined' }))
    expect(canChangeMethod(order(declined, 'lab_test'))).toBe(true)

    const retried = run(
      declined,
      { type: 'set_method', groupType: 'lab_test', method: 'pay_at_clinic' },
      { type: 'retry', groupType: 'lab_test' },
      submit('lab_test', 'key-2'),
    )
    expect(order(retried, 'lab_test')).toMatchObject({ paymentMethod: 'pay_at_clinic', idempotencyKey: 'key-2', attempts: 2 })
  })

  it('spends the key when a card payment fails after the order was made', () => {
    const session = run(start(), submit('lab_test'), placed('lab_test'), { type: 'status', groupType: 'lab_test', status: 'failed' })
    expect(order(session, 'lab_test')).toMatchObject({ phase: { kind: 'payment_failed' }, idempotencyKey: null })
  })
})

describe('checkoutReducer: guards', () => {
  it('ignores events that do not fit the phase, e.g. a late or duplicate response', () => {
    const session = run(start(), submit('lab_test'), placed('lab_test', 'paid'))
    expect(run(session, placed('lab_test', 'failed'), failed('lab_test', { kind: 'declined' }))).toBe(session)
    expect(run(session, submit('lab_test'))).toBe(session)
  })

  it('does not retry an order that succeeded or was rejected', () => {
    const paid = run(start(), submit('lab_test'), placed('lab_test', 'paid'))
    expect(run(paid, { type: 'retry', groupType: 'lab_test' })).toBe(paid)
  })

  it('takes a changed cart back into the queue only with the new items', () => {
    const changed = run(start(), submit('lab_test'), failed('lab_test', { kind: 'cart_changed', mismatches: [] }))
    expect(run(changed, { type: 'retry', groupType: 'lab_test' })).toBe(changed)

    const newItems = [{ lineId: 'l1', quantity: 2, wellnessPricingId: null }]
    const updated = run(changed, { type: 'update_items', groupType: 'lab_test', items: newItems, totals })
    expect(order(updated, 'lab_test')).toMatchObject({ items: newItems, phase: { kind: 'queued' }, idempotencyKey: null })
  })

  it('does not offer pay at clinic for insurance', () => {
    const session = createSession('s', 't', [{ groupType: 'insurance', items, totals, paymentMethod: 'card' }])
    const after = run(session, { type: 'set_method', groupType: 'insurance', method: 'pay_at_clinic' })
    expect(after.orders[0].paymentMethod).toBe('card')
  })

  it('turns a request that was out during a reload into an unknown outcome', () => {
    const session = run(start(), submit('lab_test'))
    const reloaded = checkoutReducer(session, { type: 'reloaded' })
    expect(order(reloaded, 'lab_test')).toMatchObject({
      phase: { kind: 'interrupted', reason: 'unknown' },
      idempotencyKey: 'key-lab_test',
    } satisfies Partial<GroupOrder>)
  })
})

describe('classifyCheckoutError', () => {
  const http = (status: number, code: string | null = null, details?: unknown) =>
    ({ kind: 'http', status, code, details }) as const

  it.each([
    ['402', http(402, 'payment_declined'), { kind: 'declined' }],
    ['500', http(500), { kind: 'interrupted', reason: 'server' }],
    ['429', http(429), { kind: 'interrupted', reason: 'server' }],
    ['400', http(400, 'invalid_request'), { kind: 'rejected', code: 'invalid_request' }],
    ['a reused key', http(409, 'idempotency_key_reused'), { kind: 'rejected', code: 'idempotency_key_reused' }],
    ['a lost connection', { kind: 'network', status: null, code: null } as const, { kind: 'interrupted', reason: 'network' }],
    ['an unreadable response', { kind: 'invalid', status: 200, code: null } as const, { kind: 'interrupted', reason: 'network' }],
    ['offline', { kind: 'offline', status: null, code: null } as const, { kind: 'interrupted', reason: 'offline' }],
  ])('classifies %s', (_, error, expected) => {
    expect(classifyCheckoutError(error)).toEqual(expected)
  })

  it('keeps the mismatches of a changed cart, dropping malformed ones', () => {
    const error = http(409, 'cart_changed', { mismatches: [{ lineId: 'a', reason: 'quantity_changed' }, { lineId: 1 }] })
    expect(classifyCheckoutError(error)).toEqual({
      kind: 'cart_changed',
      mismatches: [{ lineId: 'a', reason: 'quantity_changed' }],
    })
  })
})

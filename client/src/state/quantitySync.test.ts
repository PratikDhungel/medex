import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api/client'
import type { RawCart } from '@/domain/cart/raw'
import { QuantitySync } from './quantitySync'

interface Call {
  lineId: string
  quantity: number
  resolve: (cart: RawCart) => void
  reject: (error: unknown) => void
}

/** The server's cart with one line set to `quantity` */
const cartWith = (lineId: string, quantity: number): RawCart => ({
  groups: [{ type: 'lab_test', items: [{ id: lineId, quantity, product: {} }] }],
})

/** A QuantitySync whose requests wait until the test answers them */
function setup() {
  const calls: Call[] = []
  const idles: number[] = []
  const sync = new QuantitySync({
    send: (lineId, quantity) =>
      new Promise<RawCart>((resolve, reject) => calls.push({ lineId, quantity, resolve, reject })),
    onIdle: (mark) => idles.push(mark),
  })
  const shown = (lineId: string) => sync.getSnapshot().quantities.get(lineId)
  /** Lets the awaiting code after a resolved request run */
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
  return { sync, calls, idles, shown, tick }
}

describe('QuantitySync', () => {
  it('shows a change at once and sends it', () => {
    const { sync, calls, shown } = setup()
    sync.set('a', 3, 2)
    expect(shown('a')).toBe(3)
    expect(sync.getSnapshot().pending.has('a')).toBe(true)
    expect(calls.map((c) => c.quantity)).toEqual([3])
  })

  it('turns five quick taps into two ordered requests and the right final quantity', async () => {
    const { sync, calls, shown, tick } = setup()
    for (let quantity = 2; quantity <= 6; quantity += 1) sync.set('a', quantity, 1)

    // Only the first tap was sent; the rest moved the target
    expect(calls.map((c) => c.quantity)).toEqual([2])
    expect(shown('a')).toBe(6)

    calls[0].resolve(cartWith('a', 2))
    await tick()
    // The server's 2 never reaches the screen: the customer asked for 6
    expect(shown('a')).toBe(6)
    expect(calls.map((c) => c.quantity)).toEqual([2, 6])

    calls[1].resolve(cartWith('a', 6))
    await tick()
    expect(shown('a')).toBe(6)
    expect(sync.getSnapshot().pending.has('a')).toBe(false)
  })

  it('sends nothing when the taps end where they started', async () => {
    const { sync, calls, tick } = setup()
    sync.set('a', 3, 2)
    sync.set('a', 2, 2)
    calls[0].resolve(cartWith('a', 3))
    await tick()
    // The server now has 3, so one more request puts it back to 2
    expect(calls.map((c) => c.quantity)).toEqual([3, 2])
  })

  it('rolls back to the last saved quantity when the server refuses, and says why', async () => {
    const { sync, calls, shown, tick } = setup()
    sync.set('a', 10, 9)
    calls[0].resolve(cartWith('a', 10))
    await tick()

    sync.set('a', 11, 10)
    sync.set('a', 12, 11)
    const refusal = new ApiError('http', '/cart/items/a', 'no', 409, { code: 'quantity_limit' })
    calls[1].reject(refusal)
    await tick()

    expect(shown('a')).toBe(10)
    expect(calls).toHaveLength(2)
    expect(sync.getSnapshot().failures.get('a')).toMatchObject({ attempted: 11, restored: 10, error: refusal })
  })

  it('keeps lines independent: a refusal on one leaves the other alone', async () => {
    const { sync, calls, shown, tick } = setup()
    sync.set('a', 2, 1)
    sync.set('b', 5, 4)
    calls[0].reject(new ApiError('http', '/cart/items/a', 'boom', 500))
    calls[1].resolve(cartWith('b', 5))
    await tick()
    expect([shown('a'), shown('b')]).toEqual([1, 5])
  })

  it('drops the local value when the outcome is unknown, so the reloaded cart shows', async () => {
    const { sync, calls, shown, idles, tick } = setup()
    sync.set('a', 3, 2)
    calls[0].reject(new ApiError('network', '/cart/items/a', 'lost'))
    await tick()
    expect(shown('a')).toBeUndefined()
    expect(sync.getSnapshot().failures.get('a')).toMatchObject({ restored: null })
    expect(idles).toHaveLength(1)
  })

  it('accepts a quantity the server chose instead', async () => {
    const { sync, calls, shown, tick } = setup()
    sync.set('a', 50, 9)
    calls[0].resolve(cartWith('a', 10))
    await tick()
    expect(shown('a')).toBe(10)
    expect(calls).toHaveLength(1)
  })

  it('reports idle once every line settles, and clears only lines settled by then', async () => {
    const { sync, calls, shown, idles, tick } = setup()
    sync.set('a', 2, 1)
    sync.set('b', 2, 1)
    calls[0].resolve(cartWith('a', 2))
    await tick()
    expect(idles).toEqual([])

    calls[1].resolve(cartWith('b', 2))
    await tick()
    expect(idles).toHaveLength(1)

    // A change that starts while the reload is out must survive it
    sync.set('a', 3, 2)
    sync.clearSettled(idles[0])
    expect([shown('a'), shown('b')]).toEqual([3, undefined])
  })

  it('clears a failure when the line is changed again', async () => {
    const { sync, calls, tick } = setup()
    sync.set('a', 2, 1)
    calls[0].reject(new ApiError('http', '/cart/items/a', 'boom', 500))
    await tick()
    sync.set('a', 2, 1)
    expect(sync.getSnapshot().failures.has('a')).toBe(false)
  })

  it('stops syncing a line the server no longer has', async () => {
    const { sync, calls, shown, tick } = setup()
    sync.set('a', 2, 1)
    sync.set('a', 3, 1)
    calls[0].resolve({ groups: [] })
    await tick()
    expect(shown('a')).toBeUndefined()
    expect(calls).toHaveLength(1)
  })
})

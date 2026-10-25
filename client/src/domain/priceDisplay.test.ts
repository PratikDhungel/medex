import { describe, expect, it } from 'vitest'
import type { WellnessTier } from './model'
import { describePrice } from './priceDisplay'
import type { Price } from './pricing'

const price = (final: number, original = final): Price => ({
  original,
  afterDiscount: final,
  serviceCharge: 0,
  final,
  hasDiscount: final < original,
  issues: [],
})

const tier = (minutes: number, p: Price): WellnessTier => ({ id: `t${minutes}`, durationMinutes: minutes, price: p })

describe('describePrice', () => {
  it('shows a fixed price', () => {
    expect(describePrice({ kind: 'fixed', price: price(5970.6) }, 'THB')).toEqual({
      kind: 'amount',
      final: 'THB 5,970.60',
      original: null,
      from: false,
      detail: null,
    })
  })

  it('strikes through the original price when discounted', () => {
    expect(describePrice({ kind: 'fixed', price: price(5580, 6200) }, 'INR')).toMatchObject({
      final: '₹5,580',
      original: '₹6,200',
    })
  })

  it('strikes nothing through when the service charge outweighs the discount', () => {
    // Home HbA1c Test: 5,690 less a discount, plus a charge, comes to 5,724.50
    const outweighed: Price = { ...price(5724.5), original: 5690, afterDiscount: 5320, serviceCharge: 404.5, hasDiscount: true }
    expect(describePrice({ kind: 'fixed', price: outweighed }, 'NPR')).toMatchObject({
      final: 'NPR 5,724.50',
      original: null,
    })
    const even: Price = { ...price(5690), original: 5690, afterDiscount: 5300, serviceCharge: 390, hasDiscount: true }
    expect(describePrice({ kind: 'fixed', price: even }, 'NPR')).toMatchObject({ original: null })
  })

  it('shows Free for a zero price', () => {
    expect(describePrice({ kind: 'fixed', price: price(0) }, 'NPR')).toMatchObject({ final: 'Free', original: null })
  })

  it('shows the cheapest wellness duration as "From"', () => {
    const display = describePrice(
      { kind: 'tiers', tiers: [tier(60, price(1800)), tier(90, price(2040, 2400)), tier(120, price(3000))] },
      'THB',
    )
    expect(display).toEqual({
      kind: 'amount',
      final: 'THB 1,800',
      original: null,
      from: true,
      detail: '3 durations, 60–120 min',
    })
  })

  it('picks the cheapest duration even when it is not the shortest', () => {
    const display = describePrice({ kind: 'tiers', tiers: [tier(60, price(1800)), tier(90, price(1500, 2400))] }, 'THB')
    expect(display).toMatchObject({ final: 'THB 1,500', original: 'THB 2,400', from: true })
  })

  it('does not say "From" for a single duration', () => {
    expect(describePrice({ kind: 'tiers', tiers: [tier(60, price(1800))] }, 'THB')).toMatchObject({
      from: false,
      detail: '60 min',
    })
  })

  it('falls back to price on request', () => {
    expect(describePrice({ kind: 'none' }, 'THB')).toEqual({ kind: 'on-request' })
    expect(describePrice({ kind: 'fixed', price: price(100) }, null)).toEqual({ kind: 'on-request' })
  })
})

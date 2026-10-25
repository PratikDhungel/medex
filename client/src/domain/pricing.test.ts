import { describe, expect, it } from 'vitest'
import { computePrice } from './pricing'
import type { RawPricing } from './raw'

const pricing = (overrides: Partial<RawPricing>): RawPricing => ({
  price: '1000.00',
  discount: '0.00',
  discountType: 'amount',
  serviceCharge: '0.00',
  serviceChargeType: 'amount',
  ...overrides,
})

describe('computePrice', () => {
  it('applies a percent discount, then a percent charge on the discounted price', () => {
    // Executive Health Check (Male): 6200 - 10% = 5580, + 7% of 5580 = 390.6
    const price = computePrice(
      pricing({ price: '6200.00', discount: '10.00', discountType: 'percent', serviceCharge: '7.00', serviceChargeType: 'percent' }),
    )
    expect(price).toMatchObject({ original: 6200, afterDiscount: 5580, hasDiscount: true, issues: [] })
    expect(price?.serviceCharge).toBeCloseTo(390.6)
    expect(price?.final).toBeCloseTo(5970.6)
  })

  it('applies fixed amounts', () => {
    const price = computePrice(pricing({ price: '3500.00', discount: '500.00', serviceCharge: '120.00' }))
    expect(price).toMatchObject({ afterDiscount: 3000, serviceCharge: 120, final: 3120, hasDiscount: true })
  })

  it('does not round intermediate values', () => {
    const price = computePrice(pricing({ price: '99.99', discount: '33.33', discountType: 'percent' }))
    expect(price?.final).toBeCloseTo(66.663333, 6)
  })

  it('reports no discount when the discount is zero', () => {
    expect(computePrice(pricing({}))).toMatchObject({ final: 1000, hasDiscount: false, issues: [] })
  })

  it('caps a discount larger than the price at zero', () => {
    // Vitamin D Test: 450 with a 600 fixed discount
    const price = computePrice(pricing({ price: '450.00', discount: '600.00' }))
    expect(price).toMatchObject({ afterDiscount: 0, final: 0, issues: ['discount-exceeds-price'] })
  })

  it('caps a percent discount over 100', () => {
    const price = computePrice(pricing({ discount: '150', discountType: 'percent', serviceCharge: '10', serviceChargeType: 'percent' }))
    expect(price).toMatchObject({ afterDiscount: 0, serviceCharge: 0, final: 0, issues: ['discount-exceeds-price'] })
  })

  it('keeps a legitimate zero price', () => {
    // Free Dental Consultation
    expect(computePrice(pricing({ price: '0.00' }))).toMatchObject({ final: 0, hasDiscount: false, issues: [] })
  })

  it('treats missing discount and charge as none', () => {
    const price = computePrice(pricing({ discount: null, discountType: null, serviceCharge: null, serviceChargeType: null }))
    expect(price).toMatchObject({ final: 1000, issues: [] })
  })

  it('ignores and flags a malformed discount or charge', () => {
    expect(computePrice(pricing({ discount: 'abc' }))).toMatchObject({ final: 1000, issues: ['invalid-discount'] })
    expect(computePrice(pricing({ discount: '10', discountType: null }))).toMatchObject({ final: 1000, issues: ['invalid-discount'] })
    expect(computePrice(pricing({ serviceCharge: '-5' }))).toMatchObject({ final: 1000, issues: ['invalid-service-charge'] })
  })

  it('returns null without a usable price', () => {
    expect(computePrice(pricing({ price: null }))).toBeNull()
    expect(computePrice(pricing({ price: '6,200.00' }))).toBeNull()
  })
})

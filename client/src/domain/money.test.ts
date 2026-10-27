import { describe, expect, it } from 'vitest'
import { formatMoney, parseMoney } from './money'

describe('parseMoney', () => {
  it('parses plain decimal strings', () => {
    expect(parseMoney('6200.00')).toBe(6200)
    expect(parseMoney('0.00')).toBe(0)
    expect(parseMoney(' 450 ')).toBe(450)
  })

  it('accepts finite non-negative numbers', () => {
    expect(parseMoney(12.5)).toBe(12.5)
    expect(parseMoney(-1)).toBeNull()
    expect(parseMoney(Number.NaN)).toBeNull()
  })

  it.each(['', 'abc', '6,200.00', '฿6200', '-5', '1e3', '12.', null, undefined, {}])(
    'rejects %j',
    (value) => {
      expect(parseMoney(value)).toBeNull()
    },
  )
})

describe('formatMoney', () => {
  it('drops decimals for whole amounts', () => {
    expect(formatMoney(5580, 'THB')).toBe('THB\u00a05,580')
  })

  it('rounds to two decimals only here', () => {
    expect(formatMoney(5970.6, 'THB')).toBe('THB\u00a05,970.60')
    expect(formatMoney(0.1 + 0.2, 'INR')).toBe('INR\u00a00.30')
  })

  it('keeps each currency', () => {
    expect(formatMoney(1800, 'NPR')).toBe('NPR\u00a01,800')
    expect(formatMoney(1800, 'INR')).toBe('INR\u00a01,800')
  })
})

import { describe, expect, it } from 'vitest'
import type { MockConfig } from '@/api/mock'
import { describeRule, SCENARIOS } from './rules'

const empty: MockConfig = { rules: [], settlement: { outcome: 'paid', afterMs: 4000 }, fullyBookedSpecialists: [] }
const scenario = (id: string) => SCENARIOS.find((s) => s.id === id)!.apply(empty)

describe('describeRule', () => {
  it.each([
    [{ endpoint: 'checkout', status: 402, match: { groupType: 'package' }, times: 1 } as const, 'Place order (Packages): 402 Card declined, next time only'],
    [{ endpoint: 'checkout', status: 500, when: 'after', times: 2 } as const, 'Place order: 500 Server error, after the work is done, next 2 times'],
    [{ endpoint: 'getCart', delayMs: 3000 } as const, 'Load cart: +3 s, every time'],
    [{ endpoint: 'updateLine', status: 0 } as const, 'Change quantity or duration: Drop the connection, every time'],
  ])('%j', (rule, text) => {
    expect(describeRule(rule)).toBe(text)
  })
})

describe('SCENARIOS', () => {
  it('declines only the next package checkout', () => {
    expect(scenario('decline-package').rules).toEqual([{ endpoint: 'checkout', status: 402, match: { groupType: 'package' }, times: 1 }])
  })

  it('makes the lab test order but loses the response', () => {
    expect(scenario('lost-response-lab').rules[0]).toMatchObject({ status: 500, when: 'after', match: { groupType: 'lab_test' } })
  })

  it('slows every endpoint and fails card payments without touching rules', () => {
    expect(scenario('slow').rules).toHaveLength(6)
    expect(scenario('payments-fail')).toEqual({ rules: [], settlement: { outcome: 'failed', afterMs: 4000 }, fullyBookedSpecialists: [] })
  })

  it('adds to existing rules rather than replacing them', () => {
    const both = SCENARIOS.find((s) => s.id === 'refuse-quantity')!.apply(scenario('decline-package'))
    expect(both.rules.map((r) => r.endpoint)).toEqual(['checkout', 'updateLine'])
  })
})

describe('booking scenarios', () => {
  it('has someone else take the slot before the next booking or reschedule', () => {
    expect(scenario('book-raced').rules).toEqual([{ endpoint: 'createBooking', when: 'raced', times: 1 }])
    expect(scenario('move-raced').rules).toEqual([{ endpoint: 'updateBooking', when: 'raced', times: 1 }])
    expect(describeRule({ endpoint: 'createBooking', when: 'raced', times: 1 })).toBe(
      'Book an appointment: someone else takes the slot first, next time only',
    )
  })

  it('makes the booking but loses the response', () => {
    expect(scenario('book-dropped').rules).toEqual([{ endpoint: 'createBooking', status: 0, when: 'after', times: 1 }])
  })

  it('slows only the booking pages', () => {
    expect(scenario('booking-slow').rules.map((rule) => rule.endpoint)).toEqual([
      'bookingProviders',
      'bookingProvider',
      'availability',
      'slots',
      'getBooking',
    ])
  })

  it('fully books one specialist without touching the rules, once', () => {
    const once = scenario('fully-booked')
    expect(once.rules).toEqual([])
    expect(once.fullyBookedSpecialists).toEqual(['0d113411-a562-4427-bcf5-96aff364e228'])
    expect(SCENARIOS.find((s) => s.id === 'fully-booked')!.apply(once).fullyBookedSpecialists).toHaveLength(1)
  })
})

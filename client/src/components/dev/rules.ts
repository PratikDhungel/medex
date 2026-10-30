import type { MockConfig, MockEndpoint, MockRule } from '@/api/mock'
import { serviceTypeLabel } from '@/domain/serviceTypes'

// The dev panel's vocabulary: what each mock endpoint and status means, and
// ready-made scenarios for the cases the brief asks about.

export const ENDPOINT_LABELS: Record<MockEndpoint, string> = {
  getCart: 'Load cart',
  updateLine: 'Change quantity or duration',
  removeLine: 'Remove item',
  mergeCart: 'Log in (merge guest cart)',
  checkout: 'Place order',
  getOrder: 'Check payment status',
  bookingProviders: 'Load booking providers',
  bookingProvider: 'Load a provider',
  availability: 'Load the calendar',
  slots: "Load a day's times",
  createBooking: 'Book an appointment',
  getBooking: 'Load a booking',
  updateBooking: 'Reschedule a booking',
}

/** Endpoints where "someone else takes the slot first" makes sense */
export const RACEABLE_ENDPOINTS: readonly MockEndpoint[] = ['createBooking', 'updateBooking']

/** Dr. N. Rana at Riverside, from the data file: the specialist the "fully booked" scenario uses */
export const FULLY_BOOKED_DEMO = { id: '0d113411-a562-4427-bcf5-96aff364e228', label: 'Dr. N. Rana (Riverside)' }

export const STATUS_LABELS: Record<number, string> = {
  0: 'Drop the connection',
  402: '402 Card declined',
  409: '409 Conflict',
  500: '500 Server error',
}

export const GROUP_TYPES = ['package', 'lab_test', 'wellness', 'service', 'insurance']

/** A rule in plain words, e.g. "Place order (Packages): 402 Card declined, after the work, next time only" */
export function describeRule(rule: MockRule): string {
  const target = ENDPOINT_LABELS[rule.endpoint] + (rule.match?.groupType ? ` (${serviceTypeLabel(rule.match.groupType)})` : '')
  const effects = [
    rule.status !== undefined ? (STATUS_LABELS[rule.status] ?? `${rule.status}`) : null,
    rule.status !== undefined && rule.when === 'after' ? 'after the work is done' : null,
    rule.when === 'raced' ? 'someone else takes the slot first' : null,
    rule.delayMs ? `+${rule.delayMs / 1000} s` : null,
  ].filter(Boolean)
  const times = rule.times === undefined ? 'every time' : rule.times === 1 ? 'next time only' : `next ${rule.times} times`
  return `${target}: ${effects.join(', ') || 'no change'}, ${times}`
}

export const withRule = (config: MockConfig, rule: MockRule): MockConfig => ({ ...config, rules: [...config.rules, rule] })

export interface Scenario {
  id: string
  group: 'cart' | 'booking'
  label: string
  apply: (config: MockConfig) => MockConfig
}

const BOOKING_READS = ['bookingProviders', 'bookingProvider', 'availability', 'slots', 'getBooking'] as const

/** One click each, for the situations the briefs ask about */
export const SCENARIOS: Scenario[] = [
  {
    id: 'decline-package',
    group: 'cart',
    label: 'Next package checkout: card declined (402)',
    apply: (config) => withRule(config, { endpoint: 'checkout', status: 402, match: { groupType: 'package' }, times: 1 }),
  },
  {
    id: 'lost-response-lab',
    group: 'cart',
    label: 'Next lab test checkout: order made, response lost (500)',
    apply: (config) =>
      withRule(config, { endpoint: 'checkout', status: 500, when: 'after', match: { groupType: 'lab_test' }, times: 1 }),
  },
  {
    id: 'drop-checkout',
    group: 'cart',
    label: 'Next checkout: connection drops after the order is made',
    apply: (config) => withRule(config, { endpoint: 'checkout', status: 0, when: 'after', times: 1 }),
  },
  {
    id: 'refuse-quantity',
    group: 'cart',
    label: 'Next quantity change: refused (409)',
    apply: (config) => withRule(config, { endpoint: 'updateLine', status: 409, times: 1 }),
  },
  {
    id: 'fail-quantity',
    group: 'cart',
    label: 'Next quantity change: server error (500)',
    apply: (config) => withRule(config, { endpoint: 'updateLine', status: 500, times: 1 }),
  },
  {
    id: 'fail-merge',
    group: 'cart',
    label: 'Next login: merge fails (500)',
    apply: (config) => withRule(config, { endpoint: 'mergeCart', status: 500, times: 1 }),
  },
  {
    id: 'fail-cart',
    group: 'cart',
    label: 'Loading the cart fails (500) until cleared',
    apply: (config) => withRule(config, { endpoint: 'getCart', status: 500 }),
  },
  {
    id: 'slow',
    group: 'cart',
    label: 'Cart and checkout slow (+3 s) until cleared',
    apply: (config) =>
      (['getCart', 'updateLine', 'removeLine', 'mergeCart', 'checkout', 'getOrder'] as const).reduce(
        (next, endpoint) => withRule(next, { endpoint, delayMs: 3000 }),
        config,
      ),
  },
  {
    id: 'payments-fail',
    group: 'cart',
    label: 'Card payments fail after the order is placed',
    apply: (config) => ({ ...config, settlement: { ...config.settlement, outcome: 'failed' } }),
  },
  {
    id: 'book-raced',
    group: 'booking',
    label: 'Next booking: someone else takes the slot first (409)',
    apply: (config) => withRule(config, { endpoint: 'createBooking', when: 'raced', times: 1 }),
  },
  {
    id: 'move-raced',
    group: 'booking',
    label: 'Next reschedule: someone else takes the new time first (409)',
    apply: (config) => withRule(config, { endpoint: 'updateBooking', when: 'raced', times: 1 }),
  },
  {
    id: 'book-dropped',
    group: 'booking',
    label: 'Next booking: made, then the connection drops (result unknown)',
    apply: (config) => withRule(config, { endpoint: 'createBooking', status: 0, when: 'after', times: 1 }),
  },
  {
    id: 'book-500-after',
    group: 'booking',
    label: 'Next booking: made, then a server error (500, result unknown)',
    apply: (config) => withRule(config, { endpoint: 'createBooking', status: 500, when: 'after', times: 1 }),
  },
  {
    id: 'book-slow',
    group: 'booking',
    label: 'Next booking: takes 8 s',
    apply: (config) => withRule(config, { endpoint: 'createBooking', delayMs: 8000, times: 1 }),
  },
  {
    id: 'calendar-fails',
    group: 'booking',
    label: 'Loading the calendar fails (500) until cleared',
    apply: (config) => withRule(config, { endpoint: 'availability', status: 500 }),
  },
  {
    id: 'times-fail',
    group: 'booking',
    label: "Loading a day's times fails (500) until cleared",
    apply: (config) => withRule(config, { endpoint: 'slots', status: 500 }),
  },
  {
    id: 'booking-slow',
    group: 'booking',
    label: 'Booking pages slow (+4 s) until cleared',
    apply: (config) => BOOKING_READS.reduce((next, endpoint) => withRule(next, { endpoint, delayMs: 4000 }), config),
  },
  {
    id: 'fully-booked',
    group: 'booking',
    label: `${FULLY_BOOKED_DEMO.label}: fully booked for 90 days`,
    apply: (config) => ({
      ...config,
      fullyBookedSpecialists: [...new Set([...config.fullyBookedSpecialists, FULLY_BOOKED_DEMO.id])],
    }),
  },
]

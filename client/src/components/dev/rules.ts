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
}

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
    rule.delayMs ? `+${rule.delayMs / 1000} s` : null,
  ].filter(Boolean)
  const times = rule.times === undefined ? 'every time' : rule.times === 1 ? 'next time only' : `next ${rule.times} times`
  return `${target}: ${effects.join(', ') || 'no change'}, ${times}`
}

export const withRule = (config: MockConfig, rule: MockRule): MockConfig => ({ ...config, rules: [...config.rules, rule] })

export interface Scenario {
  id: string
  label: string
  apply: (config: MockConfig) => MockConfig
}

/** One click each, for the situations the brief asks about */
export const SCENARIOS: Scenario[] = [
  {
    id: 'decline-package',
    label: 'Next package checkout: card declined (402)',
    apply: (config) => withRule(config, { endpoint: 'checkout', status: 402, match: { groupType: 'package' }, times: 1 }),
  },
  {
    id: 'lost-response-lab',
    label: 'Next lab test checkout: order made, response lost (500)',
    apply: (config) =>
      withRule(config, { endpoint: 'checkout', status: 500, when: 'after', match: { groupType: 'lab_test' }, times: 1 }),
  },
  {
    id: 'drop-checkout',
    label: 'Next checkout: connection drops after the order is made',
    apply: (config) => withRule(config, { endpoint: 'checkout', status: 0, when: 'after', times: 1 }),
  },
  {
    id: 'refuse-quantity',
    label: 'Next quantity change: refused (409)',
    apply: (config) => withRule(config, { endpoint: 'updateLine', status: 409, times: 1 }),
  },
  {
    id: 'fail-quantity',
    label: 'Next quantity change: server error (500)',
    apply: (config) => withRule(config, { endpoint: 'updateLine', status: 500, times: 1 }),
  },
  {
    id: 'fail-merge',
    label: 'Next login: merge fails (500)',
    apply: (config) => withRule(config, { endpoint: 'mergeCart', status: 500, times: 1 }),
  },
  {
    id: 'fail-cart',
    label: 'Loading the cart fails (500) until cleared',
    apply: (config) => withRule(config, { endpoint: 'getCart', status: 500 }),
  },
  {
    id: 'slow',
    label: 'Everything slow (+3 s) until cleared',
    apply: (config) =>
      (['getCart', 'updateLine', 'removeLine', 'mergeCart', 'checkout', 'getOrder'] as const).reduce(
        (next, endpoint) => withRule(next, { endpoint, delayMs: 3000 }),
        config,
      ),
  },
  {
    id: 'payments-fail',
    label: 'Card payments fail after the order is placed',
    apply: (config) => ({ ...config, settlement: { ...config.settlement, outcome: 'failed' } }),
  },
]

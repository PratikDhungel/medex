import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { checkoutReducer, createSession, type CheckoutEvent, type CheckoutSession } from '@/domain/checkout/machine'
import { sessionSummaryText } from './copy'
import { SessionView } from './SessionView'

const order = (groupType: string, paymentMethod: 'card' | 'pay_at_clinic' = 'card') => ({
  groupType,
  providers: ['Lotus Pathology', 'Lalit Diagnostics'],
  items: [{ lineId: `${groupType}-1`, quantity: 2, wellnessPricingId: null }],
  totals: [
    { currency: 'NPR', amount: 12520 },
    { currency: 'THB', amount: 1677 },
  ],
  paymentMethod,
})

const submit = (groupType: string): CheckoutEvent => ({ type: 'submitting', groupType, newKey: `key-${groupType}` })

/** The brief's case: three groups, the second one fails */
const secondFailedEvents: CheckoutEvent[] = [
  submit('lab_test'),
  { type: 'placed', groupType: 'lab_test', order: { orderId: 'abcdef123456', status: 'paid' } },
  submit('package'),
  { type: 'failed', groupType: 'package', failure: { kind: 'interrupted', reason: 'server' } },
  submit('wellness'),
  { type: 'placed', groupType: 'wellness', order: { orderId: 'fedcba654321', status: 'pending' } },
]
const secondFailed = secondFailedEvents.reduce(
  checkoutReducer,
  createSession('s1', 't', [order('lab_test'), order('package'), order('wellness', 'pay_at_clinic')]),
)

const render = (session: CheckoutSession, online = true) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <SessionView
        session={session}
        online={online}
        onRetry={() => {}}
        onSetMethod={() => {}}
        updatable={new Set()}
        onUpdateItems={() => {}}
        onDone={() => {}}
      />
    </MemoryRouter>,
  )

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')

describe('SessionView when the second of three orders fails', () => {
  const html = render(secondFailed)

  it('says exactly what succeeded and what did not', () => {
    expect(text(html)).toContain('2 of 3 orders done. 1 needs your attention.')
    expect(text(html)).toContain('Lab Tests 2 items from Lotus Pathology and Lalit Diagnostics NPR 12,520 THB 1,677 Paid and booked')
    expect(text(html)).toContain("We couldn't confirm this order It may or may not have gone through. Trying again is safe")
    expect(text(html)).toContain('Booked. Pay at the clinic')
  })

  it('shows order references for the orders that exist', () => {
    expect(text(html)).toContain('Order reference ABCDEF12')
    expect(text(html)).toContain('Order reference FEDCBA65')
  })

  it('offers a retry only on the failed order', () => {
    expect(html.match(/Try again/g)).toHaveLength(1)
    expect(text(html)).toContain('Try again for Packages')
  })

  it('keeps the payment method fixed while the outcome is unknown', () => {
    expect(html).not.toContain('type="radio"')
    expect(text(html)).toContain('Pay by card now')
  })

  it('keeps the checkout open until the unknown order is resolved', () => {
    expect(text(html)).toContain('Back to cart')
    expect(text(html)).not.toContain('Done')
  })

  it('announces the summary', () => {
    expect(html).toMatch(/role="status" aria-live="polite"[^>]*>2 of 3 orders done/)
  })
})

describe('SessionView after a decline', () => {
  const events: CheckoutEvent[] = [submit('lab_test'), { type: 'failed', groupType: 'lab_test', failure: { kind: 'declined' } }]
  const declined = events.reduce(checkoutReducer, createSession('s1', 't', [order('lab_test')]))

  it('lets the customer switch to paying at the clinic and try again', () => {
    const html = render(declined)
    expect(text(html)).toContain("Your card was declined No order was placed and you haven't been charged.")
    expect(html.match(/type="radio"/g)).toHaveLength(2)
    expect(text(html)).toContain('Try again with a new payment')
    expect(text(html)).toContain('Leave the rest in my cart')
  })
})

describe('sessionSummaryText', () => {
  it.each([
    [{ total: 3, done: 1, inProgress: 2, needsAction: 0 }, '1 of 3 orders done, 2 still in progress.'],
    [{ total: 3, done: 1, inProgress: 1, needsAction: 1 }, '1 of 3 orders done, 1 still in progress, 1 needs your attention.'],
    [{ total: 3, done: 3, inProgress: 0, needsAction: 0 }, 'All 3 orders are done.'],
    [{ total: 1, done: 1, inProgress: 0, needsAction: 0 }, 'Your order is done.'],
    [{ total: 2, done: 0, inProgress: 0, needsAction: 2 }, 'None of the 2 orders went through yet.'],
    [{ total: 3, done: 1, inProgress: 0, needsAction: 2 }, '1 of 3 orders done. 2 need your attention.'],
  ])('%j → %s', (summary, expected) => {
    expect(sessionSummaryText(summary)).toBe(expected)
  })
})

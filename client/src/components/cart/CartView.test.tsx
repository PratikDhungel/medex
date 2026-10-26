/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api/client'
import { normaliseCart } from '@/domain/cart/normalise'
import type { RawCart } from '@/domain/cart/raw'
import type { QuantitySnapshot } from '@/state/quantitySync'
import { CartView, type CartViewProps } from './CartView'

const { serverCart } = JSON.parse(
  readFileSync(new URL('../../../../server/data/task2-cart.json', import.meta.url), 'utf8'),
) as { serverCart: RawCart }
const cart = normaliseCart(serverCart)

const LIVER_LINE = '76d58b51-449b-4f90-a936-1b6008dcf67d'
const CBC_LINE = 'dbd4cac2-eb2b-4dc7-867e-0d5c13226036'

const idle: QuantitySnapshot = { quantities: new Map(), pending: new Set(), failures: new Map() }

const controls = (overrides: Partial<CartViewProps['controls']> = {}): CartViewProps['controls'] => ({
  editable: true,
  local: idle,
  onQuantityChange: () => {},
  onDismissFailure: () => {},
  onSelectDuration: async () => {},
  onRemove: async () => {},
  ...overrides,
})

const render = (overrides: Partial<CartViewProps>) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <CartView
        status={{ kind: 'ready', refreshFailed: false }}
        cart={cart}
        online
        slow={false}
        retrying={false}
        onRetry={() => {}}
        controls={controls()}
        {...overrides}
      />
    </MemoryRouter>,
  )

/** Visible text only, with tags dropped and spacing collapsed */
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')

describe('CartView', () => {
  it('shows each group with its own subtotal per currency', () => {
    const html = text(render({}))
    expect(html).toContain('8 items in 3 bookings')
    expect(html).toContain('Lab Tests')
    expect(html).toContain('Subtotal, in 2 currencies NPR 12,520 THB 1,677')
    expect(html).toContain('Subtotal, in 2 currencies INR 23,009.50 THB 15,230')
  })

  it('summarises per currency and never shows a grand total', () => {
    const html = text(render({}))
    expect(html).toContain("You'll pay, in 3 currencies INR 23,009.50 NPR 12,520 THB 16,907")
    expect(html).toContain('3 separate bookings')
    expect(html).toContain('2 of 3 are ready to book now')
    expect(html).toContain('+ 1 item not priced yet')
  })

  it('keeps the unpriced facial out of every total and says what is needed', () => {
    const html = text(render({}))
    expect(html).toContain('Price shown once you choose a duration')
    expect(html).toContain('Not ready to book yet Choose a duration for Signature Facial.')
    expect(html).not.toMatch(/THB\s0\b/)
  })

  it('marks the removed service as unavailable', () => {
    const html = text(render({}))
    expect(html).toContain('No longer available')
    expect(html).toContain("Removed by the provider. It won't be booked.")
    expect(html).toContain("1 item is no longer offered and won't be booked.")
  })

  it('shows a skeleton and a slow message while loading', () => {
    const html = render({ status: { kind: 'loading' }, cart: undefined, slow: true })
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('This is taking longer than usual')
  })

  it('shows an error with a retry when the cart cannot load', () => {
    const html = render({
      status: { kind: 'error', error: new ApiError('http', '/cart', 'boom', 500) },
      cart: undefined,
    })
    expect(html).toContain('role="alert"')
    expect(html).toContain('Something went wrong on our side')
    expect(html).toContain('Try again')
  })

  it('keeps the cart on screen when a reload fails', () => {
    const html = text(render({ status: { kind: 'ready', refreshFailed: true } }))
    expect(html).toContain("We couldn't refresh your cart")
    expect(html).toContain('Lab Tests')
  })

  it('explains what offline means for a loaded cart', () => {
    expect(text(render({ online: false }))).toContain('changes and checkout will wait until you reconnect')
  })

  it('shows the offline state when there is no cart yet', () => {
    expect(text(render({ status: { kind: 'offline' }, cart: undefined }))).toContain(
      "Your cart will load as soon as you're back online",
    )
  })

  it('shows an empty cart with a way to find services', () => {
    const html = render({ cart: normaliseCart({ groups: [] }) })
    expect(text(html)).toContain('Your cart is empty')
    expect(html).toContain('href="/"')
  })

  it('gives each service a labelled quantity stepper', () => {
    const html = render({})
    expect(html).toContain('aria-label="Quantity of Liver Function Profile"')
    expect(html).toContain('aria-label="Increase quantity"')
  })

  it('keeps "−" focusable but inactive at 1, and disables steppers while offline', () => {
    const atOne = render({})
    // Six services can be changed; all but Liver Function Profile (2) are at 1
    expect(atOne.match(/aria-label="Decrease quantity" aria-disabled="true"/g)).toHaveLength(5)
    expect(atOne).not.toMatch(/aria-label="Decrease quantity"[^>]*disabled=""/)

    const offline = render({ controls: controls({ editable: false }) })
    expect(offline.match(/aria-label="Increase quantity" aria-disabled="true"/g)).toHaveLength(6)
  })

  it('shows "Saving…" only for lines being saved', () => {
    const local = { ...idle, pending: new Set([LIVER_LINE]) }
    expect(render({ controls: controls({ local }) }).match(/class="text-xs text-muted-foreground">Saving…/g)).toHaveLength(1)
  })

  it('explains a refused change on its line and announces it', () => {
    const failure = {
      lineId: CBC_LINE,
      attempted: 11,
      restored: 10,
      error: new ApiError('http', '/cart/items/x', 'no', 409, { code: 'quantity_limit', details: { maxQuantity: 10 } }),
    }
    const html = render({ controls: controls({ local: { ...idle, failures: new Map([[CBC_LINE, failure]]) } }) })
    expect(html).toContain('role="alert"')
    expect(text(html)).toContain("You can book up to 10 of one service at a time. It's back to 10.")
  })

  it('offers the facial durations as a radio group, none chosen yet', () => {
    const html = render({})
    expect(text(html)).toContain('Choose a duration for Signature Facial')
    expect(text(html)).toContain('60 min · THB 1,800')
    expect(text(html)).toContain('90 min · THB 2,040')
    expect(html.match(/type="radio"/g)).toHaveLength(2)
    expect(html).not.toMatch(/type="radio"[^>]*checked/)
  })

  it('shows the chosen duration and its price once saved', () => {
    const groups = structuredClone(serverCart.groups)
    groups[1].items = (groups[1].items as object[]).map((item) => ({
      ...item,
      wellnessPricingId: 'a1b2c3d4-0000-4000-8000-000000000090',
    }))
    const html = text(render({ cart: normaliseCart({ ...serverCart, groups }) }))
    expect(html).toContain('Lotus Day Spa · 90 min')
    expect(html).toMatch(/Signature Facial .*THB 2,040/)
    expect(html).toContain("You'll pay, in 3 currencies INR 23,009.50 NPR 12,520 THB 18,947")
    expect(html).not.toContain('not priced yet')
  })

  it('names what each Remove button removes, and makes it prominent for removed services', () => {
    const html = render({})
    expect(html).toContain('aria-label="Remove CBC Profile"')
    expect(html).toContain('aria-label="Remove A service that is no longer offered"')
  })

  it('makes lines and group headings focusable from script', () => {
    const html = render({})
    expect(html).toContain(`id="cart-line-${CBC_LINE}" tabindex="-1"`)
    expect(html).toContain('id="cart-group-lab_test" tabindex="-1"')
  })
})

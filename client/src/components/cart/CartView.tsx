import { CloudOff, ShoppingCart, TriangleAlert, WifiOff } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { failureMessage } from '@/api/failureMessage'
import { RetryButton } from '@/components/common/RetryButton'
import { StatePanel } from '@/components/explorer/StatePanel'
import { Button } from '@/components/ui/button'
import type { Cart } from '@/domain/cart/model'
import { summariseCart } from '@/domain/cart/summary'
import type { CartStatus } from '@/hooks/cartStatus'
import { CartGroupSection, CartGroupSkeleton } from './CartGroupSection'
import type { LineControls } from './CartLineItem'
import { CartSummaryPanel, CartSummarySkeleton } from './CartSummaryPanel'
import { plural } from './copy'

export interface CartViewProps {
  status: CartStatus
  cart: Cart | undefined
  online: boolean
  /** The first load has taken longer than usual */
  slow: boolean
  retrying: boolean
  onRetry: () => void
  controls: LineControls
  booking: Booking
}

/** Starting a checkout from the cart */
export interface Booking {
  onBook: (groupTypes: string[]) => void
  /** A checkout with unfinished orders exists, so a new one can't start yet */
  blocked: boolean
  /** A summary of the existing checkout, if there is one, linking to it */
  existing: { text: string; unresolved: boolean } | null
}

function statusText({ status, cart, slow }: CartViewProps): string {
  if (status.kind === 'loading') {
    return slow ? 'Still loading your cart. This is taking longer than usual.' : 'Loading your cart…'
  }
  if (status.kind !== 'ready' || !cart || cart.itemCount === 0) return ''
  const bookings = cart.groups.filter((group) => group.bookable).length
  return `${plural(cart.itemCount, 'item')} in ${plural(bookings, 'booking')}`
}

export function CartView(props: CartViewProps) {
  const { status, online, retrying, onRetry } = props

  return (
    <div className="space-y-4">
      {/* Always mounted so screen readers announce every change */}
      <p role="status" aria-live="polite" className="min-h-6 text-sm text-muted-foreground">
        {statusText(props)}
      </p>

      {status.kind === 'ready' && !online && (
        <div className="flex items-start gap-3 rounded-xl border bg-muted/50 px-4 py-3 text-sm">
          <WifiOff aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>You're offline. You can look through your cart, but changes and checkout will wait until you reconnect.</p>
        </div>
      )}

      {status.kind === 'ready' && status.refreshFailed && online && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p>We couldn't refresh your cart, so it may be out of date.</p>
          </div>
          <RetryButton retrying={retrying} onRetry={onRetry} variant="outline" />
        </div>
      )}

      {props.booking.existing && status.kind === 'ready' && (
        <div className="flex flex-col gap-3 rounded-xl border bg-muted/50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-medium">
              {props.booking.existing.unresolved ? 'You have a checkout in progress. ' : 'Your last checkout: '}
            </span>
            {props.booking.existing.text}
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/checkout">View checkout</Link>
          </Button>
        </div>
      )}

      <CartBody {...props} />
    </div>
  )
}

function CartBody({ status, cart, retrying, onRetry, controls, booking }: CartViewProps) {
  const summary = useMemo(() => (cart ? summariseCart(cart) : null), [cart])

  switch (status.kind) {
    case 'loading':
      return (
        <CartLayout
          aria-busy
          groups={
            <ul aria-label="Loading your cart" className="space-y-4">
              <li>
                <CartGroupSkeleton lines={3} />
              </li>
              <li>
                <CartGroupSkeleton lines={1} />
              </li>
            </ul>
          }
          summary={<CartSummarySkeleton />}
        />
      )

    case 'offline':
      return (
        <StatePanel icon={WifiOff} title="You're offline" role="status">
          Your cart will load as soon as you're back online.
        </StatePanel>
      )

    case 'error': {
      const message = failureMessage([status.error], 'your cart')
      return (
        <StatePanel
          icon={CloudOff}
          title={message.title}
          tone="error"
          role="alert"
          action={<RetryButton retrying={retrying} onRetry={onRetry} />}
        >
          {message.body}
        </StatePanel>
      )
    }

    case 'ready':
      if (!cart || !summary || cart.groups.length === 0) {
        return (
          <StatePanel
            icon={ShoppingCart}
            title="Your cart is empty"
            action={
              <Button asChild>
                <Link to="/">Find a health service</Link>
              </Button>
            }
          >
            Services you add will appear here, grouped by type.
          </StatePanel>
        )
      }
      return (
        <CartLayout
          groups={
            <ul className="space-y-4">
              {cart.groups.map((group) => (
                <li key={group.type}>
                  <CartGroupSection group={group} controls={controls} booking={booking} />
                </li>
              ))}
            </ul>
          }
          summary={<CartSummaryPanel summary={summary} cart={cart} booking={booking} />}
        />
      )
  }
}

interface CartLayoutProps {
  groups: ReactNode
  summary: ReactNode
  'aria-busy'?: boolean
}

/** Groups first; the summary sits beside them on wide screens and after them on narrow ones */
function CartLayout({ groups, summary, 'aria-busy': busy }: CartLayoutProps) {
  return (
    <div aria-busy={busy || undefined} className="gap-8 space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:space-y-0">
      {groups}
      <aside aria-label="Cart summary" className="lg:sticky lg:top-6">
        {summary}
      </aside>
    </div>
  )
}

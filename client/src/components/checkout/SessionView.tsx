import type { Ref } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { canRetry, hasUnresolved, summariseSession, type CheckoutSession } from '@/domain/checkout/machine'
import type { PaymentMethod } from '@/domain/checkout/model'
import { plural } from '@/components/cart/copy'
import { sessionSummaryText } from './copy'
import { OrderCard } from './OrderCard'

export interface SessionViewProps {
  session: CheckoutSession
  online: boolean
  onRetry: (groupType: string) => void
  onSetMethod: (groupType: string, method: PaymentMethod) => void
  /** Group types whose current cart items can be ordered again after the cart changed */
  updatable: ReadonlySet<string>
  onUpdateItems: (groupType: string) => void
  onDone: () => void
  /** Focused when the customer arrives here from the review step */
  headingRef?: Ref<HTMLHeadingElement>
}

/**
 * The orders of one checkout and where each one is. Unfinished business
 * (an order still in progress, or one whose outcome isn't known yet) keeps
 * the session open; the customer can leave and come back to it.
 */
export function SessionView({
  session,
  online,
  onRetry,
  onSetMethod,
  updatable,
  onUpdateItems,
  onDone,
  headingRef,
}: SessionViewProps) {
  const summary = summariseSession(session)
  const retryable = session.orders.filter(canRetry)
  const unresolved = hasUnresolved(session)

  return (
    <section aria-labelledby="checkout-orders" className="space-y-4">
      <div className="space-y-1">
        <h2
          id="checkout-orders"
          ref={headingRef}
          tabIndex={-1}
          className="rounded-sm font-accent text-xl font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Your {plural(summary.total, 'order')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {summary.total > 1
            ? 'Each order is placed and paid separately, so one problem never affects the others.'
            : 'Your order is placed and paid on its own.'}
        </p>
      </div>

      {/* Announced as orders move along */}
      <p role="status" aria-live="polite" className="rounded-lg bg-muted/50 px-4 py-3 font-medium">
        {sessionSummaryText(summary)}
      </p>

      {!online && (
        <p className="text-sm text-muted-foreground">
          You're offline. Orders already placed are safe; anything still to do will wait until you reconnect.
        </p>
      )}

      <ul className="space-y-4">
        {session.orders.map((order) => (
          <li key={order.groupType}>
            <OrderCard
              order={order}
              online={online}
              onRetry={() => onRetry(order.groupType)}
              onSetMethod={(method) => onSetMethod(order.groupType, method)}
              onUpdateItems={updatable.has(order.groupType) ? () => onUpdateItems(order.groupType) : undefined}
            />
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        {retryable.length > 1 && (
          <Button
            onClick={() => retryable.forEach((order) => onRetry(order.groupType))}
            aria-disabled={!online}
            className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
          >
            Try all {retryable.length} again
          </Button>
        )}
        {unresolved ? (
          <Button asChild variant="outline">
            <Link to="/cart">Back to cart</Link>
          </Button>
        ) : (
          <Button variant={retryable.length > 0 ? 'outline' : 'default'} onClick={onDone}>
            {retryable.length > 0 ? 'Leave the rest in my cart' : 'Done'}
          </Button>
        )}
      </div>
    </section>
  )
}

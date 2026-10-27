import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMoney } from '@/domain/money'
import type { Cart } from '@/domain/cart/model'
import type { CartSummary } from '@/domain/cart/summary'
import { BookButton } from './BookButton'
import type { Booking } from './CartView'
import { plural } from './copy'

/**
 * What the customer will pay, without pretending it's one payment: one line
 * per currency, the number of separate bookings, and what isn't priced yet.
 */
export function CartSummaryPanel({ summary, cart, booking }: { summary: CartSummary; cart: Cart; booking: Booking }) {
  const { totals, orderCount, readyOrderCount, unpricedCount, unavailableCount } = summary
  const readyTypes = cart.groups.filter((group) => group.ready).map((group) => group.type)

  return (
    <Card className="gap-4 px-4 py-4 sm:px-6 sm:py-5">
      <h2 className="font-accent text-lg font-semibold">
        Summary
      </h2>

      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          {totals.length > 1 ? `You'll pay, in ${totals.length} currencies` : "You'll pay"}
        </p>
        {totals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing priced yet</p>
        ) : (
          <ul className="space-y-0.5">
            {totals.map(({ currency, amount }) => (
              <li key={currency} className="text-lg font-semibold tabular-nums">
                {formatMoney(amount, currency)}
              </li>
            ))}
          </ul>
        )}
        {unpricedCount > 0 && (
          <p className="text-sm">
            + {plural(unpricedCount, 'item')} not priced yet. {unpricedCount === 1 ? 'Its price' : 'Their prices'} will
            be added once {unpricedCount === 1 ? "it's" : "they're"} ready to book.
          </p>
        )}
      </div>

      <div className="space-y-2 border-t pt-4 text-sm text-muted-foreground">
        {orderCount > 0 && (
          <p>
            Your cart becomes <strong className="font-semibold text-foreground">{plural(orderCount, 'separate booking')}</strong>,
            one for each group above. Each is paid on its own, by card or at the clinic.
          </p>
        )}
        {orderCount > 0 && readyOrderCount < orderCount && (
          <p>
            {readyOrderCount === 0 ? 'None' : `${readyOrderCount} of ${orderCount}`} {readyOrderCount === 1 ? 'is' : 'are'}{' '}
            ready to book now.
          </p>
        )}
        {totals.length > 1 && (
          <p>Prices are in each provider's own currency. We never convert them or add them together.</p>
        )}
        {unavailableCount > 0 && (
          <p>
            {plural(unavailableCount, 'item')} {unavailableCount === 1 ? 'is' : 'are'} no longer offered and won't be
            booked.
          </p>
        )}
      </div>

      {readyTypes.length > 0 && (
        <BookButton booking={booking} groupTypes={readyTypes} className="w-full">
          {readyTypes.length === 1
            ? 'Book the ready group'
            : readyTypes.length === orderCount
              ? `Book all ${readyTypes.length} groups`
              : `Book the ${readyTypes.length} ready groups`}
        </BookButton>
      )}
    </Card>
  )
}

export function CartSummarySkeleton() {
  return (
    <Card aria-hidden className="gap-4 px-4 py-4 sm:px-6 sm:py-5">
      <Skeleton className="h-6 w-24" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-28" />
      </div>
      <Skeleton className="h-12 w-full" />
    </Card>
  )
}

import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { blockerText, formatList, lineTitle, plural } from '@/components/cart/copy'
import type { CartGroup } from '@/domain/cart/model'
import { allowedMethods } from '@/domain/checkout/machine'
import type { PaymentMethod } from '@/domain/checkout/model'
import { formatMoney } from '@/domain/money'
import { serviceTypeLabel } from '@/domain/serviceTypes'
import { PaymentMethodPicker } from './PaymentMethodPicker'

export interface ReviewViewProps {
  /** Groups that will become orders, in the order they will be placed */
  groups: CartGroup[]
  /** Groups asked for that can't be booked right now */
  skipped: { type: string; group: CartGroup | undefined }[]
  methodFor: (groupType: string) => PaymentMethod
  onMethodChange: (groupType: string, method: PaymentMethod) => void
  onPlace: () => void
  online: boolean
}

function SkippedGroup({ type, group }: ReviewViewProps['skipped'][number]) {
  if (!group) return <li>{serviceTypeLabel(type)} is no longer in your cart.</li>
  const titles = new Map(group.lines.map((line) => [line.id, lineTitle(line)]))
  return (
    <li>
      {serviceTypeLabel(type)} isn't ready to book:{' '}
      {group.blockers.map(({ lineId, reason }) => blockerText(reason, titles.get(lineId) ?? 'An item')).join(' ')}
    </li>
  )
}

/** The step before anything is sent: what becomes which order, and how each is paid */
export function ReviewView({ groups, skipped, methodFor, onMethodChange, onPlace, online }: ReviewViewProps) {
  const count = groups.length
  const anyCard = groups.some((group) => methodFor(group.type) === 'card')

  return (
    <section aria-labelledby="checkout-review" className="space-y-4">
      <div className="space-y-1">
        <h2 id="checkout-review" className="font-accent text-xl font-semibold">
          {count === 1 ? 'Review your order' : `Review your ${count} orders`}
        </h2>
        {count > 1 && (
          <p className="text-sm text-muted-foreground">
            Each group is a separate order with its own payment. If one has a problem, the others still go through.
          </p>
        )}
      </div>

      {skipped.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
          <p className="font-medium">Not included</p>
          <ul className="text-muted-foreground">
            {skipped.map((entry) => (
              <SkippedGroup key={entry.type} {...entry} />
            ))}
          </ul>
        </div>
      )}

      <ol className="space-y-4">
        {groups.map((group, index) => {
          const label = serviceTypeLabel(group.type)
          const items = group.lines.filter((line) => line.status.kind === 'priced')
          return (
            <li key={group.type}>
              <Card className="gap-4 px-4 py-4 sm:px-6 sm:py-5">
                <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0 space-y-1">
                    <h3 className="font-accent text-lg font-semibold">
                      {count > 1 && <span className="text-muted-foreground">Order {index + 1}: </span>}
                      {label}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {plural(items.reduce((sum, line) => sum + line.quantity, 0), 'item')} from{' '}
                      {formatList(group.providers.map((provider) => provider.name))}
                    </p>
                  </div>
                  <ul className="sm:text-right">
                    {group.subtotals.map(({ currency, amount }) => (
                      <li key={currency} className="font-semibold tabular-nums">
                        {formatMoney(amount, currency)}
                      </li>
                    ))}
                  </ul>
                </header>
                <ul className="text-sm text-muted-foreground">
                  {items.map((line) => (
                    <li key={line.id}>
                      {line.quantity} × {lineTitle(line)}
                    </li>
                  ))}
                </ul>
                <PaymentMethodPicker
                  legend={`How to pay for ${label}`}
                  methods={allowedMethods(group.type)}
                  value={methodFor(group.type)}
                  onChange={(method) => onMethodChange(group.type, method)}
                />
              </Card>
            </li>
          )
        })}
      </ol>

      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {anyCard
            ? 'Card orders are charged one by one as they are placed. Amounts stay in each provider’s currency.'
            : 'Nothing is charged now. You pay each provider on the day.'}
        </p>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/cart">Back to cart</Link>
          </Button>
          <Button onClick={onPlace} aria-disabled={!online} className="aria-disabled:pointer-events-none aria-disabled:opacity-50">
            {count === 1 ? 'Place order' : `Place ${count} orders`}
          </Button>
        </div>
      </div>
      {!online && <p className="text-sm text-muted-foreground">You're offline. Reconnect to place your orders.</p>}
    </section>
  )
}

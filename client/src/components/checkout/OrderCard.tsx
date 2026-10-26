import { CircleAlert, CircleCheck, CircleX, LoaderCircle, RotateCw } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatList, plural } from '@/components/cart/copy'
import { allowedMethods, canChangeMethod, canRetry, type GroupOrder } from '@/domain/checkout/machine'
import type { PaymentMethod } from '@/domain/checkout/model'
import { formatMoney } from '@/domain/money'
import { cn } from '@/lib/utils'
import { orderHeadingId } from './links'
import { methodLabel, orderLabel, orderReference, orderStatusText, type Tone } from './copy'
import { PaymentMethodPicker } from './PaymentMethodPicker'

const TONES: Record<Tone, { icon: typeof CircleCheck; className: string }> = {
  progress: { icon: LoaderCircle, className: 'text-muted-foreground [&>svg]:animate-spin' },
  success: { icon: CircleCheck, className: 'text-emerald-700 dark:text-emerald-400' },
  warning: { icon: CircleAlert, className: 'text-amber-700 dark:text-amber-400' },
  error: { icon: CircleX, className: 'text-destructive' },
}

export interface OrderCardProps {
  order: GroupOrder
  online: boolean
  onRetry: () => void
  onSetMethod: (method: PaymentMethod) => void
  /** Set when the cart's current items for this group can be ordered instead, after the cart changed */
  onUpdateItems?: () => void
}

export function OrderCard({ order, online, onRetry, onSetMethod, onUpdateItems }: OrderCardProps) {
  const status = orderStatusText(order)
  const { icon: Icon, className } = TONES[status.tone]
  const { phase } = order
  const orderId = 'orderId' in phase ? phase.orderId : null
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)
  const methodEditable = canChangeMethod(order) && phase.kind !== 'queued'

  return (
    <Card aria-labelledby={orderHeadingId(order.groupType)} role="region" className="gap-4 px-4 py-4 sm:px-6 sm:py-5">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 space-y-1">
          <h3
            id={orderHeadingId(order.groupType)}
            tabIndex={-1}
            className="rounded-sm font-accent text-lg font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {orderLabel(order)}
          </h3>
          <p className="text-sm text-muted-foreground">
            {plural(itemCount, 'item')}
            {order.providers.length > 0 && ` from ${formatList(order.providers)}`}
          </p>
        </div>
        <ul className="sm:text-right">
          {order.totals.map(({ currency, amount }) => (
            <li key={currency} className="font-semibold tabular-nums">
              {formatMoney(amount, currency)}
            </li>
          ))}
        </ul>
      </header>

      <div className={cn('flex items-start gap-3', className)}>
        <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
        <div className="space-y-1">
          <p className="font-medium">{status.title}</p>
          <p className="text-sm text-muted-foreground">{status.body}</p>
          {orderId && (
            <p className="text-xs text-muted-foreground">
              Order reference <span className="font-mono">{orderReference(orderId)}</span>
            </p>
          )}
        </div>
      </div>

      {methodEditable ? (
        <PaymentMethodPicker
          legend={`How to pay for ${orderLabel(order)}`}
          methods={allowedMethods(order.groupType)}
          value={order.paymentMethod}
          onChange={onSetMethod}
          disabled={!online}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          {phase.kind === 'paid' ? 'Paid by card' : phase.kind === 'booked' ? 'Paying at the clinic' : methodLabel(order.paymentMethod)}
        </p>
      )}

      {(canRetry(order) || phase.kind === 'cart_changed') && (
        <div className="flex flex-wrap gap-2">
          {canRetry(order) && (
            <Button onClick={onRetry} aria-disabled={!online} className="aria-disabled:pointer-events-none aria-disabled:opacity-50">
              <RotateCw aria-hidden />
              {phase.kind === 'interrupted' ? 'Try again' : 'Try again with a new payment'}
              <span className="sr-only"> for {orderLabel(order)}</span>
            </Button>
          )}
          {phase.kind === 'cart_changed' &&
            (onUpdateItems ? (
              <Button onClick={onUpdateItems} aria-disabled={!online} className="aria-disabled:pointer-events-none aria-disabled:opacity-50">
                Place it again with my cart as it is now
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link to="/cart">Review your cart</Link>
              </Button>
            ))}
        </div>
      )}
    </Card>
  )
}

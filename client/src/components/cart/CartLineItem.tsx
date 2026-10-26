import { Ban, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { CartLine } from '@/domain/cart/model'
import { formatMoney } from '@/domain/money'
import type { QuantityFailure, QuantitySnapshot } from '@/state/quantitySync'
import { blockedPriceText, lineTitle, quantityFailureText } from './copy'
import { QuantityStepper } from './QuantityStepper'

/** What a line needs to be edited, passed down unchanged from the page */
export interface LineControls {
  /** False while changes can't be sent, e.g. offline */
  editable: boolean
  local: QuantitySnapshot
  /** `shown` is the quantity on screen when the change was asked for */
  onQuantityChange: (lineId: string, quantity: number, shown: number) => void
  onDismissFailure: (lineId: string) => void
}

function FailureNotice({ failure, onDismiss }: { failure: QuantityFailure; onDismiss: () => void }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
      <p role="alert" className="flex-1">
        {quantityFailureText(failure)}
      </p>
      <Button type="button" variant="ghost" size="icon-xs" aria-label="Dismiss message" onClick={onDismiss}>
        <X aria-hidden />
      </Button>
    </div>
  )
}

function LinePrice({ line }: { line: CartLine }) {
  const { status, currency, quantity } = line

  if (status.kind === 'unavailable') return null
  if (status.kind === 'blocked' || currency === null) {
    const text = status.kind === 'blocked' ? blockedPriceText(status.reason) : 'Price unavailable'
    return <p className="max-w-40 shrink-0 text-right text-sm text-muted-foreground">{text}</p>
  }

  return (
    <div className="shrink-0 text-right">
      <p className="font-semibold whitespace-nowrap tabular-nums">{formatMoney(status.total, currency)}</p>
      {quantity > 1 && (
        <p className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
          {quantity} × {formatMoney(status.unitPrice, currency)}
        </p>
      )}
    </div>
  )
}

export function CartLineItem({ line, controls }: { line: CartLine; controls: LineControls }) {
  const unavailable = line.status.kind === 'unavailable'
  const duration = line.durations.find((option) => option.id === line.selectedDurationId)
  const details = [line.provider?.name, duration && `${duration.minutes} min`].filter(Boolean).join(' · ')
  const failure = controls.local.failures.get(line.id)

  return (
    <li className="space-y-2 border-t py-3 first:border-t-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className={unavailable ? 'font-medium break-words text-muted-foreground' : 'font-medium break-words'}>
            {lineTitle(line)}
          </p>
          {details && <p className="text-sm text-muted-foreground">{details}</p>}
          {unavailable ? (
            <Badge variant="outline" className="font-normal">
              <Ban aria-hidden />
              Removed by the provider. It won't be booked.
            </Badge>
          ) : (
            <QuantityStepper
              title={lineTitle(line)}
              quantity={line.quantity}
              disabled={!controls.editable}
              saving={controls.local.pending.has(line.id)}
              onChange={(quantity) => controls.onQuantityChange(line.id, quantity, line.quantity)}
            />
          )}
        </div>
        <LinePrice line={line} />
      </div>
      {failure && <FailureNotice failure={failure} onDismiss={() => controls.onDismissFailure(line.id)} />}
    </li>
  )
}

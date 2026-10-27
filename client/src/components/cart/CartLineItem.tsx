import { Ban, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { CartLine } from '@/domain/cart/model'
import { formatMoney } from '@/domain/money'
import type { QuantityFailure, QuantitySnapshot } from '@/state/quantitySync'
import { blockedPriceText, lineTitle, quantityFailureText } from './copy'
import { DurationPicker } from './DurationPicker'
import { lineElementId } from './focus'
import { QuantityStepper } from './QuantityStepper'
import { RemoveLineButton } from './RemoveLineButton'

/** What a line needs to be edited, passed down unchanged from the page */
export interface LineControls {
  /** False while changes can't be sent, e.g. offline */
  editable: boolean
  local: QuantitySnapshot
  /** `shown` is the quantity on screen when the change was asked for */
  onQuantityChange: (lineId: string, quantity: number, shown: number) => void
  onDismissFailure: (lineId: string) => void
  /** Resolves once saved; rejects with the reason */
  onSelectDuration: (lineId: string, optionId: string) => Promise<void>
  /** Resolves once removed; rejects with the reason */
  onRemove: (lineId: string) => Promise<void>
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
  const title = lineTitle(line)
  const duration = line.durations.find((option) => option.id === line.selectedDurationId)
  const details = [line.provider?.name, duration && `${duration.minutes} min`].filter(Boolean).join(' · ')
  const failure = controls.local.failures.get(line.id)

  return (
    // Focusable from script, so focus can land here after a neighbouring line is removed
    <li
      id={lineElementId(line.id)}
      tabIndex={-1}
      className="space-y-3 border-t py-3 outline-none first:border-t-0 focus-visible:rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className={unavailable ? 'font-medium break-words text-muted-foreground' : 'font-medium break-words'}>
            {title}
          </p>
          {details && <p className="text-sm text-muted-foreground">{details}</p>}
          {unavailable && (
            <Badge variant="outline" className="font-normal">
              <Ban aria-hidden />
              Removed by the provider. It won't be booked.
            </Badge>
          )}
        </div>
        <LinePrice line={line} />
      </div>

      {!unavailable && (
        <DurationPicker
          line={line}
          editable={controls.editable}
          onSelect={(optionId) => controls.onSelectDuration(line.id, optionId)}
        />
      )}

      <div className="flex flex-wrap items-start justify-between gap-2">
        {unavailable ? (
          <span />
        ) : (
          <QuantityStepper
            title={title}
            quantity={line.quantity}
            disabled={!controls.editable}
            saving={controls.local.pending.has(line.id)}
            onChange={(quantity) => controls.onQuantityChange(line.id, quantity, line.quantity)}
          />
        )}
        <RemoveLineButton
          title={title}
          editable={controls.editable}
          prominent={unavailable}
          onRemove={() => controls.onRemove(line.id)}
        />
      </div>

      {failure && <FailureNotice failure={failure} onDismiss={() => controls.onDismissFailure(line.id)} />}
    </li>
  )
}

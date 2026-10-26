import { Ban } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { CartLine } from '@/domain/cart/model'
import { formatMoney } from '@/domain/money'
import { blockedPriceText, lineTitle } from './copy'

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

export function CartLineItem({ line }: { line: CartLine }) {
  const unavailable = line.status.kind === 'unavailable'
  const duration = line.durations.find((option) => option.id === line.selectedDurationId)
  const details = [line.provider?.name, duration && `${duration.minutes} min`].filter(Boolean).join(' · ')

  return (
    <li className="flex items-start justify-between gap-4 border-t py-3 first:border-t-0">
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
          <p className="text-sm text-muted-foreground">Quantity: {line.quantity}</p>
        )}
      </div>
      <LinePrice line={line} />
    </li>
  )
}

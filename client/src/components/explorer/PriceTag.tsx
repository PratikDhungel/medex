import { describePrice } from '@/domain/priceDisplay'
import type { ServicePricing } from '@/domain/model'

interface PriceTagProps {
  pricing: ServicePricing
  currency: string | null
}

export function PriceTag({ pricing, currency }: PriceTagProps) {
  const display = describePrice(pricing, currency)

  if (display.kind === 'on-request') {
    return <p className="shrink-0 text-right text-sm text-muted-foreground">Price on request</p>
  }

  return (
    <div className="shrink-0 text-right">
      <p className="whitespace-nowrap">
        {display.from && <span className="text-xs text-muted-foreground">From </span>}
        <span className="font-semibold tabular-nums">{display.final}</span>
      </p>
      {display.original && (
        <p className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
          <span className="sr-only">Was </span>
          <s>{display.original}</s>
        </p>
      )}
      {display.detail && <p className="text-xs text-muted-foreground">{display.detail}</p>}
    </div>
  )
}

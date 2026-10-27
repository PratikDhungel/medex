import { Clock, MapPin } from 'lucide-react'
import { zonedDateTimeAt, type TimeZone } from '@shared/time/zone'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatTime, offsetDifferenceText, sameClock, zoneCity } from '@/domain/booking/clock'
import { zoneTimeLabel } from './copy'

interface ZoneLegendProps {
  provider: TimeZone
  customer: TimeZone
  now: number
}

/**
 * Says once, up front, which clock every time on the page uses, and shows
 * both clocks live. Below this, provider times are always bold and the
 * customer's own time is always smaller, grey and labelled "your time".
 */
export function ZoneLegend({ provider, customer, now }: ZoneLegendProps) {
  const here = zonedDateTimeAt(provider, now)

  if (sameClock(provider, customer, now)) {
    return (
      <div className="flex items-start gap-3 rounded-xl border bg-muted/50 px-4 py-3 text-sm">
        <Clock aria-hidden className="mt-0.5 size-4 shrink-0" />
        <p>
          All times are in <strong>{zoneTimeLabel(provider)}</strong>, the same as your own clock. It's{' '}
          {formatTime(here.time)} there now.
        </p>
      </div>
    )
  }

  const yours = zonedDateTimeAt(customer, now)
  const difference = offsetDifferenceText(provider, customer, now)

  return (
    <section aria-labelledby="zone-legend-title" className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-4">
      <div className="space-y-1">
        <h2 id="zone-legend-title" className="flex items-center gap-2 font-accent font-semibold">
          <MapPin aria-hidden className="size-4 text-primary" />
          Times are shown in {zoneTimeLabel(provider)}
        </h2>
        <p className="text-sm">
          That's where your appointment is. Your own time ({zoneCity(customer)}) is shown under each time, in grey.{' '}
          {zoneCity(provider)} is {difference}.
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:max-w-md">
        <div className="rounded-lg bg-background px-3 py-2">
          <dt className="text-muted-foreground">Now in {zoneCity(provider)}</dt>
          <dd className="font-semibold tabular-nums">
            {formatTime(here.time)}
            {here.date !== yours.date && <span className="font-normal"> · {formatDate(here.date)}</span>}
          </dd>
        </div>
        <div className="rounded-lg bg-background px-3 py-2">
          <dt className="text-muted-foreground">Your time ({zoneCity(customer)})</dt>
          <dd className="tabular-nums text-muted-foreground">
            {formatTime(yours.time)}
            {here.date !== yours.date && <span> · {formatDate(yours.date)}</span>}
          </dd>
        </div>
      </dl>
    </section>
  )
}

export function ZoneLegendSkeleton() {
  return <Skeleton className="h-36 w-full rounded-xl" />
}

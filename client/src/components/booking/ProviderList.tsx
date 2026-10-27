import { ArrowRight, Clock } from 'lucide-react'
import { Link } from 'react-router'
import { zonedDateTimeAt, type TimeZone } from '@shared/time/zone'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatTime, offsetDifferenceText, zoneCity } from '@/domain/booking/clock'
import type { BookingProvider } from '@/domain/booking/model'
import { countryName } from './copy'

interface ProviderListProps {
  providers: BookingProvider[]
  customerZone: TimeZone
  now: number
}

/** Providers that take bookings, each with its local time, so the time difference is clear before choosing */
export function ProviderList({ providers, customerZone, now }: ProviderListProps) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {providers.map((provider) => {
        const specialities = [...new Set(provider.specialists.flatMap((s) => (s.speciality ? [s.speciality] : [])))]
        return (
          <li key={provider.id}>
            <Card className="h-full gap-3 px-5 py-5">
              <div className="space-y-0.5">
                <h2 className="font-accent font-semibold">{provider.name}</h2>
                {provider.country && <p className="text-sm text-muted-foreground">{countryName(provider.country)}</p>}
              </div>
              {specialities.length > 0 && <p className="text-sm">{specialities.join(' · ')}</p>}
              {provider.zone ? (
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Clock aria-hidden className="mt-0.5 size-4 shrink-0" />
                  <span>
                    {formatTime(zonedDateTimeAt(provider.zone, now).time)} in {zoneCity(provider.zone)} now
                    {offsetDifferenceText(provider.zone, customerZone, now) &&
                      `, ${offsetDifferenceText(provider.zone, customerZone, now)}`}
                  </span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Online booking isn't available here.</p>
              )}
              {provider.zone && (
                <Link
                  to={`/book/${provider.id}`}
                  className="mt-auto inline-flex items-center gap-1 self-start rounded-sm font-accent text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  Book an appointment
                  <span className="sr-only"> at {provider.name}</span>
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
              )}
            </Card>
          </li>
        )
      })}
    </ul>
  )
}

export function ProviderListSkeleton() {
  return (
    <ul aria-label="Loading providers" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <li key={i}>
          <Skeleton className="h-44 rounded-xl" />
        </li>
      ))}
    </ul>
  )
}

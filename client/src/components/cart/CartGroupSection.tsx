import { CircleAlert, CircleCheck } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { CartGroup } from '@/domain/cart/model'
import { formatMoney } from '@/domain/money'
import { BookButton } from './BookButton'
import { CartLineItem, type LineControls } from './CartLineItem'
import type { Booking } from './CartView'
import { blockerText, formatList, groupLabel, lineTitle, plural } from './copy'
import { groupHeadingId } from './focus'

function GroupStatus({ group }: { group: CartGroup }) {
  if (!group.bookable) {
    return <p className="text-sm text-muted-foreground">Nothing here can be booked. Remove these items to tidy your cart.</p>
  }
  if (group.ready) {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
        <CircleCheck aria-hidden className="size-4" />
        Ready to book
      </p>
    )
  }

  const titles = new Map(group.lines.map((line) => [line.id, lineTitle(line)]))
  return (
    <div className="flex items-start gap-2 text-sm">
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600" />
      <div>
        <p className="font-medium">Not ready to book yet</p>
        <ul className="text-muted-foreground">
          {group.blockers.map(({ lineId, reason }) => (
            <li key={lineId}>{blockerText(reason, titles.get(lineId) ?? 'This service')}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Subtotals({ group }: { group: CartGroup }) {
  if (!group.bookable) return null
  const unpriced = group.blockers.length

  return (
    <div className="text-right">
      <p className="text-xs text-muted-foreground">
        {group.subtotals.length > 1 ? `Subtotal, in ${group.subtotals.length} currencies` : 'Subtotal'}
      </p>
      {group.subtotals.length === 0 ? (
        <p className="text-sm text-muted-foreground">Not priced yet</p>
      ) : (
        <ul>
          {group.subtotals.map(({ currency, amount }) => (
            <li key={currency} className="font-semibold tabular-nums">
              {formatMoney(amount, currency)}
            </li>
          ))}
        </ul>
      )}
      {unpriced > 0 && group.subtotals.length > 0 && (
        <p className="text-xs text-muted-foreground">+ {plural(unpriced, 'item')} not priced yet</p>
      )}
    </div>
  )
}

/** One cart group: what becomes one booking, paid for on its own */
export function CartGroupSection({ group, controls, booking }: { group: CartGroup; controls: LineControls; booking: Booking }) {
  const headingId = groupHeadingId(group.type)
  const providers = formatList(group.providers.map((provider) => provider.name))
  const excluded = group.bookable ? group.excludedLineIds.length : 0

  return (
    <Card aria-labelledby={headingId} className="gap-0 py-0" role="region">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 pt-4 pb-2 sm:px-6 sm:pt-5">
        <div className="min-w-0 space-y-1">
          <h2
            id={headingId}
            tabIndex={-1}
            className="rounded-sm font-accent text-lg leading-snug font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {groupLabel(group)}
          </h2>
          {providers && <p className="text-sm text-muted-foreground">From {providers}</p>}
        </div>
        <p className="text-sm text-muted-foreground">{plural(group.itemCount, 'item')}</p>
      </header>

      <ul className="px-4 sm:px-6">
        {group.lines.map((line) => (
          <CartLineItem key={line.id} line={line} controls={controls} />
        ))}
      </ul>

      <footer className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="space-y-1">
          <GroupStatus group={group} />
          {excluded > 0 && (
            <p className="text-sm text-muted-foreground">
              {plural(excluded, 'item')} here {excluded === 1 ? 'is' : 'are'} no longer offered and won't be booked.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <Subtotals group={group} />
          {group.ready && (
            <BookButton booking={booking} groupTypes={[group.type]} variant="outline">
              Book {groupLabel(group).toLowerCase()}
            </BookButton>
          )}
        </div>
      </footer>
    </Card>
  )
}

/** Placeholder shaped like a group, so nothing shifts when the cart arrives */
export function CartGroupSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <Card aria-hidden className="gap-0 py-0">
      <div className="space-y-2 px-4 pt-4 pb-2 sm:px-6 sm:pt-5">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="px-4 sm:px-6">
        {Array.from({ length: lines }, (_, index) => (
          <div key={index} className="flex justify-between gap-4 border-t py-3 first:border-t-0">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
      <div className="flex justify-between border-t px-4 py-3 sm:px-6">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-24" />
      </div>
    </Card>
  )
}

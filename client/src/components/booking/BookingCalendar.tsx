import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { calendarDateToUtcMs, parseCalendarDate, type CalendarDate } from '@shared/time/calendarDate'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  addMonths,
  bookingWindow,
  dayStatusOn,
  inWindow,
  monthOf,
  monthWeeks,
  moveFocus,
  nextAvailableDate,
  windowMonths,
  type CalendarKey,
  type Month,
} from '@/domain/booking/calendar'
import { formatDate } from '@/domain/booking/clock'
import type { DayAvailability } from '@/domain/booking/model'
import { cn } from '@/lib/utils'
import { dayShortLabel } from './dayCopy'

interface BookingCalendarProps {
  /** The 90 days from the server */
  days: DayAvailability[]
  /** Today at the provider, by this browser's clock */
  providerToday: CalendarDate
  selected: CalendarDate | null
  onSelect: (date: CalendarDate) => void
  /** The full sentence for a day, used in its accessible name */
  reasonFor: (day: DayAvailability) => string
  /** "Bangkok" */
  city: string
}

const CALENDAR_KEYS = new Set<string>(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'])

const monthTitle = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
const weekdayLong = new Intl.DateTimeFormat(undefined, { weekday: 'long', timeZone: 'UTC' })
const weekdayShort = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' })
// 4–10 January 2026 run Sunday to Saturday
const WEEKDAY_DATES = Array.from({ length: 7 }, (_, i) => Date.UTC(2026, 0, 4 + i))

/**
 * The 90-day calendar, one month at a time, on the provider's calendar.
 * Follows the WAI-ARIA date picker grid: one day in the tab order, arrow keys
 * by day and week, Home/End for the week, PageUp/PageDown for the month.
 * Unavailable days stay reachable and selectable so the day panel can say
 * why and offer another date; each carries a short word in the cell and the
 * full reason in its accessible name.
 */
export function BookingCalendar({ days, providerToday, selected, onSelect, reasonFor, city }: BookingCalendarProps) {
  const window = useMemo(() => bookingWindow(providerToday), [providerToday])
  const byDate = useMemo(() => new Map(days.map((day) => [day.date, day])), [days])

  const initialFocus = () =>
    selected && inWindow(selected, window) ? selected : (nextAvailableDate(days, null, providerToday) ?? window.first)
  const [focused, setFocused] = useState<CalendarDate>(initialFocus)
  const [month, setMonth] = useState<Month>(() => monthOf(initialFocus()))
  const grid = useRef<HTMLTableElement>(null)
  const moveFocusRequested = useRef(false)

  // Keep the roving day valid when the window moves (midnight at the provider) or the selection changes
  const focusedDay = inWindow(focused, window) ? focused : window.first
  if (focusedDay !== focused) setFocused(focusedDay)
  const [lastSelected, setLastSelected] = useState(selected)
  if (selected !== lastSelected) {
    setLastSelected(selected)
    if (selected && inWindow(selected, window)) {
      setFocused(selected)
      setMonth(monthOf(selected))
    }
  }

  useEffect(() => {
    if (!moveFocusRequested.current) return
    moveFocusRequested.current = false
    grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus()
  }, [focused, month])

  const months = windowMonths(window)
  const showMonth = (next: Month) => {
    setMonth(next)
    // The roving day follows into the month shown, so Tab lands inside it
    // 31 October → no 31 November, so the month's first day instead
    const sameDay = parseCalendarDate(`${next}-${focused.slice(8)}`)
    const candidate = sameDay && inWindow(sameDay, window) ? sameDay : null
    setFocused(candidate ?? (next === monthOf(window.first) ? window.first : `${next}-01`))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, date: CalendarDate) => {
    if (!CALENDAR_KEYS.has(event.key)) return
    event.preventDefault()
    const next = moveFocus(date, event.key as CalendarKey, window)
    moveFocusRequested.current = true
    setFocused(next)
    setMonth(monthOf(next))
  }

  const titleId = `calendar-${month}`

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 id={titleId} aria-live="polite" className="font-accent font-semibold">
          {monthTitle.format(calendarDateToUtcMs(`${month}-01`))}
        </h3>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Previous month"
            disabled={month <= months[0]}
            onClick={() => showMonth(addMonths(month, -1))}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Next month"
            disabled={month >= months[months.length - 1]}
            onClick={() => showMonth(addMonths(month, 1))}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>

      <table ref={grid} role="grid" aria-labelledby={titleId} className="w-full table-fixed border-separate border-spacing-1">
        <thead>
          <tr>
            {WEEKDAY_DATES.map((ms) => (
              <th key={ms} scope="col" abbr={weekdayLong.format(ms)} className="pb-1 text-xs font-medium text-muted-foreground">
                {weekdayShort.format(ms)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthWeeks(month).map((week, row) => (
            <tr key={row}>
              {week.map((date, column) => {
                if (!date) return <td key={column} />
                const day = dayStatusOn(date, byDate, providerToday, window)
                return (
                  <td key={date} role="gridcell" aria-selected={date === selected}>
                    {inWindow(date, window) ? (
                      <DayButton
                        day={day}
                        isToday={date === providerToday}
                        selected={date === selected}
                        focusable={date === focusedDay}
                        label={dayLabel(day, date === providerToday, city, reasonFor)}
                        onClick={() => {
                          setFocused(date)
                          onSelect(date)
                        }}
                        onKeyDown={(event) => onKeyDown(event, date)}
                      />
                    ) : (
                      // Past days and days beyond the window: shown for orientation only
                      <span className="flex h-12 items-center justify-center rounded-lg text-sm text-muted-foreground/60 sm:h-14">
                        <span aria-hidden>{Number(date.slice(8))}</span>
                        <span className="sr-only">{dayLabel(day, false, city, reasonFor)}</span>
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** "Monday, 2 November, 6 times available" or "Friday, 30 October, unavailable. Riverside closes at…" */
function dayLabel(day: DayAvailability, isToday: boolean, city: string, reasonFor: (day: DayAvailability) => string) {
  const date = `${formatDate(day.date, 'long')}${isToday ? `, today in ${city}` : ''}`
  return day.status === 'available' ? `${date}, ${reasonFor(day)}` : `${date}, unavailable. ${reasonFor(day)}`
}

interface DayButtonProps {
  day: DayAvailability
  isToday: boolean
  selected: boolean
  focusable: boolean
  label: string
  onClick: () => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
}

function DayButton({ day, isToday, selected, focusable, label, onClick, onKeyDown }: DayButtonProps) {
  const available = day.status === 'available'
  const word = dayShortLabel(day)
  return (
    <button
      type="button"
      data-date={day.date}
      tabIndex={focusable ? 0 : -1}
      aria-label={label}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={cn(
        'flex h-12 w-full flex-col items-center justify-center rounded-lg text-sm tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60 sm:h-14',
        available ? 'font-semibold hover:bg-accent' : 'bg-muted/60 text-muted-foreground hover:bg-muted',
        isToday && !selected && 'ring-1 ring-foreground/40',
        // A chosen day that can't be booked is outlined, not filled like a real choice
        selected && (available ? 'bg-primary text-primary-foreground hover:bg-primary' : 'ring-2 ring-primary'),
      )}
    >
      <span aria-hidden>{Number(day.date.slice(8))}</span>
      <span aria-hidden className={cn('text-[10px] leading-tight font-normal', available && !selected && 'text-primary')}>
        {available ? `${day.startCount} free` : word}
      </span>
    </button>
  )
}

/** The words used in the cells, explained once */
export function CalendarLegend() {
  const items: [string, string][] = [
    ['Closed', 'the provider is closed'],
    ['Off', "the specialist's hours fall outside opening hours"],
    ['Full', 'every time is booked'],
    ['Ended', "today's last time has started"],
    ['Too few', 'not enough times in a row for your group'],
  ]
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map(([word, meaning]) => (
        <div key={word} className="flex gap-1">
          <dt className="font-medium text-foreground">{word}:</dt>
          <dd>{meaning}</dd>
        </div>
      ))}
    </dl>
  )
}

export function BookingCalendarSkeleton() {
  return (
    <div aria-hidden className="space-y-3">
      <div className="flex justify-between">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }, (_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg sm:h-14" />
        ))}
      </div>
    </div>
  )
}

import { Info } from 'lucide-react'
import type { CalendarDate } from '@shared/time/calendarDate'
import type { WallTime } from '@shared/time/wallTime'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatTime } from '@/domain/booking/clock'
import { groupByPartOfDay, type PartOfDay, type SlotState, type SlotView } from '@/domain/booking/slotView'
import { cn } from '@/lib/utils'

interface SlotPickerProps {
  date: CalendarDate
  views: SlotView[]
  selected: WallTime | null
  onSelect: (time: WallTime) => void
  people: number
  /** "Bangkok" */
  providerCity: string
  /** "Kathmandu", or null when both clocks agree and one is enough */
  customerCity: string | null
  /** Why some of the specialist's advertised hours aren't offered today */
  hoursNote: string | null
}

const PART_TITLES: Record<PartOfDay, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' }

/** "4 of 6 free"; for a group, how many times can start it, since a free slot alone isn't enough */
function partCount(slots: SlotView[], people: number): string {
  const count = slots.filter((slot) => slot.state === 'available').length
  return people === 1 ? `${count} of ${slots.length} free` : `${count} start ${count === 1 ? 'time' : 'times'}`
}

const STATE_WORDS: Record<Exclude<SlotState, 'available'>, (people: number) => string> = {
  booked: () => 'Booked',
  started: () => 'Started',
  'no-room': (people) => `No room for ${people}`,
  current: () => 'Your booking now',
}

/**
 * The day's times as native radio buttons, grouped by part of the day: one
 * tab stop, arrow keys move between the times that can be chosen, and screen
 * readers announce position and state. Times that can't be chosen stay
 * visible and say why.
 */
export function SlotPicker({ date, views, selected, onSelect, people, providerCity, customerCity, hoursNote }: SlotPickerProps) {
  return (
    <div className="space-y-4">
      {hoursNote && (
        <p className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {hoursNote}
        </p>
      )}
      {people > 1 && (
        <p id="slot-group-hint" className="text-sm text-muted-foreground">
          Each time shown starts {people} appointments one after another. Times without room for all {people} say so.
        </p>
      )}
      {groupByPartOfDay(views).map(({ part, slots }) => (
        <fieldset key={part} className="space-y-2">
          <legend className="text-sm font-medium">
            {PART_TITLES[part]}
            <span className="font-normal text-muted-foreground"> · {partCount(slots, people)}</span>
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {slots.map((slot) => (
              <SlotOption
                key={slot.start}
                date={date}
                slot={slot}
                checked={slot.start === selected}
                onSelect={onSelect}
                people={people}
                providerCity={providerCity}
                customerCity={customerCity}
              />
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  )
}

interface SlotOptionProps {
  date: CalendarDate
  slot: SlotView
  checked: boolean
  onSelect: (time: WallTime) => void
  people: number
  providerCity: string
  customerCity: string | null
}

function SlotOption({ date, slot, checked, onSelect, people, providerCity, customerCity }: SlotOptionProps) {
  const available = slot.state === 'available'
  const customerDate = slot.customer.date !== date ? `, ${formatDate(slot.customer.date)}` : ''
  return (
    <label
      className={cn(
        'flex flex-col rounded-lg border px-3 py-2 tabular-nums',
        available
          ? 'cursor-pointer hover:border-primary/60 has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground'
          : 'cursor-not-allowed border-dashed bg-muted/40 text-muted-foreground',
        'has-focus-visible:ring-[3px] has-focus-visible:ring-ring/60',
      )}
    >
      <input
        type="radio"
        name="slot"
        value={slot.start}
        checked={checked}
        disabled={!available}
        aria-describedby={slot.state === 'no-room' ? 'slot-group-hint' : undefined}
        onChange={() => onSelect(slot.start)}
        className="sr-only"
      />
      <span className={cn('font-semibold', !available && 'line-through decoration-1')}>
        {formatTime(slot.start)}
        <span className="sr-only"> {providerCity} time</span>
      </span>
      {slot.state === 'available' ? (
        customerCity && (
          <span className={cn('text-xs', checked ? 'text-primary-foreground/85' : 'text-muted-foreground')}>
            <span className="sr-only">, </span>
            {formatTime(slot.customer.time)}
            {customerDate} your time
          </span>
        )
      ) : (
        <span className="text-xs">
          <span className="sr-only">, </span>
          {STATE_WORDS[slot.state](people)}
        </span>
      )}
    </label>
  )
}

export function SlotPickerSkeleton() {
  return (
    <div aria-hidden className="space-y-2">
      <Skeleton className="h-4 w-32" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

import { MAX_PEOPLE } from '@shared/booking/availability'
import { cn } from '@/lib/utils'

interface PeoplePickerProps {
  people: number
  onChange: (people: number) => void
}

const OPTIONS = Array.from({ length: MAX_PEOPLE }, (_, i) => i + 1)

/** 1 to 4 people, as native radio buttons shown as a segmented control */
export function PeoplePicker({ people, onChange }: PeoplePickerProps) {
  return (
    <fieldset className="space-y-3">
      <legend className="font-accent text-lg font-semibold">How many people?</legend>
      <p id="people-hint" className="-mt-1 text-sm text-muted-foreground">
        Each person has their own appointment, one after another with the same specialist.
      </p>
      <div className="inline-flex rounded-full border p-1">
        {OPTIONS.map((count) => (
          <label
            key={count}
            className={cn(
              'flex h-9 min-w-11 cursor-pointer items-center justify-center rounded-full px-3 text-sm font-medium tabular-nums',
              'has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50',
            )}
          >
            <input
              type="radio"
              name="people"
              value={count}
              checked={people === count}
              aria-describedby="people-hint"
              onChange={() => onChange(count)}
              className="sr-only"
            />
            {count}
            <span className="sr-only">{count === 1 ? ' person' : ' people'}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

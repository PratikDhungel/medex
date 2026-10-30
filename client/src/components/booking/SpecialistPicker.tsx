import type { TimeZone } from '@shared/time/zone'
import { Skeleton } from '@/components/ui/skeleton'
import type { Specialist } from '@/domain/booking/model'
import { cn } from '@/lib/utils'
import { consultationText, zoneTimeLabel } from './copy'

interface SpecialistPickerProps {
  specialists: Specialist[]
  zone: TimeZone
  selectedId: string | null
  onSelect: (specialistId: string) => void
}

/**
 * Native radio buttons, styled as cards: arrow keys move between them and
 * screen readers announce "1 of 3" for free.
 */
export function SpecialistPicker({ specialists, zone, selectedId, onSelect }: SpecialistPickerProps) {
  return (
    <fieldset className="space-y-3">
      <legend className="font-accent text-lg font-semibold">Choose a specialist</legend>
      <p className="-mt-1 text-sm text-muted-foreground">Consulting hours are in {zoneTimeLabel(zone)}.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {specialists.map((specialist) => {
          const bookable = specialist.consultation !== null
          const hintId = `specialist-${specialist.id}-hint`
          return (
            <label
              key={specialist.id}
              className={cn(
                'flex cursor-pointer gap-3 rounded-xl border px-4 py-3 has-checked:border-primary has-checked:bg-primary/5 has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50',
                !bookable && 'cursor-not-allowed opacity-60',
              )}
            >
              <input
                type="radio"
                name="specialist"
                value={specialist.id}
                checked={selectedId === specialist.id}
                disabled={!bookable}
                aria-describedby={hintId}
                onChange={() => onSelect(specialist.id)}
                className="mt-1 size-4 shrink-0 accent-primary outline-none"
              />
              <span className="space-y-0.5">
                <span className="block font-medium">{specialist.name}</span>
                {specialist.speciality && <span className="block text-sm">{specialist.speciality}</span>}
                <span id={hintId} className="block text-sm text-muted-foreground">
                  {specialist.consultation
                    ? consultationText(specialist.consultation)
                    : "Not taking online bookings: we couldn't read this specialist's hours"}
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export function SpecialistPickerSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <Skeleton className="h-6 w-48" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

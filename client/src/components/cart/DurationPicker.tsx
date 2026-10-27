import { useId, useState } from 'react'
import type { CartLine } from '@/domain/cart/model'
import { formatMoney } from '@/domain/money'
import { cn } from '@/lib/utils'
import { durationFailureText, lineTitle } from './copy'

interface DurationPickerProps {
  line: CartLine
  /** False while changes can't be sent, e.g. offline */
  editable: boolean
  /** Resolves once the server has saved the choice */
  onSelect: (optionId: string) => Promise<void>
}

/**
 * Wellness durations as a radio group. The choice shows straight away; the
 * price follows once the server has saved it. Arrow keys move between
 * options, as with any radio group.
 */
export function DurationPicker({ line, editable, onSelect }: DurationPickerProps) {
  const name = useId()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const checked = pending ?? line.selectedDurationId

  const choose = async (optionId: string) => {
    // One save at a time; the radios stay where the customer put them meanwhile
    if (pending !== null || optionId === line.selectedDurationId) return
    setPending(optionId)
    setError(null)
    try {
      await onSelect(optionId)
    } catch (failure) {
      setError(failure)
    } finally {
      setPending(null)
    }
  }

  if (line.durations.length === 0 || line.currency === null) return null
  const { currency } = line

  return (
    <fieldset disabled={!editable} aria-busy={pending !== null} className="space-y-2">
      <legend className="mb-1 text-sm font-medium">
        {line.selectedDurationId ? 'Duration' : 'Choose a duration'}
        <span className="sr-only"> for {lineTitle(line)}</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {line.durations.map((option) => (
          <label
            key={option.id}
            className={cn(
              'cursor-pointer rounded-full border px-3 py-1.5 text-sm tabular-nums transition-colors',
              'hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:font-medium',
              'has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
              'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={checked === option.id}
              onChange={() => void choose(option.id)}
              className="sr-only"
            />
            {option.minutes} min · {formatMoney(option.price, currency)}
          </label>
        ))}
      </div>
      {pending !== null && (
        <p aria-hidden className="text-xs text-muted-foreground">
          Saving…
        </p>
      )}
      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {durationFailureText(error)}
        </p>
      )}
    </fieldset>
  )
}

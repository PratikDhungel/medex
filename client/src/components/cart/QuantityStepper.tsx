import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface QuantityStepperProps {
  /** Names the service, for screen readers */
  title: string
  quantity: number
  onChange: (quantity: number) => void
  /** Changes can't be made right now, e.g. offline */
  disabled?: boolean
  /** A change is being saved */
  saving?: boolean
}

// aria-disabled rather than disabled: a disabled button drops keyboard focus
// to the page, so tapping "−" down to 1 would lose the customer's place.
const stepClass = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-40'

/** − quantity +. Going below 1 is removing, which has its own button. */
export function QuantityStepper({ title, quantity, onChange, disabled = false, saving = false }: QuantityStepperProps) {
  const canDecrease = !disabled && quantity > 1
  const canIncrease = !disabled

  return (
    <div className="flex items-center gap-2">
      <div role="group" aria-label={`Quantity of ${title}`} className="inline-flex items-center rounded-full border">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Decrease quantity"
          aria-disabled={!canDecrease}
          className={stepClass}
          onClick={() => canDecrease && onChange(quantity - 1)}
        >
          <Minus aria-hidden />
        </Button>
        <span aria-live="polite" aria-atomic="true" className="min-w-7 text-center text-sm font-medium tabular-nums">
          {quantity}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Increase quantity"
          aria-disabled={!canIncrease}
          className={stepClass}
          onClick={() => canIncrease && onChange(quantity + 1)}
        >
          <Plus aria-hidden />
        </Button>
      </div>
      {/* Visual only: the number itself is announced */}
      <span aria-hidden className={cn('text-xs text-muted-foreground', !saving && 'invisible')}>
        Saving…
      </span>
    </div>
  )
}

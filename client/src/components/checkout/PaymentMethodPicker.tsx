import { useId } from 'react'
import type { PaymentMethod } from '@/domain/checkout/model'
import { cn } from '@/lib/utils'

const DESCRIPTIONS: Record<PaymentMethod, { label: string; hint: string }> = {
  card: { label: 'Card', hint: 'Pay now. Charged once this order is placed.' },
  pay_at_clinic: { label: 'Pay at the clinic', hint: 'Book now, pay the provider on the day.' },
}

interface PaymentMethodPickerProps {
  /** Names the order, for screen readers */
  legend: string
  methods: PaymentMethod[]
  value: PaymentMethod
  onChange: (method: PaymentMethod) => void
  disabled?: boolean
}

export function PaymentMethodPicker({ legend, methods, value, onChange, disabled = false }: PaymentMethodPickerProps) {
  const name = useId()

  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="mb-1 text-sm font-medium">
        <span aria-hidden>Payment</span>
        <span className="sr-only">{legend}</span>
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {methods.map((method) => (
          <label
            key={method}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm',
              'hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5',
              'has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50',
            )}
          >
            <input
              type="radio"
              name={name}
              value={method}
              checked={value === method}
              onChange={() => onChange(method)}
              className="mt-1 accent-primary"
            />
            <span>
              <span className="block font-medium">{DESCRIPTIONS[method].label}</span>
              <span className="block text-muted-foreground">{DESCRIPTIONS[method].hint}</span>
            </span>
          </label>
        ))}
      </div>
      {methods.length === 1 && <p className="text-xs text-muted-foreground">This order can only be paid by card.</p>}
    </fieldset>
  )
}

import { useId, useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { parsePriceInput, type FacetOption, type PriceBounds } from '@/domain/filters'
import { formatMoney } from '@/domain/money'
import { cn } from '@/lib/utils'

const numberFormat = new Intl.NumberFormat('en')

export interface PriceRange {
  min: number | null
  max: number | null
}

interface PriceFacetProps {
  currencies: FacetOption<string>[]
  currency: string | null
  /** Offers "Any currency"; false when the currency was preselected rather than chosen */
  clearable: boolean
  onCurrencyChange: (currency: string | null) => void
  /** Price range of the matching services in the chosen currency */
  bounds: PriceBounds | null
  min: number | null
  max: number | null
  onRangeChange: (range: PriceRange) => void
}

/**
 * Prices can't be compared across currencies, so a range only applies once a
 * currency is chosen.
 */
export function PriceFacet({ currencies, currency, clearable, onCurrencyChange, bounds, min, max, onRangeChange }: PriceFacetProps) {
  const name = useId()

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Currency" className="space-y-0.5">
        {currencies.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-accent',
              option.disabled && 'cursor-not-allowed text-muted-foreground hover:bg-transparent',
            )}
          >
            <input
              type="radio"
              name={name}
              className="size-4 shrink-0 accent-primary"
              value={option.value}
              checked={option.selected}
              disabled={option.disabled}
              onChange={() => onCurrencyChange(option.value)}
            />
            <span className="flex-1">{option.label}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {numberFormat.format(option.count)}
              <span className="sr-only"> {option.count === 1 ? 'service' : 'services'}</span>
            </span>
          </label>
        ))}
      </div>

      {currency === null ? (
        <p className="px-1 text-sm text-muted-foreground">Choose a currency to set a price range.</p>
      ) : (
        <>
          {/* Remounts when the range changes from outside (e.g. "Clear all"), resetting what was typed */}
          <PriceRangeInputs
            key={`${currency}:${min}:${max}`}
            currency={currency}
            bounds={bounds}
            min={min}
            max={max}
            onRangeChange={onRangeChange}
          />
          {clearable && (
            <Button type="button" variant="link" size="sm" className="h-auto px-1" onClick={() => onCurrencyChange(null)}>
              Any currency
            </Button>
          )}
        </>
      )}
    </div>
  )
}

interface PriceRangeInputsProps {
  currency: string
  bounds: PriceBounds | null
  min: number | null
  max: number | null
  onRangeChange: (range: PriceRange) => void
}

function PriceRangeInputs({ currency, bounds, min, max, onRangeChange }: PriceRangeInputsProps) {
  const errorId = useId()
  const [minText, setMinText] = useState(min === null ? '' : String(min))
  const [maxText, setMaxText] = useState(max === null ? '' : String(max))
  const [error, setError] = useState<string | null>(null)

  // Applied on blur or Enter, never while typing
  const apply = () => {
    const nextMin = parsePriceInput(minText)
    const nextMax = parsePriceInput(maxText)
    if (nextMin === 'invalid' || nextMax === 'invalid') {
      setError('Enter a price of 0 or more.')
      return
    }
    if (nextMin !== null && nextMax !== null && nextMin > nextMax) {
      setError("The minimum can't be more than the maximum.")
      return
    }
    setError(null)
    if (nextMin !== min || nextMax !== max) onRangeChange({ min: nextMin, max: nextMax })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') apply()
  }

  const field = (label: 'Min' | 'Max', value: string, setValue: (text: string) => void, hint: number | undefined) => (
    <label className="min-w-0 flex-1 space-y-1">
      <span className="block px-1 text-xs text-muted-foreground">
        {label} ({currency})
      </span>
      <Input
        inputMode="decimal"
        autoComplete="off"
        value={value}
        placeholder={hint === undefined ? undefined : numberFormat.format(hint)}
        aria-invalid={error !== null}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => setValue(event.target.value)}
        onBlur={apply}
        onKeyDown={onKeyDown}
      />
    </label>
  )

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {field('Min', minText, setMinText, bounds?.min)}
        {field('Max', maxText, setMaxText, bounds?.max)}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="px-1 text-xs text-destructive">
          {error}
        </p>
      ) : (
        bounds && (
          <p className="px-1 text-xs text-muted-foreground">
            Matching services cost {formatMoney(bounds.min, currency)} to {formatMoney(bounds.max, currency)}.
          </p>
        )
      )}
    </div>
  )
}

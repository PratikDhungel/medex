import { useId, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/** Finds a booking by its reference, to see or change it. There's no account list of bookings in this exercise. */
export function ManageBooking() {
  const navigate = useNavigate()
  const id = useId()
  const [reference, setReference] = useState('')
  const [error, setError] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const cleaned = reference.trim().toUpperCase()
    if (!cleaned) {
      setError(true)
      return
    }
    navigate(`/bookings/${encodeURIComponent(cleaned)}`)
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-2 rounded-xl border px-4 py-4 sm:max-w-md">
      <label htmlFor={id} className="block font-accent font-semibold">
        Manage a booking
      </label>
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        Enter your booking reference to see it or change its date or time, e.g. BK-20261008-0042.
      </p>
      <div className="flex gap-2">
        <Input
          id={id}
          value={reference}
          onChange={(event) => {
            setReference(event.target.value)
            setError(false)
          }}
          aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
          aria-invalid={error}
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
        />
        <Button type="submit" variant="outline">
          Find
        </Button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          Please enter your booking reference.
        </p>
      )}
    </form>
  )
}

import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { choose, readSelection, writeSelection, type BookingSelection } from '@/domain/booking/selection'

/**
 * The customer's choices, kept in the URL (see domain/booking/selection).
 * Choices replace the history entry rather than adding one, so Back leaves
 * the page instead of undoing one click at a time.
 */
export function useBookingSelection(): [BookingSelection, (change: Partial<BookingSelection>) => void] {
  const [params, setParams] = useSearchParams()
  const selection = useMemo(() => readSelection(params), [params])

  const update = useCallback(
    (change: Partial<BookingSelection>) => {
      setParams((current) => writeSelection(current, choose(readSelection(current), change)), { replace: true })
    },
    [setParams],
  )

  return [selection, update]
}

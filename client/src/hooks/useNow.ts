import { useEffect, useState } from 'react'

/**
 * The current time, updated every `intervalMs`. Booking screens need it to
 * show the live clocks and to retire slots that start while the page is open.
 */
export function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return now
}

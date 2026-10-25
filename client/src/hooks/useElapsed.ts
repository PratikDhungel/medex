import { useEffect, useState } from 'react'

/**
 * True once `active` has stayed true for `ms`; resets when it turns false.
 * Used to tell a slow load apart from a normal one.
 */
export function useElapsed(active: boolean, ms: number): boolean {
  const [elapsed, setElapsed] = useState(false)

  useEffect(() => {
    if (!active) return
    const timer = setTimeout(() => setElapsed(true), ms)
    return () => {
      clearTimeout(timer)
      setElapsed(false)
    }
  }, [active, ms])

  return active && elapsed
}

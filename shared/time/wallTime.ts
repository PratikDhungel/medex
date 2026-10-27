/**
 * A wall-clock time ("10:40") as minutes since midnight. Every time in the
 * booking data is one of these, read on the provider's clock: the same number
 * means a different moment in Bangkok and in Kathmandu.
 */
export type WallTime = number

export const MINUTES_PER_DAY = 24 * 60

const WALL_TIME_PATTERN = /^(\d{1,2}):(\d{2})$/

/**
 * Parses "HH:MM" or "H:MM". "24:00" is allowed and means the end of the day,
 * so a closing time can be midnight. Anything else ("25:00", "10:60",
 * "10.30", "", a number) is rejected rather than guessed at.
 */
export function parseWallTime(value: unknown): WallTime | null {
  if (typeof value !== 'string') return null

  const match = WALL_TIME_PATTERN.exec(value.trim())
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (minutes > 59) return null

  const total = hours * 60 + minutes
  return total <= MINUTES_PER_DAY ? total : null
}

/** "HH:MM" on a 24-hour clock, the format the API uses */
export function formatWallTime(time: WallTime): string {
  const hours = Math.floor(time / 60)
  const minutes = time % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

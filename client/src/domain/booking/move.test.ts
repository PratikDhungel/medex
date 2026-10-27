import { describe, expect, it } from 'vitest'
import { moveBetween, moveSummary } from './move'

const from = { date: '2026-10-30', start: 680 } // Friday 30 October, 11:20

describe('moveSummary', () => {
  it.each([
    [{ date: '2026-11-11', start: 840 }, '12 days later'],
    [{ date: '2026-10-28', start: 680 }, '2 days earlier'],
    [{ date: '2026-10-31', start: 600 }, 'The next day'],
    [{ date: '2026-10-29', start: 600 }, 'The day before'],
    [{ date: '2026-10-30', start: 760 }, 'Same day, 1 hour 20 minutes later'],
    [{ date: '2026-10-30', start: 640 }, 'Same day, 40 minutes earlier'],
    [{ date: '2026-10-30', start: 740 }, 'Same day, 1 hour later'],
    [{ date: '2026-10-30', start: 680 }, 'No change'],
  ])('to %j: %s', (to, summary) => {
    expect(moveSummary(moveBetween(from, to))).toBe(summary)
  })

  it('counts days across a month end', () => {
    expect(moveBetween({ date: '2026-10-31', start: 0 }, { date: '2026-11-01', start: 0 }).days).toBe(1)
  })
})

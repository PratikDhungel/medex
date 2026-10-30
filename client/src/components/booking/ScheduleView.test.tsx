import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { addDays } from '@shared/time/calendarDate'
import type { TimeZone } from '@shared/time/zone'
import { ApiError } from '@/api/client'
import { formatDate, formatTime } from '@/domain/booking/clock'
import type { Availability, DayAvailability } from '@/domain/booking/model'
import { ScheduleView, type ScheduleViewProps } from './ScheduleView'

// Tuesday 27 October 2026: 10:00 in Bangkok, 08:45 in Kathmandu
const NOW = Date.parse('2026-10-27T03:00:00Z')
const BANGKOK: TimeZone = { kind: 'iana', id: 'Asia/Bangkok' }
const KATHMANDU: TimeZone = { kind: 'iana', id: 'Asia/Kathmandu' }

const t = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
const rana = {
  id: 'rana',
  name: 'Dr. N. Rana',
  speciality: 'Internal Medicine',
  consultation: { start: t('18:00'), end: t('21:00'), durationMinutes: 20, bufferMinutes: 0 },
}
const wongsakul = { ...rana, id: 'wongsakul', name: 'Dr. A. Wongsakul' }

/** 90 days of Dr. Rana: Monday–Thursday available, Friday/Saturday off, Sunday closed, a holiday on 8 November */
function ranaAvailability(): Availability {
  const days: DayAvailability[] = Array.from({ length: 90 }, (_, i) => {
    const date = addDays('2026-10-27', i)
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
    if (date === '2026-11-08') return { date, status: 'closure', reason: 'Public holiday' }
    if (weekday === 0) return { date, status: 'closed' }
    if (weekday === 5) return { date, status: 'specialist-unavailable', opensAt: null, closesAt: t('17:00') }
    if (weekday === 6) return { date, status: 'specialist-unavailable', opensAt: null, closesAt: t('13:00') }
    return { date, status: 'available', startCount: 6 }
  })
  return { today: '2026-10-27', days }
}

const render = (overrides: Partial<ScheduleViewProps>) =>
  renderToStaticMarkup(
    <ScheduleView
      status={{ kind: 'ready', refreshFailed: false }}
      availability={ranaAvailability()}
      slow={false}
      retrying={false}
      onRetry={() => {}}
      providerName="Riverside International Hospital"
      zone={BANGKOK}
      customerZone={KATHMANDU}
      now={NOW}
      specialist={rana}
      otherSpecialists={[wongsakul]}
      selection={{ specialistId: 'rana', people: 1, date: null, time: null }}
      onChoose={() => {}}
      {...overrides}
    />,
  )

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .replace(/ ([,.:)])/g, '$1')

const labelOf = (html: string, date: string) => {
  const match = new RegExp(`data-date="${date}"[^>]*aria-label="([^"]*)"`).exec(html)
  return match?.[1].replace(/&#x27;/g, "'")
}

describe('ScheduleView: the calendar', () => {
  it('gives every unavailable day its reason, in the cell and in its accessible name', () => {
    const html = render({})
    expect(labelOf(html, '2026-10-30')).toBe(
      `${formatDate('2026-10-30', 'long')}, unavailable. Riverside International Hospital closes at ${formatTime(t('17:00'))} on Fridays, before Dr. N. Rana's hours start at ${formatTime(t('18:00'))}.`,
    )
    // November is shown once a November date is chosen
    const november = render({ selection: { specialistId: 'rana', people: 1, date: '2026-11-02', time: null } })
    expect(labelOf(november, '2026-11-01')).toBe(
      `${formatDate('2026-11-01', 'long')}, unavailable. Riverside International Hospital is closed on Sundays.`,
    )
    expect(labelOf(html, '2026-10-27')).toBe(`${formatDate('2026-10-27', 'long')}, today in Bangkok, 6 times available.`)
    expect(text(html)).toContain('30 Off')
    expect(text(html)).toContain('27 6 free')
  })

  it('puts exactly one day in the tab order: the first available day', () => {
    const html = render({})
    expect(html.match(/tabindex="0"/g)).toHaveLength(1)
    expect(html).toMatch(/data-date="2026-10-27" tabindex="0"/)
  })

  it('marks the selected day and puts it in the tab order', () => {
    const html = render({ selection: { specialistId: 'rana', people: 1, date: '2026-10-29', time: null } })
    expect(html).toMatch(/aria-selected="true"><button type="button" data-date="2026-10-29" tabindex="0"/)
  })

  it("greys out today once midnight has passed at the provider, without waiting for the server", () => {
    // 00:30 on the 28th in Bangkok; the server's answer still has the 27th as available
    const html = render({ now: Date.parse('2026-10-27T17:30:00Z') })
    expect(html).not.toContain('data-date="2026-10-27"')
    expect(html).toContain(`${formatDate('2026-10-27', 'long')}, unavailable. This day has already passed in Bangkok.`)
  })

  it("says when the provider's date is not the customer's", () => {
    const html = text(render({ now: Date.parse('2026-10-27T17:30:00Z') }))
    expect(html).toContain(`Dates follow the calendar in Bangkok. It's already ${formatDate('2026-10-28', 'long')} there.`)
  })
})

describe('ScheduleView: the chosen day', () => {
  it('offers the first available day before anything is chosen', () => {
    expect(text(render({}))).toContain(`First available: ${formatDate('2026-10-27')}`)
  })

  it('explains an unavailable day and offers the nearest days either side', () => {
    const html = text(render({ selection: { specialistId: 'rana', people: 1, date: '2026-11-08', time: null } }))
    expect(html).toContain('Riverside International Hospital is closed that day: Public holiday.')
    expect(html).toContain(`Next available: ${formatDate('2026-11-09')}`)
    expect(html).toContain(`Earlier: ${formatDate('2026-11-05')}`)
  })

  it('explains a date from the URL that has already passed', () => {
    const html = text(render({ selection: { specialistId: 'rana', people: 1, date: '2026-10-20', time: null } }))
    expect(html).toContain('This day has already passed in Bangkok.')
    expect(html).toContain(`Next available: ${formatDate('2026-10-27')}`)
  })

  it('hands an available day to the times', () => {
    const html = text(
      render({
        selection: { specialistId: 'rana', people: 1, date: '2026-10-29', time: null },
        renderTimes: (date) => <p>times for {date}</p>,
      }),
    )
    expect(html).toContain('times for 2026-10-29')
  })
})

describe('ScheduleView: no availability in the window', () => {
  const nothing: Availability = {
    today: '2026-10-27',
    days: ranaAvailability().days.map((day) => (day.status === 'available' ? { date: day.date, status: 'fully-booked' } : day)),
  }

  it('says so and offers another specialist', () => {
    const html = text(render({ availability: nothing }))
    expect(html).toContain('Dr. N. Rana has no free times in the next 90 days')
    expect(html).toContain("See Dr. A. Wongsakul's times")
  })

  it('offers fewer people when the group is the problem', () => {
    const html = text(render({ availability: nothing, selection: { specialistId: 'rana', people: 3, date: null, time: null } }))
    expect(html).toContain('Dr. N. Rana has no 3 times in a row free in the next 90 days')
    expect(html).toContain('Look for 1 person instead')
  })
})

describe('ScheduleView: states', () => {
  it('shows a calendar skeleton while loading', () => {
    const html = render({ status: { kind: 'loading' }, availability: undefined })
    expect(html).toContain('data-slot="skeleton"')
    expect(text(html)).toContain('Loading dates…')
  })

  it('offers a retry that keeps the choices', () => {
    const error = new ApiError('network', '/booking/providers/48/availability', 'down')
    const html = text(render({ status: { kind: 'error', error }, availability: undefined }))
    expect(html).toContain("We couldn't reach the server")
    expect(html).toContain('Your choices are kept.')
    expect(html).toContain('Try again')
  })

  it('keeps showing the calendar when a refresh fails', () => {
    const html = text(render({ status: { kind: 'ready', refreshFailed: true } }))
    expect(html).toContain("We couldn't refresh the dates, so they may be out of date.")
    expect(html).toContain('6 free')
  })
})

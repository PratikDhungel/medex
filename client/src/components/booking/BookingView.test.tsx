/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { TimeZone } from '@shared/time/zone'
import { ApiError } from '@/api/client'
import { formatDate, formatTime } from '@/domain/booking/clock'
import type { BookingProvider } from '@/domain/booking/model'
import { normaliseProvider } from '@/domain/booking/normalise'
import { BookingView, type BookingViewProps } from './BookingView'

const { providers } = JSON.parse(
  readFileSync(new URL('../../../../server/data/task3-booking.json', import.meta.url), 'utf8'),
) as { providers: unknown[] }

// 10:00 in Bangkok, 08:45 in Kathmandu
const NOW = Date.parse('2026-10-27T03:00:00Z')
const KATHMANDU: TimeZone = { kind: 'iana', id: 'Asia/Kathmandu' }

const provider = (id: number) => normaliseProvider(providers.find((p) => (p as { id: number }).id === id), NOW)!
const riverside = provider(48)
const himalNeo = provider(46)

const render = (overrides: Partial<BookingViewProps>) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <BookingView
        status={{ kind: 'ready', refreshFailed: false }}
        provider={riverside}
        customerZone={KATHMANDU}
        now={NOW}
        slow={false}
        retrying={false}
        onRetry={() => {}}
        selection={{ specialistId: null, people: 1, date: null, time: null }}
        specialist={null}
        staleSpecialist={false}
        onChoose={() => {}}
        {...overrides}
      />
    </MemoryRouter>,
  )

/** Visible text only, with tags dropped and spacing collapsed */
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .replace(/ ([,.)])/g, '$1')

// Times follow the test machine's locale, as they follow the customer's in the app
const at = (time: string) => formatTime(Number(time.slice(0, 2)) * 60 + Number(time.slice(3)))

describe('BookingView: the two clocks', () => {
  it("says which clock the times use and shows both, for a customer in Kathmandu booking in Bangkok", () => {
    const html = text(render({}))
    expect(html).toContain('Times are shown in Bangkok time')
    expect(html).toContain("That's where your appointment is. Your own time (Kathmandu) is shown under each time, in grey.")
    expect(html).toContain('Bangkok is 1 hour 15 minutes ahead of you.')
    expect(html).toContain(`Now in Bangkok ${at('10:00')}`)
    expect(html).toContain(`Your time (Kathmandu) ${at('08:45')}`)
  })

  it('shows one clock when the provider keeps the same time as the customer', () => {
    const html = text(render({ provider: himalNeo, specialist: himalNeo.specialists[0] }))
    expect(html).toContain('All times are in Kathmandu time, the same as your own clock.')
    expect(html).not.toContain('Your time')
  })

  it("shows each clock's date when the two are on different days", () => {
    // 00:30 on the 28th in Bangkok, still 23:15 on the 27th in Kathmandu
    const html = text(render({ now: Date.parse('2026-10-27T17:30:00Z') }))
    expect(html).toContain(`Now in Bangkok ${at('00:30')} · ${formatDate('2026-10-28')}`)
    expect(html).toContain(`Your time (Kathmandu) ${at('23:15')} · ${formatDate('2026-10-27')}`)
  })
})

describe('BookingView: choosing', () => {
  it('lists the specialists with their hours and asks for a choice', () => {
    const html = text(render({}))
    expect(html).toContain('Choose a specialist')
    expect(html).toContain(`Dr. N. Rana Internal Medicine ${at('18:00')} – ${at('21:00')} · 20-minute appointments`)
    expect(html).toContain('Choose a specialist to see the dates and times they can see you.')
  })

  it('names the only specialist instead of offering a choice', () => {
    const html = text(render({ provider: himalNeo, specialist: himalNeo.specialists[0] }))
    expect(html).not.toContain('Choose a specialist')
    expect(html).toContain('Your specialist Dr. S. Shrestha, General Practice')
  })

  it('explains a specialist from an old link', () => {
    expect(text(render({ staleSpecialist: true }))).toContain("The specialist in your link isn't taking online bookings any more.")
  })

  it('shows the calendar area once a specialist is chosen', () => {
    const html = text(render({ specialist: riverside.specialists[0], children: <p>calendar here</p> }))
    expect(html).toContain('calendar here')
    expect(html).not.toContain('Choose a specialist to see')
  })
})

describe('BookingView: states', () => {
  it('shows skeletons while loading, and says when it is slow', () => {
    const html = render({ status: { kind: 'loading' }, provider: undefined })
    expect(html).toContain('data-slot="skeleton"')
    expect(text(html)).toContain('Loading the provider…')
    expect(text(render({ status: { kind: 'loading' }, provider: undefined, slow: true }))).toContain(
      'This is taking longer than usual.',
    )
  })

  it('offers a retry on failure and promises the choices are kept', () => {
    const error = new ApiError('http', '/booking/providers/48', 'boom', 500)
    const html = text(render({ status: { kind: 'error', error }, provider: undefined }))
    expect(html).toContain('Something went wrong on our side')
    expect(html).toContain("Anything you've chosen so far is kept.")
    expect(html).toContain('Try again')
  })

  it('says when the provider does not exist', () => {
    const error = new ApiError('http', '/booking/providers/7', 'not found', 404)
    const html = text(render({ status: { kind: 'error', error }, provider: undefined }))
    expect(html).toContain("We couldn't find this provider")
    expect(html).not.toContain('Try again')
  })

  it('waits for a connection when offline', () => {
    expect(text(render({ status: { kind: 'offline' }, provider: undefined }))).toContain("You're offline")
  })

  it("refuses to show times when the provider's zone is unknown", () => {
    const unknownZone: BookingProvider = { ...riverside, zone: null, zoneSource: null }
    const html = text(render({ provider: unknownZone }))
    expect(html).toContain("Online booking isn't available here")
    expect(html).not.toContain('Choose a specialist')
  })

  it('says when no specialist can be booked online', () => {
    const noHours: BookingProvider = {
      ...riverside,
      specialists: riverside.specialists.map((s) => ({ ...s, consultation: null })),
    }
    expect(text(render({ provider: noHours }))).toContain('No specialists take online bookings here yet')
  })
})

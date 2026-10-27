import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { TimeZone } from '@shared/time/zone'
import { ApiError } from '@/api/client'
import { formatDate, formatTime } from '@/domain/booking/clock'
import type { BookingProvider, Slot } from '@/domain/booking/model'
import { slotViews } from '@/domain/booking/slotView'
import { DayTimesView, type DayTimesViewProps } from './DayTimes'

const t = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
const at = (time: string) => formatTime(t(time))

const BANGKOK: TimeZone = { kind: 'iana', id: 'Asia/Bangkok' }
const KATHMANDU: TimeZone = { kind: 'iana', id: 'Asia/Kathmandu' }
const KOLKATA: TimeZone = { kind: 'iana', id: 'Asia/Kolkata' }
// Tuesday 27 October 2026, 10:00 in Bangkok
const NOW = Date.parse('2026-10-27T03:00:00Z')

const rana = {
  id: 'rana',
  name: 'Dr. N. Rana',
  speciality: null,
  consultation: { start: t('18:00'), end: t('21:00'), durationMinutes: 20, bufferMinutes: 0 },
}
const riverside: BookingProvider & { zone: TimeZone } = {
  id: 48,
  name: 'Riverside International Hospital',
  country: 'TH',
  zone: BANGKOK,
  zoneSource: 'iana',
  schedule: { monday: { open: t('08:00'), close: t('20:00') } },
  specialists: [rana],
}

/** Dr. Rana on Monday 2 November: 18:00–19:40, the hospital closes at 20:00 */
const ranaSlots = (booked: string[] = []): Slot[] =>
  ['18:00', '18:20', '18:40', '19:00', '19:20', '19:40'].map((start) => ({ start: t(start), end: t(start) + 20, booked: booked.includes(start) }))

function render(overrides: Partial<DayTimesViewProps> & { slots?: Slot[] } = {}) {
  const { slots = ranaSlots(), ...rest } = overrides
  const props = {
    provider: riverside,
    specialist: rana,
    date: '2026-11-02',
    people: 1,
    selected: null,
    onSelect: () => {},
    customerZone: KATHMANDU,
    now: NOW,
    nextAvailable: '2026-11-03',
    onChooseDate: () => {},
    status: { kind: 'ready', refreshFailed: false },
    slow: false,
    retrying: false,
    onRetry: () => {},
    ...rest,
  } satisfies Omit<DayTimesViewProps, 'views'>
  const views =
    rest.views ??
    slotViews(slots, {
      date: props.date,
      zone: props.provider.zone,
      customerZone: props.customerZone,
      consultation: rana.consultation,
      people: props.people,
      nowMs: props.now,
    })
  return renderToStaticMarkup(<DayTimesView {...props} views={views} />)
}

/** The radio for a start time, whatever order React writes its attributes in */
const radio = (html: string, time: string) => new RegExp(`<input[^>]*value="${t(time)}"[^>]*>`).exec(html)?.[0] ?? ''

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .replace(/ ([,.:)])/g, '$1')

describe('DayTimesView: the times', () => {
  it('groups the times and shows both clocks on each', () => {
    const html = text(render())
    expect(html).toContain('6 times available.')
    expect(html).toContain('Evening · 6 of 6 free')
    // Riverside 18:40 is 17:25 in Kathmandu
    expect(html).toContain(`${at('18:40')} Bangkok time, ${at('17:25')} your time`)
  })

  it("explains the specialist's hours that the opening hours cut", () => {
    expect(text(render())).toContain(
      `Dr. N. Rana's hours run to ${at('21:00')}, but Riverside International Hospital closes at ${at('20:00')} on Mondays, so the last time is ${at('19:40')}.`,
    )
  })

  it("shows booked times, but they can't be chosen", () => {
    const html = render({ slots: ranaSlots(['18:20']) })
    expect(text(html)).toContain(`${at('18:20')} Bangkok time, Booked`)
    expect(radio(html, '18:20')).toContain('disabled=""')
    expect(html.match(/disabled=""/g)).toHaveLength(1)
  })

  it('shows one clock when the customer keeps the same time', () => {
    expect(text(render({ customerZone: BANGKOK }))).not.toContain('your time')
  })

  it("adds the customer's date when it isn't the provider's", () => {
    const mehra = { ...rana, consultation: { start: t('21:00'), end: t('23:30'), durationMinutes: 25, bufferMinutes: 5 } }
    const html = text(
      render({
        provider: { ...riverside, zone: KOLKATA, schedule: { monday: { open: t('08:00'), close: t('23:30') } } },
        specialist: mehra,
        customerZone: BANGKOK,
        views: slotViews([{ start: t('23:00'), end: t('23:25'), booked: false }], {
          date: '2026-11-02',
          zone: KOLKATA,
          customerZone: BANGKOK,
          consultation: mehra.consultation,
          people: 1,
          nowMs: NOW,
        }),
      }),
    )
    expect(html).toContain(`${at('23:00')} Kolkata time, ${at('00:30')}, ${formatDate('2026-11-03')} your time`)
  })

  it('says how many times can start a group, and marks the rest', () => {
    const html = text(render({ people: 3, slots: ranaSlots(['19:00']) }))
    // 19:00 is booked, so only 18:00 has 3 free in a row after it
    expect(html).toContain('1 start time for 3 people.')
    expect(html).toContain('Evening · 1 start time')
    expect(html).toContain(`${at('18:20')} Bangkok time, No room for 3`)
  })
})

describe('DayTimesView: the chosen time', () => {
  it('marks the chosen time', () => {
    expect(radio(render({ selected: t('18:40') }), '18:40')).toContain('checked=""')
  })

  it('says when the chosen time has just been booked by someone else', () => {
    const html = text(render({ selected: t('18:40'), slots: ranaSlots(['18:40']) }))
    expect(html).toContain(`Someone has just booked ${at('18:40')}. Please choose another time.`)
  })

  it('says when a time from the URL is not offered', () => {
    expect(text(render({ selected: t('20:00') }))).toContain(`${at('20:00')} isn't offered on this day.`)
  })
})

describe('DayTimesView: nothing left', () => {
  it("says today's times have started, by the provider clock, and offers the next day", () => {
    // 20:30 in Bangkok on the 2nd: every slot has started
    const html = text(render({ now: Date.parse('2026-11-02T13:30:00Z') }))
    expect(html).toContain(`There are no times left today. It's ${at('20:30')} in Bangkok.`)
    expect(html).toContain(`Next available: ${formatDate('2026-11-03')}`)
  })

  it('says when every time has just been booked', () => {
    const html = text(render({ slots: ranaSlots(['18:00', '18:20', '18:40', '19:00', '19:20', '19:40']) }))
    expect(html).toContain('Every time on this day has just been booked.')
  })
})

describe('DayTimesView: states', () => {
  it('shows skeletons while loading', () => {
    const html = render({ status: { kind: 'loading' }, views: [] })
    expect(html).toContain('data-slot="skeleton"')
    expect(text(html)).toContain('Loading times…')
  })

  it('offers a retry that keeps the choices', () => {
    const error = new ApiError('http', '/booking/providers/48/slots', 'boom', 500)
    const html = text(render({ status: { kind: 'error', error }, views: [] }))
    expect(html).toContain('Your choices are kept.')
    expect(html).toContain('Try again')
  })
})

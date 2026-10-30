import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FlaskConical, Trash2, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { getMockConfig, MOCK_ENDPOINTS, resetMockData, setMockConfig, type MockConfig, type MockEndpoint, type MockRule } from '@/api/mock'
import { Button } from '@/components/ui/button'
import { serviceTypeLabel } from '@/domain/serviceTypes'
import { useAccountStore } from '@/hooks/useAccount'
import { useCheckoutStore } from '@/hooks/useCheckout'
import {
  customerZoneOverride,
  setCustomerZoneOverride,
  subscribeCustomerZoneOverride,
  ZONE_CHOICES,
} from '@/lib/customerZoneOverride'
import {
  describeRule,
  ENDPOINT_LABELS,
  FULLY_BOOKED_DEMO,
  GROUP_TYPES,
  RACEABLE_ENDPOINTS,
  SCENARIOS,
  STATUS_LABELS,
  withRule,
  type Scenario,
} from './rules'

const configKey = ['mock-config'] as const

const fieldClass = 'h-8 w-full rounded-md border bg-background px-2 text-sm'

interface RuleDraft {
  endpoint: MockEndpoint
  status: string
  when: 'before' | 'after' | 'raced'
  groupType: string
  times: 'once' | 'always'
  delaySeconds: string
}

const EMPTY_DRAFT: RuleDraft = { endpoint: 'checkout', status: '500', when: 'before', groupType: '', times: 'once', delaySeconds: '' }

const raced = (draft: RuleDraft) => draft.when === 'raced' && RACEABLE_ENDPOINTS.includes(draft.endpoint)

function ruleFrom(draft: RuleDraft): MockRule {
  const delay = Number(draft.delaySeconds)
  return {
    endpoint: draft.endpoint,
    ...(raced(draft) ? { when: 'raced' as const } : draft.status ? { status: Number(draft.status), when: draft.when === 'raced' ? 'before' : draft.when } : {}),
    ...(draft.groupType && draft.endpoint === 'checkout' ? { match: { groupType: draft.groupType } } : {}),
    ...(draft.times === 'once' ? { times: 1 } : {}),
    ...(delay > 0 ? { delayMs: Math.round(delay * 1000) } : {}),
  }
}

/**
 * Controls for the mock server, so anyone reviewing the app can make a
 * specific call fail or slow down on demand. Not a modal: the page stays
 * usable while it's open. Escape closes it and returns focus to its button.
 */
export function DevPanel() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [draft, setDraft] = useState<RuleDraft>(EMPTY_DRAFT)
  const zoneOverride = useSyncExternalStore(subscribeCustomerZoneOverride, customerZoneOverride, () => null)
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const toggle = useRef<HTMLButtonElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const panelId = useId()
  const queryClient = useQueryClient()
  const accountStore = useAccountStore()
  const checkout = useCheckoutStore()
  const navigate = useNavigate()

  // Rules used up by the server ("next time only") drop off the list as it refreshes
  const config = useQuery({ queryKey: configKey, queryFn: getMockConfig, enabled: open, refetchInterval: open ? 2000 : false })

  useEffect(() => {
    if (open) heading.current?.focus()
  }, [open])

  const close = () => {
    setOpen(false)
    toggle.current?.focus()
  }

  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true)
    try {
      await action()
      setMessage(done)
    } catch {
      setMessage("Couldn't reach the mock server. Is it running?")
    } finally {
      setBusy(false)
    }
  }

  const save = (next: MockConfig, done: string) =>
    run(async () => {
      queryClient.setQueryData(configKey, await setMockConfig(next))
    }, done)

  const current = config.data

  const addRule = (event: FormEvent) => {
    event.preventDefault()
    if (current) void save(withRule(current, ruleFrom(draft)), 'Rule added.')
  }

  const resetDemo = () =>
    run(async () => {
      await resetMockData()
      checkout.clear()
      await accountStore.resetToFirstVisit()
      await queryClient.invalidateQueries()
      navigate('/cart')
    }, 'Demo reset: the original cart, no orders, and a guest with their saved items.')

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col items-start gap-2">
      {open && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={`${panelId}-heading`}
          onKeyDown={(event) => event.key === 'Escape' && close()}
          className="max-h-[75svh] w-[min(26rem,calc(100vw-2rem))] space-y-4 overflow-y-auto rounded-xl border bg-background p-4 text-sm shadow-lg"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2
                id={`${panelId}-heading`}
                ref={heading}
                tabIndex={-1}
                className="font-accent text-base font-semibold outline-none"
              >
                Mock API
              </h2>
              <p className="text-xs text-muted-foreground">Make specific calls fail or slow down. Changes apply at once.</p>
            </div>
            <Button variant="ghost" size="icon-xs" aria-label="Close mock API panel" onClick={close}>
              <X aria-hidden />
            </Button>
          </div>

          <p role="status" aria-live="polite" className="min-h-5 text-xs text-muted-foreground">
            {busy ? 'Saving…' : message}
          </p>

          {config.isError && <p className="text-destructive">Couldn't load the mock server's settings. Is it running?</p>}

          <section className="space-y-2">
            <h3 className="font-medium">Scenarios</h3>
            {(
              [
                ['booking', 'Booking'],
                ['cart', 'Cart and checkout'],
              ] as [Scenario['group'], string][]
            ).map(([group, title]) => (
              <div key={group} className="space-y-1">
                <h4 className="text-xs text-muted-foreground">{title}</h4>
                <ul className="space-y-1">
                  {SCENARIOS.filter((scenario) => scenario.group === group).map((scenario) => (
                    <li key={scenario.id}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-auto w-full justify-start rounded-lg py-1.5 text-left whitespace-normal"
                        disabled={!current || busy}
                        onClick={() => current && void save(scenario.apply(current), `Set: ${scenario.label}`)}
                      >
                        {scenario.label}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <section className="space-y-2">
            <h3 className="font-medium">Your time zone</h3>
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">
                Show "your time" as if this device were in another zone. Saved in this browser.
              </span>
              <select
                className={fieldClass}
                value={zoneOverride ?? ''}
                onChange={(e) => {
                  setCustomerZoneOverride(e.target.value || null)
                  setMessage(e.target.value ? `Your time now shows as ${e.target.value}.` : "Your time now follows this device's zone.")
                }}
              >
                <option value="">This device ({deviceZone})</option>
                {ZONE_CHOICES.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="space-y-2">
            <h3 className="font-medium">Active rules</h3>
            {current && current.rules.length > 0 ? (
              <ul className="space-y-1">
                {current.rules.map((rule, index) => (
                  <li key={`${index}-${describeRule(rule)}`} className="flex items-start justify-between gap-2 rounded-md bg-muted/50 px-2 py-1">
                    <span>{describeRule(rule)}</span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Remove rule: ${describeRule(rule)}`}
                      onClick={() =>
                        void save({ ...current, rules: current.rules.filter((_, i) => i !== index) }, 'Rule removed.')
                      }
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">None: every call behaves normally.</p>
            )}
            {current && current.fullyBookedSpecialists.length > 0 && (
              <ul className="space-y-1">
                {current.fullyBookedSpecialists.map((id) => {
                  const label = `${id === FULLY_BOOKED_DEMO.id ? FULLY_BOOKED_DEMO.label : id}: fully booked for 90 days`
                  return (
                    <li key={id} className="flex items-start justify-between gap-2 rounded-md bg-muted/50 px-2 py-1">
                      <span>{label}</span>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove: ${label}`}
                        onClick={() =>
                          void save(
                            { ...current, fullyBookedSpecialists: current.fullyBookedSpecialists.filter((other) => other !== id) },
                            'Specialist available again.',
                          )
                        }
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
            {current && (
              <p className="text-muted-foreground">
                Card payments {current.settlement.outcome === 'paid' ? 'succeed' : 'fail'} {current.settlement.afterMs / 1000} s after
                the order is placed.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!current || busy}
                onClick={() =>
                  current &&
                  void save({ rules: [], settlement: { outcome: 'paid', afterMs: 4000 }, fullyBookedSpecialists: [] }, 'All rules cleared.')
                }
              >
                Clear all
              </Button>
            </div>
          </section>

          <form onSubmit={addRule} className="space-y-2">
            <h3 className="font-medium">Custom rule</h3>
            <div className="grid grid-cols-2 gap-2">
              <label className="col-span-2 space-y-1">
                <span className="text-xs text-muted-foreground">Call</span>
                <select
                  className={fieldClass}
                  value={draft.endpoint}
                  onChange={(e) => setDraft({ ...draft, endpoint: e.target.value as MockEndpoint })}
                >
                  {MOCK_ENDPOINTS.map((endpoint) => (
                    <option key={endpoint} value={endpoint}>
                      {ENDPOINT_LABELS[endpoint]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Respond with</span>
                <select className={fieldClass} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                  <option value="">Normal response</option>
                  {Object.entries(STATUS_LABELS).map(([status, label]) => (
                    <option key={status} value={status}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">When</span>
                <select
                  className={fieldClass}
                  value={draft.when}
                  disabled={!draft.status && !RACEABLE_ENDPOINTS.includes(draft.endpoint)}
                  onChange={(e) => setDraft({ ...draft, when: e.target.value as RuleDraft['when'] })}
                >
                  <option value="before">Before the work</option>
                  <option value="after">After the work</option>
                  {RACEABLE_ENDPOINTS.includes(draft.endpoint) && <option value="raced">Someone else takes the slot first</option>}
                </select>
              </label>
              {draft.endpoint === 'checkout' && (
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Group</span>
                  <select className={fieldClass} value={draft.groupType} onChange={(e) => setDraft({ ...draft, groupType: e.target.value })}>
                    <option value="">Any</option>
                    {GROUP_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {serviceTypeLabel(type)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">How often</span>
                <select
                  className={fieldClass}
                  value={draft.times}
                  onChange={(e) => setDraft({ ...draft, times: e.target.value as RuleDraft['times'] })}
                >
                  <option value="once">Next time only</option>
                  <option value="always">Every time</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Extra delay (seconds)</span>
                <input
                  className={fieldClass}
                  type="number"
                  min="0"
                  max="30"
                  step="0.5"
                  value={draft.delaySeconds}
                  onChange={(e) => setDraft({ ...draft, delaySeconds: e.target.value })}
                />
              </label>
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={!current || busy || (!draft.status && !raced(draft) && !(Number(draft.delaySeconds) > 0))}
            >
              Add rule
            </Button>
          </form>

          <section className="space-y-2 border-t pt-3">
            <h3 className="font-medium">Start over</h3>
            <p className="text-muted-foreground">
              Restores the original cart and bookings, forgets all orders and the checkout, and makes you a first-time guest
              with saved items again.
            </p>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void resetDemo()}>
              Reset demo
            </Button>
            <p className="text-xs text-muted-foreground">To try offline, use your browser's network tools.</p>
          </section>
        </div>
      )}

      <Button
        ref={toggle}
        variant="outline"
        size="sm"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close() : setOpen(true))}
        className="shadow-md"
      >
        <FlaskConical aria-hidden />
        {/* Just the icon on phones, where the button would cover the page */}
        <span className="sr-only sm:not-sr-only">Mock API</span>
      </Button>
    </div>
  )
}

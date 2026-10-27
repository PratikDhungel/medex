import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { Settlement } from './cart/orders.js'

/**
 * Failure injection for the cart and booking APIs, set at runtime by the client's dev panel
 * (GET/PUT /api/__mock/config). Unlike the query flags in mock.ts, a rule can
 * target one call among several identical ones, e.g. only the package group's
 * POST /checkout, and only the next time.
 */

export const ENDPOINTS = [
  'getCart',
  'updateLine',
  'removeLine',
  'mergeCart',
  'checkout',
  'getOrder',
  'bookingProviders',
  'bookingProvider',
  'availability',
  'slots',
  'createBooking',
  'getBooking',
  'updateBooking',
] as const
export type Endpoint = (typeof ENDPOINTS)[number]

/** Endpoints where someone else can take the slot first (`when: 'raced'`) */
const RACEABLE: readonly Endpoint[] = ['createBooking', 'updateBooking']

export interface MockRule {
  endpoint: Endpoint
  /** Extra wait before handling, in ms */
  delayMs?: number
  /** Status to answer with; 0 drops the connection. Leave out for a delay-only rule. */
  status?: number
  /**
   * `before`: fail without doing the work. `after`: do the work, then fail
   * anyway, like a response lost on the way back. That's the case
   * idempotency keys exist for. `raced`: someone else books the same slot
   * just before this request, which then meets a real conflict (booking
   * endpoints only; `status` is ignored).
   */
  when?: 'before' | 'after' | 'raced'
  /** Only requests whose route params or body fields equal these, e.g. `{ "groupType": "package" }` */
  match?: Record<string, string>
  /** How many matching requests to affect; leave out for every one */
  times?: number
}

export interface MockConfig {
  rules: MockRule[]
  settlement: Settlement
}

const DEFAULT_SETTLEMENT: Settlement = { outcome: 'paid', afterMs: 4000 }
const MAX_DELAY_MS = 30_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Validates a config sent by the dev panel. Returns an error message or the config. */
export function parseMockConfig(body: unknown): MockConfig | string {
  if (!isObject(body) || !Array.isArray(body.rules)) return '"rules" must be an array'

  const rules: MockRule[] = []
  for (const [index, rule] of body.rules.entries()) {
    if (!isObject(rule) || !ENDPOINTS.includes(rule.endpoint as Endpoint)) {
      return `rules[${index}].endpoint must be one of ${ENDPOINTS.join(', ')}`
    }
    const { endpoint, delayMs, status, when, match, times } = rule
    if (delayMs !== undefined && !(Number.isInteger(delayMs) && (delayMs as number) >= 0)) {
      return `rules[${index}].delayMs must be a whole number of ms`
    }
    if (status !== undefined && !(status === 0 || (Number.isInteger(status) && (status as number) >= 400 && (status as number) < 600))) {
      return `rules[${index}].status must be 0 or an error status (400-599)`
    }
    if (when !== undefined && when !== 'before' && when !== 'after' && when !== 'raced') {
      return `rules[${index}].when must be before, after or raced`
    }
    if (when === 'raced' && !RACEABLE.includes(endpoint as Endpoint)) {
      return `rules[${index}].when can only be raced for ${RACEABLE.join(', ')}`
    }
    if (match !== undefined && !(isObject(match) && Object.values(match).every((v) => typeof v === 'string'))) {
      return `rules[${index}].match must map field names to strings`
    }
    if (times !== undefined && !(Number.isInteger(times) && (times as number) > 0)) {
      return `rules[${index}].times must be a positive whole number`
    }
    rules.push({ endpoint, delayMs, status, when, match, times } as MockRule)
  }

  const settlement = body.settlement ?? DEFAULT_SETTLEMENT
  if (
    !isObject(settlement) ||
    (settlement.outcome !== 'paid' && settlement.outcome !== 'failed') ||
    !(Number.isInteger(settlement.afterMs) && (settlement.afterMs as number) >= 0)
  ) {
    return '"settlement" must be { outcome: "paid" | "failed", afterMs: number }'
  }

  return { rules, settlement: settlement as unknown as Settlement }
}

const FAILURE_BODIES: Record<number, { code: string; message: string }> = {
  402: { code: 'payment_declined', message: 'The card issuer declined this payment.' },
  409: { code: 'conflict', message: 'The server could not accept this change right now.' },
  500: { code: 'server_error', message: 'Something went wrong on our side.' },
}

/** Answers with an injected failure. Status 0 drops the connection, so the client gets no response at all. */
export function sendInjectedFailure(req: Request, res: Response, status: number) {
  if (status === 0) {
    req.socket.destroy()
    return
  }
  res.status(status).json(FAILURE_BODIES[status] ?? { code: 'simulated_error', message: `Simulated ${status} response` })
}

/**
 * Sends a success response, unless a mock rule asked for this request to fail
 * after its work was done (see MockRules).
 */
export function send(req: Request, res: Response, status: number, body?: unknown) {
  const failAfter = res.locals.failAfter as number | undefined
  if (failAfter !== undefined) return sendInjectedFailure(req, res, failAfter)
  if (body === undefined) res.status(status).end()
  else res.status(status).json(body)
}

export class MockRules {
  private config: MockConfig = { rules: [], settlement: DEFAULT_SETTLEMENT }

  get current(): MockConfig {
    return structuredClone(this.config)
  }

  set(config: MockConfig) {
    this.config = structuredClone(config)
  }

  get settlement(): Settlement {
    return { ...this.config.settlement }
  }

  /** The first rule that applies to this request, using up one of its `times` */
  private take(endpoint: Endpoint, fields: Record<string, unknown>): MockRule | undefined {
    const rule = this.config.rules.find(
      (r) => r.endpoint === endpoint && Object.entries(r.match ?? {}).every(([key, value]) => String(fields[key]) === value),
    )
    if (rule?.times !== undefined) {
      rule.times -= 1
      if (rule.times === 0) this.config.rules = this.config.rules.filter((r) => r !== rule)
    }
    return rule
  }

  /**
   * Applies the matching rule to a request. An `after` failure is left in
   * `res.locals.failAfter` for the route to send once it has done its work,
   * and a `raced` rule sets `res.locals.raced` for the route to act on.
   */
  middleware(endpoint: Endpoint): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
      const rule = this.take(endpoint, { ...(isObject(req.body) ? req.body : {}), ...req.params })
      if (!rule) return next()

      if (rule.delayMs) await sleep(Math.min(rule.delayMs, MAX_DELAY_MS))
      if (rule.when === 'raced') {
        res.locals.raced = true
        return next()
      }
      if (rule.status === undefined) return next()

      if (rule.when === 'after') {
        res.locals.failAfter = rule.status
        return next()
      }
      sendInjectedFailure(req, res, rule.status)
    }
  }
}

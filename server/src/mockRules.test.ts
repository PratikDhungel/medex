import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import { MockRules, parseMockConfig, type MockConfig } from './mockRules.js'

const settlement = { outcome: 'paid', afterMs: 0 } as const

/** Runs a rule middleware and reports what happened to the request */
async function run(rules: MockRules, endpoint: 'checkout', body: object) {
  const res = { locals: {} as Record<string, unknown>, status: vi.fn(), json: vi.fn() }
  res.status.mockReturnValue(res)
  const next = vi.fn()
  await rules.middleware(endpoint)({ body, params: {} } as unknown as Request, res as unknown as Response, next)
  return { passed: next.mock.calls.length === 1, status: res.status.mock.calls[0]?.[0], failAfter: res.locals.failAfter }
}

describe('parseMockConfig', () => {
  it('accepts a valid config and fills in the default settlement', () => {
    const config = parseMockConfig({ rules: [{ endpoint: 'checkout', status: 402, times: 1 }] })
    expect(config).toMatchObject({ rules: [{ endpoint: 'checkout', status: 402, times: 1 }], settlement: { outcome: 'paid' } })
  })

  it.each([
    [{ rules: 'nope' }],
    [{ rules: [{ endpoint: 'pay' }] }],
    [{ rules: [{ endpoint: 'checkout', status: 200 }] }],
    [{ rules: [{ endpoint: 'checkout', times: 0 }] }],
    [{ rules: [], settlement: { outcome: 'maybe', afterMs: 0 } }],
  ])('rejects %j', (body) => {
    expect(typeof parseMockConfig(body)).toBe('string')
  })
})

describe('MockRules', () => {
  it('fails only the matching group, only as many times as asked', async () => {
    const rules = new MockRules()
    rules.set({ rules: [{ endpoint: 'checkout', status: 402, match: { groupType: 'package' }, times: 1 }], settlement } as MockConfig)

    expect(await run(rules, 'checkout', { groupType: 'lab_test' })).toMatchObject({ passed: true })
    expect(await run(rules, 'checkout', { groupType: 'package' })).toMatchObject({ passed: false, status: 402 })
    expect(await run(rules, 'checkout', { groupType: 'package' })).toMatchObject({ passed: true })
    expect(rules.current.rules).toEqual([])
  })

  it('lets the work happen and fails afterwards for "after" rules', async () => {
    const rules = new MockRules()
    rules.set({ rules: [{ endpoint: 'checkout', status: 500, when: 'after' }], settlement } as MockConfig)
    expect(await run(rules, 'checkout', {})).toEqual({ passed: true, status: undefined, failAfter: 500 })
  })
})

describe('raced rules', () => {
  it('are only allowed where a slot can be taken', () => {
    expect(parseMockConfig({ rules: [{ endpoint: 'createBooking', when: 'raced', times: 1 }] })).toMatchObject({
      rules: [{ endpoint: 'createBooking', when: 'raced' }],
    })
    expect(typeof parseMockConfig({ rules: [{ endpoint: 'checkout', when: 'raced' }] })).toBe('string')
  })

  it('let the request through with res.locals.raced set, for the route to act on', async () => {
    const rules = new MockRules()
    rules.set({ rules: [{ endpoint: 'createBooking', when: 'raced', times: 1 }], settlement } as MockConfig)
    const res = { locals: {} as Record<string, unknown> }
    const next = vi.fn()
    await rules.middleware('createBooking')({ body: {}, params: {} } as unknown as Request, res as unknown as Response, next)
    expect(next).toHaveBeenCalledOnce()
    expect(res.locals.raced).toBe(true)
  })
})

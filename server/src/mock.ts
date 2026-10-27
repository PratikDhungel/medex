import type { NextFunction, Request, RequestHandler, Response } from 'express'

// Base latency so loading states are visible without asking for them
const DEFAULT_LATENCY_MS = Number(process.env.MOCK_LATENCY_MS ?? 300)
const MAX_DELAY_MS = 30_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function queryString(req: Request, key: string): string | undefined {
  const value = req.query[key]
  return typeof value === 'string' ? value : undefined
}

/**
 * Simulates a real network on demand, per request:
 *   ?mockDelay=<ms>                     replace the default latency (0 disables it)
 *   ?mockFail=<all|categories|providers|services|cart|checkout|orders>[,...]
 *                                       respond 500 for the listed resources
 *   ?mockFailRate=<0..1>                fail randomly with that probability
 *
 * `resource` names the endpoint so a single resource can fail (partial data).
 */
export function mockNetwork(resource: string): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const delay = Number(queryString(req, 'mockDelay') ?? DEFAULT_LATENCY_MS)
    if (Number.isFinite(delay) && delay > 0) {
      await sleep(Math.min(delay, MAX_DELAY_MS))
    }

    const failList = (queryString(req, 'mockFail') ?? '').split(',').map((s) => s.trim())
    const failRate = Number(queryString(req, 'mockFailRate') ?? 0)

    if (failList.includes('all') || failList.includes(resource) || Math.random() < failRate) {
      res.status(500).json({ error: `Simulated failure for ${resource}` })
      return
    }

    next()
  }
}

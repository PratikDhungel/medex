import { describe, expect, it } from 'vitest'
import { ApiError } from './client'
import { failureMessage } from './failureMessage'

const error = (kind: ApiError['kind'], status: number | null = null) => new ApiError(kind, '/service', kind, status)

describe('failureMessage', () => {
  it.each([
    [[error('http', 500)], 'Something went wrong on our side'],
    [[error('network')], "We couldn't reach the server"],
    [[error('offline')], "You're offline"],
    [[error('invalid')], "We couldn't read the latest services"],
    [[new Error('unknown')], "We couldn't reach the server"],
  ])('describes %o', (errors, title) => {
    expect(failureMessage(errors).title).toBe(title)
  })

  it('leads with the cause the user can act on', () => {
    expect(failureMessage([error('http', 500), error('offline')]).title).toBe("You're offline")
    expect(failureMessage([error('invalid'), error('network')]).title).toBe("We couldn't reach the server")
  })
})

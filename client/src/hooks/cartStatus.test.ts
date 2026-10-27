import { describe, expect, it } from 'vitest'
import { deriveCartStatus } from './cartStatus'

const error = new Error('boom')

describe('deriveCartStatus', () => {
  it('is loading on the first fetch', () => {
    expect(deriveCartStatus({ status: 'pending', fetchStatus: 'fetching', hasData: false, error: null })).toEqual({
      kind: 'loading',
    })
  })

  it('is offline when the first fetch is waiting for a connection', () => {
    expect(deriveCartStatus({ status: 'pending', fetchStatus: 'paused', hasData: false, error: null })).toEqual({
      kind: 'offline',
    })
  })

  it('is an error only when there is no cart to show', () => {
    expect(deriveCartStatus({ status: 'error', fetchStatus: 'idle', hasData: false, error })).toEqual({
      kind: 'error',
      error,
    })
  })

  it('keeps showing the cart when a reload fails', () => {
    expect(deriveCartStatus({ status: 'error', fetchStatus: 'idle', hasData: true, error })).toEqual({
      kind: 'ready',
      refreshFailed: true,
    })
    expect(deriveCartStatus({ status: 'success', fetchStatus: 'fetching', hasData: true, error: null })).toEqual({
      kind: 'ready',
      refreshFailed: false,
    })
  })
})

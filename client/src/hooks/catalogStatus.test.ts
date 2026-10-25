import { describe, expect, it } from 'vitest'
import { deriveCatalogStatus, type ResourceState } from './catalogStatus'

const states = (categories: ResourceState, providers: ResourceState, services: ResourceState) => ({
  categories,
  providers,
  services,
})

describe('deriveCatalogStatus', () => {
  it('is ready when everything loaded', () => {
    expect(deriveCatalogStatus(states('success', 'success', 'success'), false)).toEqual({ kind: 'ready', missing: [] })
  })

  it('is loading while anything is pending, categories included', () => {
    expect(deriveCatalogStatus(states('pending', 'success', 'success'), false)).toEqual({ kind: 'loading' })
    expect(deriveCatalogStatus(states('success', 'success', 'pending'), false)).toEqual({ kind: 'loading' })
  })

  it('is offline when pending requests are paused', () => {
    expect(deriveCatalogStatus(states('pending', 'pending', 'pending'), true)).toEqual({ kind: 'offline' })
  })

  it('is an error when services or providers fail, even while others load', () => {
    expect(deriveCatalogStatus(states('pending', 'error', 'pending'), false)).toEqual({
      kind: 'error',
      failed: ['providers'],
    })
    expect(deriveCatalogStatus(states('error', 'success', 'error'), false)).toEqual({
      kind: 'error',
      failed: ['categories', 'services'],
    })
  })

  it('shows partial results when only categories fail', () => {
    expect(deriveCatalogStatus(states('error', 'success', 'success'), false)).toEqual({
      kind: 'ready',
      missing: ['categories'],
    })
  })

  it('keeps loading when categories failed but services are still on their way', () => {
    expect(deriveCatalogStatus(states('error', 'success', 'pending'), false)).toEqual({ kind: 'loading' })
  })
})

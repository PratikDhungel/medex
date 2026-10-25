import { describe, expect, it } from 'vitest'
import { normaliseSearch } from './text'

describe('normaliseSearch', () => {
  it('ignores case, accents and extra spaces', () => {
    expect(normaliseSearch('  São   PAULO ')).toBe('sao paulo')
    expect(normaliseSearch('Bumrungrad')).toBe(normaliseSearch('bumrungrad'))
  })
})

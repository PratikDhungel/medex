import { describe, expect, it } from 'vitest'
import { groupByProvider } from './grouping'
import type { Provider, Service } from './model'

const provider = (id: number) => ({ id, name: `P${id}` }) as Provider
const service = (id: string, providerId: number) => ({ id, providerId }) as Service

describe('groupByProvider', () => {
  const providers = new Map([1, 2, 3].map((id) => [id, provider(id)]))

  it('groups by provider in order of first appearance, keeping service order', () => {
    const groups = groupByProvider([service('a', 2), service('b', 1), service('c', 2), service('d', 3)], providers)
    expect(groups.map((g) => [g.provider.id, g.services.map((s) => s.id)])).toEqual([
      [2, ['a', 'c']],
      [1, ['b']],
      [3, ['d']],
    ])
  })

  it('skips services whose provider is unknown', () => {
    expect(groupByProvider([service('a', 9)], providers)).toEqual([])
  })
})

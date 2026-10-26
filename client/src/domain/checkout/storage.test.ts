import { describe, expect, it } from 'vitest'
import { checkoutReducer, createSession } from './machine'
import { clearSession, loadSession, saveSession, STORAGE_KEY, type SessionStorageLike } from './storage'

function memoryStorage(initial: Record<string, string> = {}): SessionStorageLike & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value
    },
    removeItem: (key) => {
      delete data[key]
    },
  }
}

const broken: SessionStorageLike = {
  getItem: () => {
    throw new Error('denied')
  },
  setItem: () => {
    throw new Error('quota')
  },
  removeItem: () => {
    throw new Error('denied')
  },
}

const session = checkoutReducer(
  createSession('s1', '2026-10-26T00:00:00Z', [
    { groupType: 'lab_test', providers: [], items: [{ lineId: 'l1', quantity: 1, wellnessPricingId: null }], totals: [], paymentMethod: 'card' },
  ]),
  { type: 'submitting', groupType: 'lab_test', newKey: 'key-1' },
)

describe('checkout storage', () => {
  it('resumes a saved session, with the request that was out marked unknown', () => {
    const storage = memoryStorage()
    expect(saveSession(storage, session)).toBe(true)
    expect(loadSession(storage)?.orders[0]).toMatchObject({
      idempotencyKey: 'key-1',
      phase: { kind: 'interrupted', reason: 'unknown' },
    })
  })

  it('drops a session it cannot trust', () => {
    expect(loadSession(memoryStorage({ [STORAGE_KEY]: '{not json' }))).toBeNull()
    expect(loadSession(memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 2, id: 's', orders: [] }) }))).toBeNull()
    expect(
      loadSession(memoryStorage({ [STORAGE_KEY]: JSON.stringify({ ...session, orders: [{ groupType: 'x' }] }) })),
    ).toBeNull()
  })

  it('returns null when nothing is saved, and clears', () => {
    const storage = memoryStorage()
    expect(loadSession(storage)).toBeNull()
    saveSession(storage, session)
    clearSession(storage)
    expect(storage.data).toEqual({})
  })

  it('keeps working when storage is unavailable', () => {
    expect(saveSession(broken, session)).toBe(false)
    expect(loadSession(broken)).toBeNull()
    expect(() => clearSession(broken)).not.toThrow()
  })
})
